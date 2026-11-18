"""CI-only V5 quotes through the four real Comercial -> Portal CTA links.

The reviewed HTTPS links are checked before only their origin is replaced in
the disposable browser DOM. Requests stay on the two literal loopback ports.
No price, channel, auth session or catalog is injected into the application.
The companion SQL checks the five persisted quotes and zero Sandbox intents.
"""

import os
import re
import shutil
import uuid
from datetime import datetime, timedelta
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright


COMMERCIAL = "http://127.0.0.1:18084/"
PORTAL_LOOPBACK = "http://127.0.0.1:18083"
PORTAL = PORTAL_LOOPBACK + "/_preview/portal"
PORTAL_ORIGIN = "https://portal-dev.imaginecomunica.com.br"
EXPECTED = {
    "onepage": "/_preview/portal/shop?product=onepage",
    "landing-pages": "/_preview/portal/shop?product=landing-pages",
    "gestao-google-ads": "/_preview/portal/shop?product=performance&channel=google_ads",
    "gestao-meta-ads": "/_preview/portal/shop?product=performance&channel=meta_ads",
}
# approved-catalog.json at reviewed V5 b90f6d8d30fe82509823e9eeee903446140857db.
# This independent pin must agree with BOTH the HTTP form and persisted quotes.
CATALOG_SHA256 = "75aab147df8d937f6f0630c92eec8b4783dc345e308292abe7706bcb31a905fa"
PASSWORD = "ci-v5-crossrepo-synthetic-only-2026"
CHECKS = 0
VISITED = set()


def check(condition, message):
    global CHECKS
    if not condition:
        raise AssertionError(message)
    CHECKS += 1


def text(page):
    return " ".join(page.locator("body").inner_text().split())


def local_request(page, method, url, form=None):
    # Playwright API requests do not use browser route interception. Keep these
    # requests independently local and do not follow any response redirect.
    parsed = urlsplit(url)
    check(parsed.scheme == "http" and parsed.netloc == "127.0.0.1:18083"
          and parsed.path.startswith("/_preview/portal/")
          and not parsed.query and not parsed.fragment,
          "API request must stay on the literal Portal loopback endpoint")
    if method == "GET":
        return page.request.get(url, max_redirects=0)
    check(method == "POST", "Only the reviewed GET/POST requests are allowed")
    return page.request.post(url, form=form, max_redirects=0,
                             headers={"Accept": "application/json"})


def from_commercial(page, slug):
    check(page.goto(COMMERCIAL, wait_until="domcontentloaded").status == 200,
          "Compiled Comercial must respond successfully")
    check(page.locator("[data-quick-hire]").count() == 7,
          "The seven editorial service cards must remain present")
    for service, destination in EXPECTED.items():
        link = page.locator(f'[data-quick-hire="{service}"] [data-quick-hire-action]')
        check(link.count() == 1, "Each approved Portal CTA must be unique")
        check(link.get_attribute("href") == PORTAL_ORIGIN + destination,
              "The original Portal CTA must exactly match its reviewed HTTPS URL")
        check(link.get_attribute("target") is None,
              "The reviewed Portal CTA must keep its same-tab behavior")
    chatgpt = page.locator('[data-quick-hire="gestao-chatgpt-ads"] [data-quick-hire-action]')
    check(chatgpt.count() == 1
          and (chatgpt.get_attribute("href") or "").startswith("https://wa.me/"),
          "ChatGPT Ads must retain its existing contact-only destination")
    link = page.locator(f'[data-quick-hire="{slug}"] [data-quick-hire-action]')
    original = urlsplit(link.get_attribute("href"))
    check(original.scheme == "https" and original.netloc == "portal-dev.imaginecomunica.com.br"
          and original.username is None and original.password is None and not original.fragment,
          "No unreviewed Portal host, credentials or fragment may enter the journey")
    destination = PORTAL_LOOPBACK + original.path + "?" + original.query
    link.evaluate("(element, url) => element.setAttribute('href', url)", destination)
    link.click()
    check(page.url.startswith(PORTAL + "/") or page.url == PORTAL,
          "The real CTA path/query must reach the loopback Portal")
    VISITED.add(slug)


def submit_account(page, label):
    # A click only waits for navigation commit. Capture the real redirected
    # document and wait for its DOM before inspecting the server-rendered form.
    # This observes the auth result; it never navigates to reconstruct context.
    with page.expect_response(lambda response: response.request.is_navigation_request()
                              and response.request.method == "GET"
                              and response.request.frame == page.main_frame) as arrived:
        page.get_by_role("button", name=label, exact=True).click()
    check(arrived.value.status == 200, "Account entry must return a successful document")
    page.wait_for_load_state("domcontentloaded")


def signup(page):
    check(page.url.rstrip("/") == PORTAL, "Anonymous CTA must reach login")
    page.get_by_role("link", name="Criar minha conta de teste", exact=True).click()
    check(page.url == PORTAL + "/register", "Use the real registration link")
    username = "demo-v5-cross-" + uuid.uuid4().hex[:10]
    for name, value in {
        "name": "Pessoa ficticia V5",
        "company": "Empresa ficticia CI",
        "username": username,
        "password": PASSWORD,
        "password_confirmation": PASSWORD,
    }.items():
        page.locator(f'[name="{name}"]').fill(value)
    submit_account(page, "Criar conta e continuar")
    return username


def login(page, username):
    check(page.url.rstrip("/") == PORTAL, "Login must start on the real Portal login page")
    page.locator('[name="username"]').fill(username)
    page.locator('[name="password"]').fill(PASSWORD)
    submit_account(page, "Entrar")


def logout(page):
    page.goto(PORTAL)
    page.get_by_role("button", name="Sair", exact=True).click()
    check(page.url.rstrip("/") == PORTAL, "Logout must invalidate the current customer session")


def selection(page, slug, channel=None):
    # Assert the result of registration/login BEFORE any new shop navigation.
    # Reconstructing the lost channel here would hide the original regression.
    check(page.url == PORTAL_LOOPBACK + EXPECTED[slug],
          "Product and visual channel must survive the actual auth handoff")
    page.wait_for_load_state("domcontentloaded")
    form = page.locator(f'form[action="{PORTAL}/shop/orders"]')
    check(form.count() == 1, "Exactly one selected product form is expected")
    product = "performance" if channel else slug
    check(form.locator('[name="product"]').input_value() == product,
          "The selected product must match its original CTA")
    check(form.locator('[name="offer_version"]').input_value() == CATALOG_SHA256,
          "HTTP offer_version must match the independently reviewed V5 catalog")
    check(page.locator('input[name="channel"]').count() == 0,
          "A visual channel hint must not become a submitted authorization field")
    if channel:
        check(page.locator("[data-channel-origin]").count() == 1
              and page.locator(f'[data-channel-origin="{channel}"]').count() == 1,
              "The channel notice must match the original CTA")
        check("nenhum investimento foi preenchido automaticamente" in text(page),
              "The Portal must explain the non-authorizing visual context")
        for field in ("google_media", "meta_media"):
            check(form.locator(f'[name="{field}"]').input_value() == "",
                  "CTA context must not autofill either media budget")
    else:
        check(page.locator("[data-channel-origin]").count() == 0,
              "A site selection must not retain an earlier Performance channel")
    return form


def submission(form):
    values = {name: form.locator(f'[name="{name}"]').input_value()
              for name in ("_token", "product", "request_key", "offer_version")}
    values.update({"offer_ack": "1", "google_media": "1000", "meta_media": ""})
    return values


def create(page):
    page.locator('input[name="offer_ack"]').check()
    with page.expect_response(lambda response: response.request.method == "POST"
                              and response.url == PORTAL + "/shop/orders") as submitted:
        page.get_by_role("button", name="Criar pedido de teste", exact=True).click()
    check(submitted.value.status == 302, "Accepted server quote must redirect to its order")
    order_url = re.compile(re.escape(PORTAL) + r"/shop/orders/TEST-[a-f0-9]{32}$")
    page.wait_for_url(order_url, wait_until="domcontentloaded")
    check(order_url.fullmatch(page.url) is not None,
          "The server must return an actual persisted order ID")
    check(page.get_by_role("heading", name="Seu pedido de teste", exact=True).count() == 1,
          "The order must be displayed by the real Portal controller")
    return page.url


def amount(page, label, expected):
    term = page.get_by_text(label, exact=True)
    check(term.count() == 1, "The quoted financial label must be unambiguous")
    check(term.locator("xpath=following-sibling::dd[1]").inner_text().strip() == expected,
          "The amount must belong to the correct server-rendered financial label")


def performance(page, channel):
    google = channel == "google_ads"
    label = "Mídia Google Ads — pagar ao canal" if google else "Mídia Meta (Instagram/Facebook) — pagar ao canal"
    check(page.locator("dt").filter(has_text=re.compile(r"^Mídia ")).count() == 1,
          "A single-channel CTA order must contain only the explicitly filled budget")
    amount(page, label, "R$ 1.000,00" if google else "R$ 700,00")
    amount(page, "Ativação única dos canais selecionados (R$ 490 por canal)", "R$ 490,00")
    amount(page, "Gestão mensal estimada — 20% ou R$ 170 por canal (o maior, mês completo)",
           "R$ 200,00" if google else "R$ 170,00")
    body = text(page)
    check("paga-se apenas a ativação dos canais na contratação" in body
          and "A gestão é apurada após o mês civil" in body
          and "A verba dos anúncios é paga diretamente ao Google ou à Meta" in body,
          "V5 activation, postpaid management and external media must remain distinct")
    check("R$ 140,00" not in body and "honorários antecipados" not in body
          and "Assinatura obrigatória" not in body and "R$ 79,90" not in body,
          "Performance must not inherit the legacy advance or site subscription")


def site(page, total, installment):
    body = text(page)
    for expected in ("Implantação: " + total, "na contratação", "após 30 dias", "após 60 dias",
                     "Assinatura obrigatória de R$ 79,90/mês",
                     "90 dias após a contratação, independentemente da publicação"):
        check(expected in body, "The approved site installment/subscription terms must be visible")
    accepted = re.search(r"Condições registradas neste pedido em (.+?)\. A simulação", body)
    check(accepted is not None, "The accepted quote must expose its persisted acceptance timestamp")
    timestamp = datetime.fromisoformat(accepted.group(1))
    check(timestamp.utcoffset() is not None, "Acceptance must retain its timezone")
    anchor = timestamp.astimezone(ZoneInfo("America/Sao_Paulo")).date()
    details = page.locator("details")
    check(details.count() == 1, "A site order must expose its projected billing schedule")
    details.locator("summary").click()
    rows = [row.locator("td").all_inner_texts() for row in details.locator("tbody tr").all()]
    check(len(rows) == 15, "Three installments and twelve displayed monthly projections are required")
    for index, offset in enumerate((0, 30, 60)):
        check(rows[index] == ["Implantação", (anchor + timedelta(days=offset)).strftime("%d/%m/%Y"), installment],
              "HTTP installment date and amount must match D0/D30/D60 from acceptance")
    check(rows[3] == ["Mensalidade", (anchor + timedelta(days=90)).strftime("%d/%m/%Y"), "R$ 79,90"],
          "The first monthly projection must begin at acceptance D90")
    check(all(len(row) == 3 and row[0] == "Mensalidade" and row[2] == "R$ 79,90" for row in rows[3:]),
          "All displayed subscription projections must retain the approved monthly amount")


def sandbox_disabled(page, order_url, product_label):
    check(page.get_by_role("button", name="Gerar cobrança no Asaas sandbox", exact=True).count() == 0,
          "This V5 offer must not expose an enabled Sandbox checkout")
    check("ainda não está habilitado nesta demonstração para " + product_label in text(page),
          "The Portal must explain the existing Sandbox gate")
    payload = {"_token": page.locator('input[name="_token"]').first.input_value(),
               "revision": page.locator('input[name="revision"]').first.input_value(),
               "sandbox_ack": "1"}
    check(local_request(page, "POST", order_url + "/sandbox", payload).status == 409,
          "A crafted but otherwise valid Sandbox request must remain unavailable")


def owned_orders(page, urls):
    check(page.goto(PORTAL + "/client/services").status == 200, "Customer order list must load")
    actual = page.locator("tr[data-customer-order]").evaluate_all(
        "rows => rows.map(row => row.getAttribute('data-customer-order'))")
    check(sorted(actual) == sorted(url.rsplit("/", 1)[1] for url in urls),
          "The real customer panel must show exactly this owner's persisted orders")


def main():
    check(os.environ.get("GITHUB_ACTIONS") == "true", "GitHub Actions only")
    check(os.environ.get("RUNNER_ENVIRONMENT") == "github-hosted", "Disposable GitHub-hosted runner only")
    check(os.environ.get("IMAGINE_CROSSREPO_V5_LOOPBACK") == "1", "Explicit V5 loopback test opt-in required")
    chrome = shutil.which("google-chrome") or shutil.which("chromium")
    check(chrome is not None, "System Chromium or Google Chrome required")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=chrome, headless=True, args=["--no-sandbox"])
        context = browser.new_context(viewport={"width": 1280, "height": 900}, service_workers="block")
        blocked = []

        def loopback_only(route):
            url = urlsplit(route.request.url)
            if url.scheme in ("http", "https") and not (
                url.scheme == "http" and url.netloc in ("127.0.0.1:18083", "127.0.0.1:18084")
            ):
                blocked.append(url.hostname)
                route.abort()
            else:
                route.continue_()

        context.route("**/*", loopback_only)
        page = context.new_page()
        try:
            # New customer: Google channel must survive the real signup flow.
            from_commercial(page, "gestao-google-ads")
            owner_a = signup(page)
            form = selection(page, "gestao-google-ads", "google_ads")
            payload = submission(form)
            check(local_request(page, "POST", PORTAL + "/shop/orders", {**payload, "google_media": "700"}).status == 422,
                  "The legacy Google R$700 floor must not be accepted by V5 HTTP")
            for field, value in (("amount_now_cents", "1"), ("pricing_policy", "legacy-prepaid")):
                check(local_request(page, "POST", PORTAL + "/shop/orders", {**payload, field: value}).status == 422,
                      "Client-supplied amount/policy must be rejected independently")
            form.locator('[name="google_media"]').fill("1000")
            google = create(page)
            performance(page, "google_ads")
            page.reload()
            performance(page, "google_ads")
            sandbox_disabled(page, google, "Performance")

            # Returning customer: Meta context must survive logout and login.
            logout(page)
            from_commercial(page, "gestao-meta-ads")
            login(page, owner_a)
            form = selection(page, "gestao-meta-ads", "meta_ads")
            form.locator('[name="meta_media"]').fill("700")
            meta = create(page)
            performance(page, "meta_ads")
            page.reload()
            performance(page, "meta_ads")

            from_commercial(page, "onepage")
            selection(page, "onepage")
            onepage = create(page)
            site(page, "R$ 990,00", "R$ 330,00")
            page.reload()
            site(page, "R$ 990,00", "R$ 330,00")

            from_commercial(page, "landing-pages")
            selection(page, "landing-pages")
            landing = create(page)
            site(page, "R$ 1.290,00", "R$ 430,00")
            page.reload()
            site(page, "R$ 1.290,00", "R$ 430,00")
            sandbox_disabled(page, landing, "Landing Page")
            first_orders = (google, meta, onepage, landing)
            check(len(set(first_orders)) == 4, "The four CTAs must persist four distinct orders")
            owned_orders(page, first_orders)

            # Same company, distinct legitimate customer: own positive control,
            # four foreign GETs and four foreign mutations must remain isolated.
            logout(page)
            from_commercial(page, "gestao-google-ads")
            owner_b = signup(page)
            check(owner_b != owner_a, "The second customer must be distinct")
            selection(page, "gestao-google-ads", "google_ads")
            csrf = page.locator('input[name="_token"]').first.input_value()
            owned_orders(page, ())
            for order in first_orders:
                check(local_request(page, "GET", order).status == 404, "A second customer must not read a foreign order")
                check(local_request(page, "POST", order + "/payment", {
                    "_token": csrf, "revision": "0", "outcome": "approved", "sample_ack": "1"
                }).status == 404, "A second customer must not mutate a foreign order")
            from_commercial(page, "gestao-google-ads")
            form = selection(page, "gestao-google-ads", "google_ads")
            form.locator('[name="google_media"]').fill("1000")
            second_order = create(page)
            performance(page, "google_ads")
            check(second_order not in first_orders, "The second owner must have its own order")
            check(local_request(page, "GET", second_order).status == 200, "An owner must be able to read its own order")
            owned_orders(page, (second_order,))
            logout(page)
            login(page, owner_a)
            owned_orders(page, first_orders)
            check(local_request(page, "GET", second_order).status == 404, "Isolation must also hold in the reverse direction")
            check(VISITED == set(EXPECTED), "All four real CTA routes must be exercised")
            check(not blocked, "Unexpected external or non-approved loopback network request")
            print(f"PASS V5 cross-repo HTTP/Chromium: {CHECKS} checks; four real CTAs; signup/login channel context; "
                  "five owned server quotes; V5 prices and D0/D30/D60/D90; financial spoof/foreign access/Sandbox gates; NO PSP/DEPLOY")
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
