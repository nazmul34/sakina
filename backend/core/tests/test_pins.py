"""Tests for the pins CRUD + soft-delete sync API (F-03.2)."""

import uuid
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Device, Pin


def _iso(dt):
    return dt.isoformat()


class PinsApiTests(APITestCase):
    def setUp(self):
        self.device_id = uuid.uuid4()
        # APIClient applies these as default headers to every request.
        self.client.credentials(HTTP_X_DEVICE_ID=str(self.device_id))
        self.now = timezone.now()

    def _create(self, **overrides):
        body = {
            "id": str(uuid.uuid4()),
            "label": "My local masjid",
            "lat": 51.5074,
            "lng": -0.1278,
            "radius_m": 150,
            "updated_at": _iso(self.now),
        }
        body.update(overrides)
        return self.client.post("/pins", body, format="json")

    # --- auth / device gating ------------------------------------------------

    def test_pins_require_a_device_header(self):
        self.client.credentials()  # clear the header
        self.assertEqual(
            self.client.get("/pins").status_code, status.HTTP_400_BAD_REQUEST
        )
        self.assertEqual(
            self.client.post("/pins", {}, format="json").status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    # --- create --------------------------------------------------------------

    def test_post_creates_a_pin(self):
        response = self._create()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Pin.objects.count(), 1)
        body = response.json()
        self.assertEqual(body["label"], "My local masjid")
        self.assertEqual(body["radius_m"], 150)
        self.assertFalse(body["is_deleted"])

    def test_post_keeps_the_client_supplied_id(self):
        pin_id = str(uuid.uuid4())
        response = self._create(id=pin_id)
        self.assertEqual(response.json()["id"], pin_id)
        self.assertTrue(Pin.objects.filter(id=pin_id).exists())

    def test_post_generates_an_id_when_omitted(self):
        body = {
            "label": "Anon",
            "lat": 1.0,
            "lng": 2.0,
            "radius_m": 100,
            "updated_at": _iso(self.now),
        }
        response = self.client.post("/pins", body, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(uuid.UUID(response.json()["id"]))

    def test_post_is_idempotent_on_retry(self):
        pin_id = str(uuid.uuid4())
        self._create(id=pin_id)
        retry = self._create(id=pin_id)  # same id + same updated_at
        self.assertEqual(retry.status_code, status.HTTP_200_OK)
        self.assertEqual(Pin.objects.count(), 1)

    def test_post_with_newer_timestamp_upserts(self):
        pin_id = str(uuid.uuid4())
        self._create(id=pin_id, label="old")
        later = self._create(
            id=pin_id, label="new", updated_at=_iso(self.now + timedelta(minutes=1))
        )
        self.assertEqual(later.status_code, status.HTTP_200_OK)
        self.assertEqual(Pin.objects.get(id=pin_id).label, "new")

    # --- list ----------------------------------------------------------------

    def test_get_lists_only_this_devices_pins(self):
        self._create(label="mine")
        other = Pin.objects.create(
            device=Device.objects.create(device_id=uuid.uuid4()),  # another device
            lat=0.0,
            lng=0.0,
            radius_m=100,
            updated_at=self.now,
        )
        body = self.client.get("/pins").json()
        ids = {p["id"] for p in body["pins"]}
        self.assertEqual(len(ids), 1)
        self.assertNotIn(str(other.id), ids)

    def test_get_includes_soft_deleted_tombstones(self):
        pin_id = self._create().json()["id"]
        self.client.delete(f"/pins/{pin_id}")
        body = self.client.get("/pins").json()
        self.assertEqual(len(body["pins"]), 1)
        self.assertTrue(body["pins"][0]["is_deleted"])

    # --- update (last-write-wins) -------------------------------------------

    def test_put_applies_a_newer_edit(self):
        pin_id = self._create(label="before").json()["id"]
        response = self.client.put(
            f"/pins/{pin_id}",
            {
                "label": "after",
                "lat": 51.5,
                "lng": -0.12,
                "radius_m": 500,
                "updated_at": _iso(self.now + timedelta(minutes=5)),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pin = Pin.objects.get(id=pin_id)
        self.assertEqual(pin.label, "after")
        self.assertEqual(pin.radius_m, 500)

    def test_put_with_stale_timestamp_is_ignored(self):
        pin_id = self._create(label="current").json()["id"]
        response = self.client.put(
            f"/pins/{pin_id}",
            {
                "label": "stale",
                "lat": 0.0,
                "lng": 0.0,
                "radius_m": 100,
                "updated_at": _iso(self.now - timedelta(minutes=5)),
            },
            format="json",
        )
        # Server state wins and is echoed back so the client can converge.
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["label"], "current")
        self.assertEqual(Pin.objects.get(id=pin_id).label, "current")

    def test_put_unknown_pin_is_404(self):
        response = self.client.put(
            f"/pins/{uuid.uuid4()}",
            {"label": "x", "lat": 0.0, "lng": 0.0, "radius_m": 100},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_put_cannot_touch_another_devices_pin(self):
        other = Pin.objects.create(
            device=Device.objects.create(device_id=uuid.uuid4()),
            lat=0.0,
            lng=0.0,
            radius_m=100,
            updated_at=self.now,
        )
        response = self.client.put(
            f"/pins/{other.id}",
            {"label": "hijack", "lat": 0.0, "lng": 0.0, "radius_m": 100},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_put_with_newer_edit_resurrects_a_deleted_pin(self):
        pin_id = self._create().json()["id"]
        self.client.delete(f"/pins/{pin_id}")
        self.assertTrue(Pin.all_objects.get(id=pin_id).is_deleted)

        self.client.put(
            f"/pins/{pin_id}",
            {
                "label": "back",
                "lat": 1.0,
                "lng": 1.0,
                "radius_m": 250,
                "updated_at": _iso(timezone.now() + timedelta(minutes=10)),
            },
            format="json",
        )
        pin = Pin.objects.get(id=pin_id)  # default manager → only live rows
        self.assertFalse(pin.is_deleted)
        self.assertEqual(pin.label, "back")

    # --- delete (soft) -------------------------------------------------------

    def test_delete_is_soft(self):
        pin_id = self._create().json()["id"]
        response = self.client.delete(f"/pins/{pin_id}")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Pin.objects.count(), 0)  # hidden from default manager
        self.assertTrue(Pin.all_objects.get(id=pin_id).is_deleted)

    def test_delete_is_idempotent(self):
        pin_id = self._create().json()["id"]
        self.client.delete(f"/pins/{pin_id}")
        again = self.client.delete(f"/pins/{pin_id}")
        self.assertEqual(again.status_code, status.HTTP_204_NO_CONTENT)
        # Deleting an entirely unknown id is also a no-op success.
        self.assertEqual(
            self.client.delete(f"/pins/{uuid.uuid4()}").status_code,
            status.HTTP_204_NO_CONTENT,
        )

    # --- validation ----------------------------------------------------------

    def test_post_rejects_bad_fields(self):
        for bad in (
            {"lat": 999, "lng": 0, "radius_m": 100},
            {"lat": 0, "lng": 0, "radius_m": 0},
            {"lat": 0, "lng": 0, "radius_m": "wide"},
            {"lat": 0, "lng": 0},  # missing radius
        ):
            body = {"updated_at": _iso(self.now), **bad}
            self.assertEqual(
                self.client.post("/pins", body, format="json").status_code,
                status.HTTP_400_BAD_REQUEST,
            )
