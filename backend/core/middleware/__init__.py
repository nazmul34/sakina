"""
Request/response middleware for the core app.

Each middleware lives in its own module and is re-exported here so the
``MIDDLEWARE`` setting can reference the flat ``core.middleware.<Name>`` path.
"""

from .device_id import DeviceIdMiddleware

__all__ = ["DeviceIdMiddleware"]
