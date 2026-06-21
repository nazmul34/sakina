"""Tests for GET /messages/random (FR-4.1 / FR-4.2)."""

from rest_framework import status
from rest_framework.test import APITestCase

from core.models import IslamicMessage


def _make(category="quran", is_active=True, **kwargs):
    return IslamicMessage.objects.create(
        text=kwargs.get("text", "Test message"),
        source_label=kwargs.get("source_label", "Test 1:1"),
        category=category,
        is_active=is_active,
    )


class RandomMessageApiTests(APITestCase):

    # --- happy path ----------------------------------------------------------

    def test_returns_an_active_message(self):
        _make(text="In the name of Allah")
        response = self.client.get("/messages/random")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertIn("id", body)
        self.assertIn("text", body)
        self.assertIn("source_label", body)
        self.assertIn("category", body)

    def test_response_shape(self):
        msg = _make(text="Indeed Allah is with the patient.", source_label="Qur'an 2:153")
        response = self.client.get("/messages/random")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(set(body.keys()), {"id", "text", "source_label", "category"})
        self.assertEqual(body["text"], msg.text)
        self.assertEqual(body["source_label"], msg.source_label)
        self.assertEqual(body["category"], "quran")

    # --- category filter -----------------------------------------------------

    def test_category_filter_returns_matching_message(self):
        _make(category="quran", text="Quran verse")
        _make(category="hadith", text="Hadith text")
        response = self.client.get("/messages/random?category=hadith")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["category"], "hadith")

    def test_category_filter_excludes_other_categories(self):
        _make(category="dua", text="A dua")
        response = self.client.get("/messages/random?category=quran")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_all_valid_categories_accepted(self):
        for cat in ("quran", "hadith", "dua", "reminder"):
            _make(category=cat)
            response = self.client.get(f"/messages/random?category={cat}")
            self.assertEqual(
                response.status_code,
                status.HTTP_200_OK,
                msg=f"Expected 200 for category={cat}",
            )

    def test_invalid_category_returns_400(self):
        _make()
        response = self.client.get("/messages/random?category=unknown")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.json())

    # --- inactive messages ---------------------------------------------------

    def test_inactive_messages_excluded(self):
        _make(is_active=False, text="Should not appear")
        response = self.client.get("/messages/random")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_inactive_messages_excluded_with_category_filter(self):
        _make(category="quran", is_active=False, text="Hidden verse")
        _make(category="hadith", is_active=True, text="Visible hadith")
        response = self.client.get("/messages/random?category=quran")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_only_active_messages_returned_when_mixed(self):
        _make(is_active=False, text="Hidden")
        active = _make(is_active=True, text="Visible")
        response = self.client.get("/messages/random")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["text"], active.text)

    # --- empty db ------------------------------------------------------------

    def test_no_messages_returns_404(self):
        response = self.client.get("/messages/random")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("detail", response.json())
