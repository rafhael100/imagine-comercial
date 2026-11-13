"""Four real HTML CTA clicks → nine-stage fictional purchase over private loopback."""
from __future__ import annotations

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

tree = Path(os.environ["IMAGINE_PRIVATE_PURCHASE_PREPARED_ROOT"]).resolve(strict=True)
assert tree.is_dir() and not tree.is_symlink()
assert (tree / "index.html").is_file()
assert (tree / "simulacao" / "index.html").is_file()


class QuietLocalStatic(SimpleHTTPRequestHandler):
    def log_message(self, *args: object) -> None:
        # No URLs or visitor data in CI output.
        pass

    def do_POST(self) -> None:
        self.send_error(405, "Synthetic viewer is read-only")


cases = (
    ("onepage", "onepage"),
    ("landing-pages", "landing-pages"),
    ("gestao-google-ads", "performance"),
    ("gestao-meta-ads", "performance"),
)
assert len({x[0] for x in cases}) == 4
with ThreadingHTTPServer(
    ("127.0.0.1", 0), partial(QuietLocalStatic, directory=str(tree))
) as server:
    port = server.server_port
    assert server.server_address[0] == "127.0.0.1"
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/google-chrome"),
                headless=True, args=["--no-sandbox", "--disable-background-networking"],
            )
            try:
                origin = f"http://127.0.0.1:{port}"
                for slug, product in cases:
                    page = browser.new_page(
                        viewport={"width": 1280, "height": 900},
                        accept_downloads=True,
                    )
                    page_errors = []
                    blocked_externals = []
                    page.on("pageerror", lambda e: page_errors.append(str(e)))

                    def network_guard(route):
                        target = urlsplit(route.request.url)
                        if (target.scheme == "http" and target.hostname == "127.0.0.1"
                            and target.port == port):
                            route.continue_()
                        elif target.scheme == "data":
                            route.continue_()
                        else:
                            blocked_externals.append(route.request.url.split(":", 1)[0])
                            route.abort()

                    page.route("**/*", network_guard)
                    response = page.goto(origin + "/", wait_until="domcontentloaded")
                    assert response and response.status == 200
                    link = page.locator(
                        f'article[data-quick-hire="{slug}"] a[data-quick-hire-action]'
                    )
                    assert link.count() == 1, slug
                    assert link.get_attribute("href") == f"/simulacao/#{product}"
                    assert link.get_attribute("target") is None
                    link.click()
                    page.wait_for_url(origin + f"/simulacao/#{product}")
                    assert page.locator(f'[data-offer="{product}"]').get_attribute(
                        "aria-pressed"
                    ) == "true", product
                    assert page.locator("#next").is_visible()

                    # Complete the actual nine-stage simulation after entering
                    # through the live-built offer, not the source file:// page.
                    for _ in range(4):
                        page.locator("#next").click()
                    assert page.locator("#error").inner_text()
                    page.locator("#reviewed").check()
                    page.locator("#next").click()
                    page.locator("#next").click()
                    assert page.locator("#error").inner_text()
                    page.locator("#contract").check()
                    page.locator("#next").click()
                    for outcome in ("pending", "declined"):
                        page.locator("#scenario").select_option(outcome)
                        page.locator("#next").click()
                        assert page.locator("#scenario").is_visible(), outcome
                    page.locator("#scenario").select_option("approved")
                    page.locator("#next").click()
                    assert "Cliente Demonstração" in page.locator("#screen").inner_text()
                    page.locator("#next").click()
                    page.locator("#business").fill("Empresa Fictícia QA")
                    page.locator("#feedback summary").click()
                    page.locator("#notes").fill("Simulação sem dados reais.")
                    page.locator("#next").click()
                    with page.expect_download() as download:
                        page.locator("#next").click()
                    report = json.loads(Path(download.value.path()).read_text())
                    assert report["service"] == product
                    assert report["paymentScenario"] == "approved"
                    for field in (
                        "realAccountCreated", "realContractAccepted",
                        "realPaymentProcessed", "realOrderCreated",
                        "realBriefingSubmitted",
                    ):
                        assert report[field] is False, field
                    assert not page_errors, page_errors
                    assert not blocked_externals, blocked_externals
                    page.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
        thread.join(timeout=5)
print("PASS: four commercial offer buttons reached the complete nine-stage "
      "fictional Portal journey via real 127.0.0.1 HTTP; no external requests.")
