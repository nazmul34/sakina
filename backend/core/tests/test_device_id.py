"""Tests for core/middleware/device_id.py — the anonymous device-ID flow (F-00.4)."""

import uuid

from rest_framework.test import APITestCase

from core.models import Device


class DeviceIdMiddlewareTests(APITestCase):
    def test_no_header_creates_no_device(self):
        self.client.get("/health")
        self.assertEqual(Device.objects.count(), 0)

    def test_first_contact_upserts_a_device(self):
        device_id = uuid.uuid4()
        self.client.get("/health", HTTP_X_DEVICE_ID=str(device_id))
        self.assertEqual(Device.objects.count(), 1)
        self.assertTrue(Device.objects.filter(pk=device_id).exists())

    def test_repeat_contact_is_idempotent(self):
        device_id = str(uuid.uuid4())
        self.client.get("/health", HTTP_X_DEVICE_ID=device_id)
        self.client.get("/health", HTTP_X_DEVICE_ID=device_id)
        self.assertEqual(Device.objects.count(), 1)

    def test_malformed_header_is_ignored(self):
        self.client.get("/health", HTTP_X_DEVICE_ID="not-a-uuid")
        self.assertEqual(Device.objects.count(), 0)

    def test_soft_deleted_device_is_resurrected_on_contact(self):
        device_id = uuid.uuid4()
        device = Device.objects.create(device_id=device_id)
        device.delete()
        self.assertEqual(Device.objects.count(), 0)  # hidden from default manager

        self.client.get("/health", HTTP_X_DEVICE_ID=str(device_id))

        device.refresh_from_db()
        self.assertIsNone(device.deleted_at)
        self.assertEqual(Device.objects.count(), 1)
