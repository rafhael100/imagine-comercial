"""Read-only private purchase browser probe: CI BasicAuth fixture or operator-approved HTTPS.

The remote mode NEVER sends a real order: the protected /simulacao/ page has
connect-src 'none'; this script only clicks inside that synthetic static page.
No credential values or downloaded reports are printed or persisted by script.
"""
from __future__ import annotations
import argparse
import base64
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from shutil import which
from threading import Thread
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

APPROVED_STAGING_ORIGIN = "https://comercial-dev.imaginecomunica.com.br"
FAKE_USER = "synthetic-review-ci"
FAKE_PASSWORD = "never-use-for-real-host-ci-only"
CASES = (
    ("onepage", "onepage"),
    ("landing-pages", "landing-pages"),
    ("gestao-google-ads", "performance"),
    ("gestao-meta-ads", "performance"),
)


class ProtectedSyntheticFixture(SimpleHTTPRequestHandler):
    """CI-only BasicAuth; no deployment, real password or remote connections."""
    expected = "Basic " + base64.b64encode(
        (FAKE_USER + ":" + FAKE_PASSWORD).encode("ascii")
    ).decode("ascii")

    def log_message(self, *args: object) -> None:
        return

    def _access(self) -> bool:
        if self.headers.get("Authorization") == self.expected:
            return True
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="Imagine fictional CI"')
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        self.send_header("Content-Length", "0")
        self.end_headers()
        return False

    def do_GET(self) -> None:
        if self._access():
            super().do_GET()

    def do_HEAD(self) -> None:
        if self._access():
            super().do_HEAD()

    def do_POST(self) -> None:
        self.send_response(405)
        self.send_header("Content-Length", "0")
        self.end_headers()


def check_and_walk(origin: str, user: str, secret: str, *, remote: bool) -> None:
    u = urlsplit(origin)
    if not u.hostname or u.path not in ("", "/") or u.username or u.password or u.query:
        raise ValueError("Invalid protected origin.")
    if remote and origin != APPROVED_STAGING_ORIGIN:
        raise ValueError("Remote origin is not the pinned approved private staging domain.")
    if not remote and (u.scheme != "http" or u.hostname != "127.0.0.1"):
        raise ValueError("CI fixture must stay on loopback.")

    with sync_playwright() as p:
        # Do NOT include auth on the initial privacy probe.
        unauth = p.request.new_context(ignore_https_errors=False)
        try:
            for path in ("/", "/simulacao/"):
                resp = unauth.get(origin + path, max_redirects=0, timeout=12000)
                if resp.status != 401:
                    raise AssertionError("Unauthenticated staging was not denied.")
                if "no-store" not in (resp.headers.get("cache-control") or ""):
                    raise AssertionError("Unauthenticated response may be cached.")
                if "noindex" not in (resp.headers.get("x-robots-tag") or ""):
                    raise AssertionError("Unauthenticated response can be indexed.")
        finally:
            unauth.dispose()

        # Prefer the installed system browser in CI; otherwise use the
        # local Playwright-managed Chromium, including on Windows hosts.
        launch = {
            "headless": True,
            "args": ["--no-sandbox", "--disable-background-networking"],
        }
        executable = (os.environ.get("CHROMIUM_PATH") or
                      which("google-chrome") or which("chromium") or
                      which("chrome"))
        if executable:
            launch["executable_path"] = executable
        browser = p.chromium.launch(**launch)
        try:
            context = browser.new_context(
                http_credentials={"username": user, "password": secret},
                accept_downloads=True, viewport={"width": 1280, "height": 900},
            )
            try:
                def allow_only_approved(route):
                    target = urlsplit(route.request.url)
                    if (target.scheme == u.scheme and target.hostname == u.hostname
                        and (target.port or (443 if target.scheme == "https" else 80))
                            == (u.port or (443 if u.scheme == "https" else 80))):
                        route.continue_()
                    elif target.scheme == "data":
                        route.continue_()
                    else:
                        route.abort()

                context.route("**/*", allow_only_approved)
                for slug, product in CASES:
                    page = context.new_page()
                    errors = []
                    page.on("pageerror", lambda e: errors.append(type(e).__name__))
                    response = page.goto(origin + "/", wait_until="domcontentloaded", timeout=15000)
                    assert response and response.status == 200, "Authenticated homepage unavailable."
                    link = page.locator(
                        f'article[data-quick-hire="{slug}"] a[data-quick-hire-action]'
                    )
                    assert link.count() == 1, "Expected one direct simulation offer."
                    assert link.get_attribute("href") == f"/simulacao/#{product}"
                    link.click()
                    page.wait_for_url(origin + f"/simulacao/#{product}", timeout=12000)
                    assert page.locator(f'[data-offer="{product}"]').get_attribute(
                        "aria-pressed"
                    ) == "true"

                    # Traverse every client-facing simulated stage; no network
                    # write and no actual purchase will be attempted.
                    for _ in range(4):
                        page.locator("#next").click()
                    assert page.locator("#error").inner_text()
                    page.locator("#reviewed").check()
                    page.locator("#next").click()
                    page.locator("#next").click()
                    assert page.locator("#error").inner_text()
                    page.locator("#contract").check()
                    page.locator("#next").click()
                    for scenario in ("pending", "declined"):
                        page.locator("#scenario").select_option(scenario)
                        page.locator("#next").click()
                        assert page.locator("#scenario").is_visible()
                    page.locator("#scenario").select_option("approved")
                    page.locator("#next").click()
                    assert "Cliente Demonstração" in page.locator("#screen").inner_text()
                    page.locator("#next").click()
                    page.locator("#business").fill("Empresa Fictícia Autorizada")
                    page.locator("#next").click()
                    with page.expect_download() as download:
                        page.locator("#next").click()
                    final = json.loads(Path(download.value.path()).read_text())
                    assert final["service"] == product
                    assert final["paymentScenario"] == "approved"
                    for key in (
                        "realAccountCreated", "realContractAccepted",
                        "realPaymentProcessed", "realOrderCreated",
                        "realBriefingSubmitted",
                    ):
                        assert final[key] is False
                    assert not errors, "The protected browser emitted JavaScript errors."
                    page.close()
            finally:
                context.close()
        finally:
            browser.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--ci-local", action="store_true")
    mode.add_argument("--approved-remote", action="store_true")
    args = parser.parse_args()

    if args.approved_remote:
        user = os.environ.get("IMAGINE_STAGING_BASIC_USER", "")
        password = os.environ.get("IMAGINE_STAGING_BASIC_PASSWORD", "")
        if not user or not password:
            parser.error("Remote review requires operator-provided credentials in private environment.")
        check_and_walk(APPROVED_STAGING_ORIGIN, user, password, remote=True)
        print("PASS: authenticated protected remote purchase simulation; NO real checkout.")
        return 0

    tree = Path(os.environ["IMAGINE_PRIVATE_PURCHASE_PREPARED_ROOT"]).resolve(strict=True)
    if not (tree / "index.html").is_file() or not (tree / "simulacao/index.html").is_file():
        parser.error("Prepared synthetic CI tree missing.")
    with ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(ProtectedSyntheticFixture, directory=str(tree))
    ) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            check_and_walk(
                f"http://127.0.0.1:{server.server_port}", FAKE_USER, FAKE_PASSWORD,
                remote=False,
            )
        finally:
            server.shutdown()
            thread.join(timeout=5)
    print("PASS: CI-only 401 gate + BasicAuth and four complete fictional purchase flows.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        # No URLs, response bodies, passwords, paths, contact data or stack traces.
        print("BLOCKED: protected purchase probe failed (" + type(exc).__name__ + ").")
        raise SystemExit(2)
