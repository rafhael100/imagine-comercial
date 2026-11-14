#!/usr/bin/env python3
"""Anonymous, read-only perimeter check of ONE approved Imagine staging origin.

No secrets, credentials, redirects, URLs supplied by callers, response body
inspection, cookies, writes, browser sessions or data collection. NO-GO.
"""
from __future__ import annotations
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, HTTPRedirectHandler, Request, build_opener
import ssl
import sys

ORIGIN = "https://comercial-dev.imaginecomunica.com.br"
PATHS = ("/", "/simulacao/")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def assert_denied(status: int, headers) -> None:
    if status != 401:
        raise ValueError("Anonymous staging responded with a non-401 status.")
    if "basic" not in (headers.get("WWW-Authenticate", "")).lower():
        raise ValueError("Basic Auth challenge missing.")
    if "no-store" not in (headers.get("Cache-Control", "")).lower():
        raise ValueError("Private staging response may be cached.")
    if "noindex" not in (headers.get("X-Robots-Tag", "")).lower():
        raise ValueError("Private staging response could be indexed.")


def main() -> int:
    opener = build_opener(
        ProxyHandler({}), NoRedirect(),
    )
    for path in PATHS:
        url = ORIGIN + path
        if not url.startswith(ORIGIN + "/") or path not in PATHS:
            raise ValueError("Staging URL outside allowlist.")
        request = Request(
            url,
            headers={"Accept": "text/html", "User-Agent": "Imagine-Private-Review-ReadOnly/1"},
            method="GET",
        )
        try:
            response = opener.open(request, timeout=10)
        except HTTPError as error:
            status, headers = error.code, error.headers
            error.close()
        except (URLError, ssl.SSLError, TimeoutError, OSError) as error:
            raise RuntimeError("HTTPS staging perimeter unavailable: "+type(error).__name__) from None
        else:
            status, headers = response.status, response.headers
            response.close()
        assert_denied(status, headers)
    print("PASS: 2/2 anonymous HTTPS pages protected by BasicAuth, no-store, noindex.")
    print("NO-GO: authenticated navigation, real service, customer journey not evaluated.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        # Never expose paths, tokens, host details, body or login challenges.
        print("BLOCKED: staging perimeter check ("+type(exc).__name__+").", file=sys.stderr)
        raise SystemExit(2)
