"""Tests for core/models/base/soft_delete.py (exercised via the Device model)."""

import uuid

from rest_framework.test import APITestCase

from core.models import Device


class SoftDeleteModelTests(APITestCase):
    def test_delete_is_soft_by_default(self):
        device = Device.objects.create(device_id=uuid.uuid4())
        device.delete()

        self.assertIsNotNone(device.deleted_at)
        self.assertEqual(Device.objects.count(), 0)
        self.assertEqual(Device.all_objects.count(), 1)

    def test_hard_delete_removes_the_row(self):
        device = Device.objects.create(device_id=uuid.uuid4())
        device.hard_delete()
        self.assertEqual(Device.all_objects.count(), 0)

    def test_restore_brings_a_device_back(self):
        device = Device.objects.create(device_id=uuid.uuid4())
        device.delete()
        device.restore()
        self.assertEqual(Device.objects.count(), 1)
