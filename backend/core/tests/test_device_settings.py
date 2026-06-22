"""Tests for the per-device settings GET/PUT API (F-07.1)."""

import uuid

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
