"""Tests for the per-device settings GET/PUT API (F-07.1, F-07.2)."""

import uuid
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import DeviceSettings


class DeviceSettingsApiTests(APITestCase):
    def setUp(self):
        self.device_id = uuid.uuid4()
        # APIClient applies these as default headers to every request.
        self.client.credentials(HTTP_X_DEVICE_ID=str(self.device_id))
        self.url = f"/devices/{self.device_id}/settings"

    # --- auth / device gating ------------------------------------------------

    def test_requires_a_device_header(self):
        self.client.credentials()  # clear the header
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_400_BAD_REQUEST)

    def test_path_id_must_match_the_header_device(self):
        other = f"/devices/{uuid.uuid4()}/settings"
        self.assertEqual(self.client.get(other).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.put(other, {"theme": "dark"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    # --- read ----------------------------------------------------------------

    def test_get_materialises_defaults_on_first_read(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["device_id"], str(self.device_id))
        self.assertTrue(body["auto_silent_enabled"])
        self.assertEqual(body["theme"], "system")
        self.assertEqual(body["prayer_method"], "MuslimWorldLeague")
        self.assertEqual(body["asr_method"], "standard")
        self.assertEqual(DeviceSettings.objects.count(), 1)

    # --- upsert --------------------------------------------------------------

    def test_put_creates_and_persists(self):
        response = self.client.put(
            self.url,
            {
                "auto_silent_enabled": False,
                "radius_m": 250,
                "theme": "dark",
                "prayer_method": "NorthAmerica",
                "asr_method": "hanafi",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Re-read to prove it persisted across requests ("across app restarts").
        body = self.client.get(self.url).json()
        self.assertFalse(body["auto_silent_enabled"])
        self.assertEqual(body["radius_m"], 250)
        self.assertEqual(body["theme"], "dark")
        self.assertEqual(body["prayer_method"], "NorthAmerica")
        self.assertEqual(body["asr_method"], "hanafi")

    def test_put_is_a_partial_patch(self):
        self.client.put(self.url, {"theme": "light", "radius_m": 300}, format="json")
        # A second PUT touching only theme must not reset radius_m to its default.
        self.client.put(self.url, {"theme": "dark"}, format="json")
        body = self.client.get(self.url).json()
        self.assertEqual(body["theme"], "dark")
        self.assertEqual(body["radius_m"], 300)

    def test_put_stamps_client_updated_at(self):
        when = timezone.now().replace(microsecond=0)
        self.client.put(
            self.url, {"theme": "dark", "updated_at": when.isoformat()}, format="json"
        )
        self.assertEqual(DeviceSettings.objects.get().updated_at, when)

    def test_put_defaults_updated_at_to_now_when_absent(self):
        before = timezone.now()
        self.client.put(self.url, {"theme": "dark"}, format="json")
        self.assertGreaterEqual(DeviceSettings.objects.get().updated_at, before)

    # --- last-write-wins (F-07.2) -------------------------------------------

    def test_put_with_stale_timestamp_is_ignored(self):
        current = timezone.now()
        self.client.put(
            self.url,
            {"theme": "dark", "updated_at": current.isoformat()},
            format="json",
        )
        # An older edit must not clobber the fresher stored state...
        stale = self.client.put(
            self.url,
            {
                "theme": "light",
                "updated_at": (current - timedelta(minutes=5)).isoformat(),
            },
            format="json",
        )
        # ...but the server echoes the winning state so the client can converge.
        self.assertEqual(stale.status_code, status.HTTP_200_OK)
        self.assertEqual(stale.json()["theme"], "dark")
        self.assertEqual(DeviceSettings.objects.get().theme, "dark")

    def test_put_with_newer_timestamp_wins(self):
        current = timezone.now()
        self.client.put(
            self.url,
            {"theme": "dark", "updated_at": current.isoformat()},
            format="json",
        )
        newer = self.client.put(
            self.url,
            {
                "theme": "light",
                "updated_at": (current + timedelta(minutes=5)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(newer.json()["theme"], "light")
        self.assertEqual(DeviceSettings.objects.get().theme, "light")

    def test_put_with_equal_timestamp_is_a_noop(self):
        when = timezone.now()
        self.client.put(
            self.url, {"theme": "dark", "updated_at": when.isoformat()}, format="json"
        )
        retry = self.client.put(
            self.url, {"theme": "light", "updated_at": when.isoformat()}, format="json"
        )
        # Equal clock → not strictly newer → ignored (idempotent retry).
        self.assertEqual(retry.json()["theme"], "dark")

    def test_first_put_lands_even_with_an_old_clock(self):
        # First contact is this PUT (no prior GET), so it creates the row and
        # always lands — an edit made offline before the row existed must win.
        old = timezone.now() - timedelta(days=1)
        response = self.client.put(
            self.url, {"theme": "dark", "updated_at": old.isoformat()}, format="json"
        )
        self.assertEqual(response.json()["theme"], "dark")
        self.assertEqual(DeviceSettings.objects.get().updated_at, old)

    def test_stale_put_loses_once_the_row_exists(self):
        # A GET auto-creates the row stamped ~now; a later PUT carrying an older
        # clock is then a normal LWW loser (not exempt — the row already exists).
        self.client.get(self.url)
        old = timezone.now() - timedelta(days=1)
        response = self.client.put(
            self.url, {"theme": "dark", "updated_at": old.isoformat()}, format="json"
        )
        self.assertEqual(response.json()["theme"], "system")

    # --- validation ----------------------------------------------------------

    def test_put_rejects_bad_fields(self):
        for bad in (
            {"theme": "neon"},
            {"prayer_method": "Bogus"},
            {"asr_method": "maliki"},
            {"radius_m": 0},
            {"radius_m": "wide"},
            {"auto_silent_enabled": "yes"},
            {"updated_at": "not-a-date"},
        ):
            self.assertEqual(
                self.client.put(self.url, bad, format="json").status_code,
                status.HTTP_400_BAD_REQUEST,
                msg=f"expected 400 for {bad}",
            )
