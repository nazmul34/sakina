"""Tests for core/views.py."""

from rest_framework import status
from rest_framework.test import APITestCase


class HealthCheckTests(APITestCase):
    def test_health_returns_ok(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], "ok")

    def test_health_does_not_touch_the_database(self):
        # The liveness probe must answer even if the DB is down, so it must
        # not issue any queries (UptimeRobot keep-alive, F-00.6).
        with self.assertNumQueries(0):
            response = self.client.get("/health")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
