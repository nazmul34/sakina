"""Tests for the "report incorrect mosque" API (FR-2.6, EPIC-08)."""

import uuid

from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Device, MosqueReport


class MosqueReportsApiTests(APITestCase):
    def setUp(self):
        self.device_id = uuid.uuid4()
        self.client.credentials(HTTP_X_DEVICE_ID=str(self.device_id))
        self.mosque_id = str(uuid.uuid4())

    def _report(self, **overrides):
        body = {
            "mosque_id": self.mosque_id,
            "name": "Central Mosque",
            "lat": 51.5074,
            "lng": -0.1278,
        }
        body.update(overrides)
        return self.client.post("/mosques/reports", body, format="json")

    # --- create --------------------------------------------------------------

    def test_post_creates_a_report(self):
        response = self._report()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MosqueReport.objects.count(), 1)

        report = MosqueReport.objects.get()
        self.assertEqual(report.mosque_public_id, self.mosque_id)
        self.assertEqual(report.mosque_name, "Central Mosque")
        self.assertEqual(report.lat, 51.5074)
        # Defaults: unspecified reason, pending status, snapshot only.
        self.assertEqual(report.reason, MosqueReport.Reason.UNSPECIFIED)
        self.assertEqual(report.status, MosqueReport.Status.PENDING)
        self.assertEqual(response.json()["status"], "pending")

    def test_report_is_attributed_to_the_device(self):
        self._report()
        report = MosqueReport.objects.get()
        self.assertEqual(report.device.device_id, self.device_id)

    def test_report_accepts_a_reason_and_note(self):
        response = self._report(reason="closed", note="Demolished last year")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = MosqueReport.objects.get()
        self.assertEqual(report.reason, MosqueReport.Reason.CLOSED)
        self.assertEqual(report.note, "Demolished last year")

    def test_report_never_edits_the_mosque_cache(self):
        # A report is a separate moderated row — it must not create/touch a Mosque.
        from core.models import Mosque

        self._report()
        self.assertEqual(Mosque.objects.count(), 0)

    # --- anonymous / no device ----------------------------------------------

    def test_report_succeeds_without_a_device_header(self):
        # Flagging bad data must never fail for the lack of a device.
        self.client.credentials()  # clear the header
        response = self._report()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = MosqueReport.objects.get()
        self.assertIsNone(report.device)

    def test_report_survives_its_device_being_deleted(self):
        # A hard delete of the device nulls the FK (SET_NULL) rather than
        # cascading the report away — moderation keeps the flag.
        self._report()
        Device.objects.get(device_id=self.device_id).hard_delete()
        report = MosqueReport.objects.get()
        self.assertIsNone(report.device)

    # --- validation ----------------------------------------------------------

    def test_mosque_id_is_required(self):
        response = self._report(mosque_id="")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MosqueReport.objects.count(), 0)

    def test_coordinates_are_required_and_ranged(self):
        self.assertEqual(
            self._report(lat=None).status_code, status.HTTP_400_BAD_REQUEST
        )
        self.assertEqual(
            self._report(lng=999).status_code, status.HTTP_400_BAD_REQUEST
        )
        self.assertEqual(MosqueReport.objects.count(), 0)

    def test_unknown_reason_is_rejected(self):
        response = self._report(reason="bogus")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MosqueReport.objects.count(), 0)
