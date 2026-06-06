"""Tests for the core app."""

from rest_framework import status
from rest_framework.test import APITestCase


class HealthCheckTests(APITestCase):
    def test_health_returns_ok(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], "ok")
