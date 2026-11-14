"""CI-only browser journey across compiled Comercial and Portal Laravel/PostgreSQL.

Only loopback ports 18084 (Comercial) and 18083 (Portal) are visited.
The four original HTTPS Portal CTA URLs are checked exactly, then mapped
IN MEMORY to loopback for CI navigation. No DNS, VPS, Asaas or real identities.
"""
import os
import uuid
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

assert os.environ.get("GITHUB_ACTIONS") == "true", "CI only"
assert os.environ.get("IMAGINE_CROSSREPO_LOOPBACK") == "1", "Explicit test opt-in"
COMMERCIAL = "http://127.0.0.1:18084/"
PORTAL = "http://127.0.0.1:18083/_preview/portal"
PORTAL_ORIGIN = "https://portal-dev.imaginecomunica.com.br"
EXPECTED = {
    "onepage": "/_preview/portal/shop?product=onepage",
    "landing-pages": "/_preview/portal/shop?product=landing-pages",
    "gestao-google-ads": "/_preview/portal/shop?product=performance&channel=google_ads",
    "gestao-meta-ads": "/_preview/portal/shop?product=performance&channel=meta_ads",
}
PASSWORD = "ci-crossrepo-synthetic-only-2026"

def from_commercial(page, slug):
    assert page.goto(COMMERCIAL, wait_until="domcontentloaded").status == 200
    assert page.locator("[data-quick-hire]").count() == 6
    for public in ("criacao-de-sites", "sites-por-assinatura"):
        a = page.locator('[data-quick-hire="' + public + '"] [data-quick-hire-action]')
        assert a.count() == 1
        assert a.get_attribute("target") == "_blank"
        assert "noopener" in (a.get_attribute("rel") or "")
    a = page.locator('[data-quick-hire="' + slug + '"] [data-quick-hire-action]')
    assert a.count() == 1
    original_href = a.get_attribute("href")
    assert original_href == PORTAL_ORIGIN + EXPECTED[slug], (slug, original_href)
    parsed = urlsplit(original_href)
    assert parsed.scheme == "https" and parsed.netloc == "portal-dev.imaginecomunica.com.br"
    assert parsed.username is None and parsed.password is None and not parsed.fragment
    assert a.get_attribute("target") is None
    # The real link is never visited. This changes the in-memory DOM on a
    # disposable CI Chromium page, preserving the path/query exactly.
    local_destination = "http://127.0.0.1:18083" + parsed.path + "?" + parsed.query
    a.evaluate("(element, destination) => element.setAttribute('href', destination)", local_destination)
    a.click()
    assert page.url.startswith(PORTAL), (slug, page.url)

def accept_and_create(page, price):
    assert price in page.locator("body").inner_text(), price
    page.locator('input[name="offer_ack"]').check()
    page.get_by_role("button", name="Criar pedido de teste").click()
    assert "/shop/orders/" in page.url, page.url
    return page.url

def signup(page):
    page.goto(PORTAL + "/register")
    user = "demo-cross-" + uuid.uuid4().hex[:10]
    for name, value in {
        "name": "Pessoa de teste",
        "company": "Empresa ficticia CI",
        "username": user,
        "password": PASSWORD,
        "password_confirmation": PASSWORD,
    }.items():
        page.locator('[name="' + name + '"]').fill(value)
    page.get_by_role("button", name="Criar conta e continuar").click()
    return user

with sync_playwright() as p:
    chrome = __import__("shutil").which("google-chrome") or __import__("shutil").which("chromium")
    assert chrome, "System Chromium or Google Chrome required"
    browser = p.chromium.launch(executable_path=chrome, headless=True, args=["--no-sandbox"])
    context = browser.new_context(viewport={"width":1280,"height":900})
    blocked = []
    def loopback_only(route):
        url = urlsplit(route.request.url)
        if url.scheme in ("http","https") and url.hostname != "127.0.0.1":
            blocked.append(url.hostname)
            route.abort()
        else:
            route.continue_()
    context.route("**/*", loopback_only)
    page = context.new_page()
    try:
        from_commercial(page, "onepage")
        assert page.url.rstrip("/") == PORTAL
        signup(page)
        assert page.url.endswith("/shop?product=onepage"), page.url
        onepage = accept_and_create(page, "R$ 990,00")
        assert "R$ 330,00" in page.locator("body").inner_text()
        # One complete *fake* settlement and briefing, never an Asaas payment.
        page.locator('[name="sample_ack"]').check()
        page.locator('[name="outcome"]').select_option("approved")
        page.get_by_role("button", name="Aplicar resultado de teste").click()
        for key in ("business","goal","audience","materials"):
            page.locator('[name="' + key + '"]').fill("Exemplo CI")
        page.get_by_role("button", name="Salvar briefing de teste").click()
        assert "Briefing salvo no Portal de teste" in page.locator("body").inner_text()
        from_commercial(page, "landing-pages")
        assert page.url.endswith("/shop?product=landing-pages"), page.url
        landing = accept_and_create(page, "R$ 1.290,00")
        assert "R$ 430,00" in page.locator("body").inner_text()
        for slug, channel in (("gestao-google-ads","google_ads"),("gestao-meta-ads","meta_ads")):
            from_commercial(page, slug)
            assert page.url.endswith(EXPECTED[slug]), page.url
            assert page.locator('[data-channel-origin="' + channel + '"]').count() == 1
            assert page.locator('[name="google_media"]').input_value() == ""
            assert page.locator('[name="meta_media"]').input_value() == ""
            field = "google_media" if channel == "google_ads" else "meta_media"
            page.locator('[name="' + field + '"]').fill("700")
            order = accept_and_create(page, "20%")
            assert "R$ 140,00" in page.locator("body").inner_text(), slug
            assert "R$ 700,00" in page.locator("body").inner_text(), slug
            assert order not in (onepage, landing)
        page.goto(PORTAL + "/client/services")
        assert page.locator('tr[data-customer-order]').count() == 4
        assert not blocked, "Unexpected external network requests: " + str(blocked)
        print("PASS real loopback HTTP/Chromium: Comercial 4 CTAs -> individual Portal account -> 4 PostgreSQL18 orders, approved server quotes, one fictional briefing; NO PSP/DEPLOY")
    finally:
        context.close()
        browser.close()
