from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/google-chrome'),headless=True,args=['--no-sandbox'])
    for product in ['onepage','landing-pages','performance']:
        page=browser.new_page(viewport={'width':1280,'height':900},accept_downloads=True)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto((root/'index.html').as_uri()+'#'+product)
        assert page.locator('[data-offer="'+product+'"]').get_attribute('aria-pressed')=='true'
        page.locator('#next').click();page.locator('#next').click();page.locator('#next').click()
        page.locator('#next').click();assert page.locator('#error').inner_text()
        page.locator('#reviewed').check();page.locator('#next').click()
        page.locator('#next').click();assert page.locator('#error').inner_text()
        page.locator('#contract').check();page.locator('#next').click()
        for scenario in ['pending','declined']:
            page.locator('#scenario').select_option(scenario);page.locator('#next').click()
            assert page.locator('#scenario').is_visible()
            assert page.locator('#payment-status').inner_text()
            assert 'Etapa 6' in page.locator('#step-count').inner_text()
        page.locator('#scenario').select_option('approved');page.locator('#next').click()
        assert 'Cliente Demonstração' in page.locator('#screen').inner_text()
        page.locator('#next').click()
        page.locator('#business').fill('');page.locator('#next').click();assert page.locator('#error').inner_text()
        page.locator('#business').fill('<img src=x onerror=alert(1)>')
        page.locator('#feedback summary').click();page.locator('#notes').fill('Rever briefing fictício')
        page.locator('#next').click()
        assert page.locator('#screen img').count()==0
        with page.expect_download() as download:page.locator('#next').click()
        data=json.loads(Path(download.value.path()).read_text())
        assert data['service']==product and data['paymentScenario']=='approved'
        for key in ['realAccountCreated','realContractAccepted','realPaymentProcessed','realOrderCreated','realBriefingSubmitted']:
            assert data[key] is False
        assert data['notes'][7]['note']=='Rever briefing fictício'
        for width in [320,390,768,1280]:
            page.set_viewport_size({'width':width,'height':900})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+2'), (product,width,page.evaluate('document.documentElement.scrollWidth'))
        assert not errors,errors
        page.close()
    browser.close()
print('PASS complete simulated purchase for 3 services: mandatory review, contract example, pending/declined denial, approved scenario, Portal, briefing, HTML escaping and feedback report.')
