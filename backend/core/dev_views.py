"""Dev-only helper endpoints.

These exist purely to make local development easier — chiefly, pulling a freshly
built Android APK onto a physical phone without going through Google Drive. They
are served on the same port the mobile app already reaches over ngrok, so the
phone can just open the ngrok URL and download the build.

Every view here hard-gates on ``settings.DEBUG`` and raises ``Http404`` when it
is off, so the routes are invisible in production (``config.settings.prod``
forces ``DEBUG = False``). Nothing here touches the database or app data.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpRequest, HttpResponse
from django.urls import reverse
from django.utils.html import format_html, format_html_join

# Where Gradle writes APKs. Defaults to the repo's mobile build output (BASE_DIR
# is backend/; its parent is the repo root that also holds mobile/). Overridable
# via the DEV_APK_DIR setting — needed when the backend runs in Docker, where the
# host's mobile/ dir is bind-mounted to a different path (see docker-compose.yml).
APK_DIR = Path(
    getattr(
        settings,
        "DEV_APK_DIR",
        Path(settings.BASE_DIR).parent
        / "mobile"
        / "android"
        / "app"
        / "build"
        / "outputs"
        / "apk",
    )
)


def _require_debug() -> None:
    """Make these endpoints exist only in development."""
    if not settings.DEBUG:
        raise Http404()


def _list_apks() -> list[Path]:
    """All built ``*.apk`` files, newest first."""
    if not APK_DIR.is_dir():
        return []
    return sorted(
        APK_DIR.rglob("*.apk"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )


def _human_size(num_bytes: int) -> str:
    mb = num_bytes / (1024 * 1024)
    return f"{mb:.1f} MB"


def apk_index(request: HttpRequest) -> HttpResponse:
    """``GET /dev/apk`` — a tiny mobile-friendly page listing built APKs.

    Open this on the phone (via the ngrok URL) and tap a build to download it.
    """
    _require_debug()

    apks = _list_apks()
    if apks:
        rows = format_html_join(
            "",
            (
                '<li class="row">'
                "<div class=\"meta\"><div class=\"name\">{}</div>"
                '<div class="sub">{} · {} · built {}</div></div>'
                '<a class="btn" href="{}">Download</a>'
                "</li>"
            ),
            (
                (
                    apk.name,
                    apk.parent.name,  # "release" / "debug" variant
                    _human_size(apk.stat().st_size),
                    datetime.fromtimestamp(apk.stat().st_mtime).strftime(
                        "%d %b %Y %H:%M"
                    ),
                    reverse("dev-apk-download")
                    + f"?file={apk.relative_to(APK_DIR).as_posix()}",
                )
                for apk in apks
            ),
        )
        body = format_html('<ul class="list">{}</ul>', rows)
    else:
        body = format_html(
            '<p class="empty">No APKs found under '
            "<code>mobile/android/app/build/outputs/apk</code>. "
            "Build one first, then refresh.</p>"
        )

    return HttpResponse(_page("Sakina dev builds", body))


def apk_download(request: HttpRequest) -> FileResponse:
    """``GET /dev/apk/download?file=<rel>`` — stream an APK as a download.

    ``file`` is a path relative to the APK output dir. It is resolved and checked
    to stay inside that dir (no traversal) and to be a real ``.apk`` file. The
    Android package mime type makes mobile browsers offer to install it.
    """
    _require_debug()

    rel = request.GET.get("file", "")
    base = APK_DIR.resolve()
    try:
        target = (base / rel).resolve()
    except (OSError, ValueError):
        raise Http404() from None

    if (
        base not in target.parents
        or target.suffix != ".apk"
        or not target.is_file()
    ):
        raise Http404()

    return FileResponse(
        target.open("rb"),
        as_attachment=True,
        filename=target.name,
        content_type="application/vnd.android.package-archive",
    )


def _page(title: str, body: str) -> str:
    """Wrap content in a minimal, mobile-friendly HTML shell."""
    return format_html(
        "<!DOCTYPE html><html lang=\"en\"><head>"
        '<meta charset="utf-8" />'
        '<meta name="viewport" content="width=device-width, initial-scale=1" />'
        "<title>{}</title><style>{}</style></head>"
        '<body><div class="wrap"><h1>{}</h1>{}</div></body></html>',
        title,
        _CSS,
        title,
        body,
    )


_CSS = (
    "*{box-sizing:border-box}"
    "body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;"
    "background:#0f1417;color:#e7eaed}"
    ".wrap{max-width:640px;margin:0 auto;padding:24px 16px}"
    "h1{font-size:20px;margin:0 0 16px}"
    ".list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}"
    ".row{display:flex;align-items:center;gap:12px;padding:14px 16px;"
    "background:#1a1f24;border:1px solid #2c333a;border-radius:12px}"
    ".meta{flex:1;min-width:0}"
    ".name{font-weight:700;word-break:break-all}"
    ".sub{font-size:12px;color:#9ba2a9;margin-top:2px}"
    ".btn{flex:none;background:#1f7a45;color:#fff;text-decoration:none;"
    "font-weight:700;padding:10px 16px;border-radius:10px}"
    ".empty{color:#9ba2a9;line-height:1.5}"
    "code{background:#22282e;padding:2px 6px;border-radius:6px}"
)
