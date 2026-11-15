#!/usr/bin/env python3
"""HTTP acceptance checks against the dedicated demo container on loopback only."""
import http.client
import os
import re
import unittest
import urllib.parse
from html.parser import HTMLParser

BASE = '/simulacao/compra/'
HOST = 'comercial-dev.imaginecomunica.com.br'
PORT = int(os.environ.get('SIMULATION_TEST_PORT', '18085'))


class Inputs(HTMLParser):
    def __init__(self, body):
        super().__init__()
        self.values = {}
        self.feed(body)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'input' and a.get('name') and a.get('type') == 'hidden':
            self.values[a['name']] = a.get('value', '')


class Client:
    def __init__(self):
        self.cookie = ''
        self.body = ''
        self.headers = {}
        self.status = 0
        self.get()

    def request(self, path, data=None, follow=True):
        assert path.startswith(BASE) and not path.startswith('//')
        c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=15)
        headers = {'Host': HOST, 'Origin': 'https://' + HOST}
        if self.cookie:
            headers['Cookie'] = self.cookie
        payload = None
        if data is not None:
            payload = urllib.parse.urlencode(data, doseq=True)
            headers['Content-Type'] = 'application/x-www-form-urlencoded'
        c.request('POST' if data is not None else 'GET', path, payload, headers)
        r = c.getresponse()
        self.status = r.status
        self.headers = dict(r.getheaders())
        for key, value in r.getheaders():
            if key.lower() == 'set-cookie':
                self.cookie = value.split(';', 1)[0]
        self.body = r.read().decode()
        c.close()
        if follow and self.status == 303:
            return self.request(self.headers['Location'])
        return self.body

    def get(self, step='choose'):
        return self.request(BASE + '?step=' + step)

    def post(self, action, **data):
        data['action'] = action
        if 'csrf' not in data:
            data['csrf'] = Inputs(self.body).values['csrf']
        return self.request(BASE, data)

    def choose(self, site='onepage', channels=None, tier='minimum'):
        return self.post('choose', site=site, **{'channels[]': channels or []}, tier=tier)

    def create(self):
        self.get('account')
        self.post('account', mode='register')
        self.post('order', ack='yes')
        return Inputs(self.body).values['order_id']

    def payment(self, outcome):
        fields = Inputs(self.body).values
        self.post('pay', order_id=fields['order_id'], revision=fields['revision'], method='pix', outcome=outcome)


class Journey(unittest.TestCase):
    def test_combined_complete_pending_declined_approved_briefing(self):
        c = Client()
        c.choose(channels=['google_ads', 'meta_ads'])
        for text in ['Onepage', 'Google Ads', 'Instagram + Facebook', 'R$ 1.310,00', 'R$ 370,00', 'R$ 1.700,00']:
            self.assertIn(text, c.body)
        oid = c.create()
        self.assertRegex(oid, r'^DEMO-[A-F0-9]{10}$')
        c.get('briefing')
        self.assertIn('PAGAMENTO DEMONSTRATIVO', c.body)
        c.payment('pending')
        self.assertIn('Aguardando pagamento fictício', c.body)
        c.payment('declined')
        self.assertIn('Pagamento fictício recusado', c.body)
        self.assertIn(oid, c.body)
        stale = dict(Inputs(c.body).values)
        c.payment('approved')
        self.assertIn('Seu pedido está confirmado!', c.body)
        self.assertIn(oid, c.body)
        c.post('pay', csrf=stale['csrf'], order_id=oid, revision=stale['revision'], method='pix', outcome='declined')
        self.assertIn('PAGAMENTO FICTÍCIO APROVADO', c.body)
        c.get('briefing')
        c.post('briefing', goal='leads', style='modern')
        self.assertIn('Briefing salvo nesta sessão', c.body)
        self.assertIn('Concluído', c.body)
        c.get('panel')
        self.assertIn(oid, c.body)
        self.assertIn('Onepage', c.body)
        self.assertIn('Google Ads', c.body)
        self.assertIn('Instagram + Facebook', c.body)
        c.post('order', ack='yes')
        self.assertIn(oid, c.body)

    def test_selection_matrix_and_server_owned_amounts(self):
        for site in ['none', 'onepage', 'landing-pages']:
            for channels in [[], ['google_ads'], ['meta_ads'], ['google_ads', 'meta_ads']]:
                for tier in ['minimum', 'recommended']:
                    with self.subTest(site=site, channels=channels, tier=tier):
                        c = Client()
                        c.choose(site, channels, tier)
                        if site == 'none' and not channels:
                            self.assertIn('Escolha um site ou pelo menos um canal', c.body)
                            continue
                        expected = (330 if site == 'onepage' else 430 if site == 'landing-pages' else 0) + 490 * len(channels)
                        formatted = f'{expected:,.2f}'.replace(',', 'x').replace('.', ',').replace('x', '.')
                        self.assertIn('R$ ' + formatted, c.body)
                        for ch in channels:
                            self.assertIn('Google Ads' if ch == 'google_ads' else 'Instagram + Facebook', c.body)
        c = Client()
        c.post('choose', site='onepage', tier='minimum', now='1', price='1')
        self.assertIn('R$ 330,00', c.body)

    def test_csrf_and_foreign_order_rejection(self):
        a, b = Client(), Client()
        a.choose()
        oid = a.create()
        b.choose('landing-pages')
        own = b.create()
        fields = Inputs(b.body).values
        b.post('pay', order_id=oid, revision=fields['revision'], method='pix', outcome='approved')
        self.assertIn('O pedido não pertence a esta sessão', b.body)
        b.get('panel')
        self.assertIn(own, b.body)
        self.assertNotIn(oid, b.body)
        b.post('new', csrf='bad-token')
        self.assertEqual(b.status, 419)

    def test_invalid_channels_and_no_premature_briefing(self):
        for channels in [['chatgpt_ads'], ['google_ads', 'google_ads'], ['google_ads', 'meta_ads', 'other']]:
            c = Client()
            c.choose(channels=channels)
            self.assertIn('role="alert"', c.body)
        c = Client()
        c.post('briefing', goal='leads', style='modern')
        self.assertIn('briefing só é liberado', c.body)
        c.choose()
        c.create()
        c.post('briefing', goal='leads', style='modern')
        self.assertIn('briefing só é liberado', c.body)

    def test_security_headers_and_isolation(self):
        c = Client()
        headers = {k.lower(): v for k, v in c.headers.items()}
        self.assertIn('no-store', headers['cache-control'])
        self.assertIn('noindex', headers['x-robots-tag'])
        self.assertIn("connect-src 'none'", headers['content-security-policy'])
        cookie = headers['set-cookie'].lower()
        for flag in ['secure', 'httponly', 'samesite=lax']:
            self.assertIn(flag, cookie)
        conn = http.client.HTTPConnection('127.0.0.1', PORT, timeout=15)
        conn.request('GET', BASE, headers={'Host': 'production.invalid'})
        r = conn.getresponse()
        self.assertEqual(r.status, 404)
        r.read()
        conn.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
