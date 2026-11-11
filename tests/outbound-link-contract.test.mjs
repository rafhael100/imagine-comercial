import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contactChannels,contactWhatsAppUrl,contactEmailUrl
} from '../src/data/contact-channels.mjs';
import {auditApprovedOutboundLinks as audit}
  from '../src/lib/outbound-link-contract.mjs';

const page=anchors=>'<main>'+anchors.join('')+'</main>';
const a=(href,extra='')=>'<a href="'+href+'" '+extra+'>Acessar</a>';

test('F149 approves only curated WhatsApp, email, telephone and Portal link',()=>{
  const html=page([
    a(contactWhatsAppUrl(),'target="_blank" rel="noopener noreferrer"'),
    a(contactEmailUrl()),
    a('mailto:'+contactChannels.email),
    a('tel:'+contactChannels.phoneE164),
    a('https://portal.imaginecomunicacao.com.br/login','rel="noopener"'),
    a('/contato/'),a('#conteudo')
  ]);
  assert.deepEqual(audit(html),{
    externalLinksChecked:5,
    networkPerformed:false
  });
});
test('F149 blocks unapproved destinations, userinfo and URL exfiltration',()=>{
  for(const href of [
    'https://evil.invalid/','https://wa.me.attacker.invalid/',
    'https://wa.me/5585996632689?text=PERSONAL-SECRET-F149',
    'https://wa.me/5585996632689?text=Ol%C3%A1%2C%20Imagine&extra=1',
    'https://wa.me/5511999999999',
    'https://user@portal.imaginecomunicacao.com.br/login',
    'https://portal.imaginecomunicacao.com.br/login?token=secret',
    'https://portal.imaginecomunicacao.com.br/a/../login',
    'mailto:unauthorized@evil.invalid',
    'mailto:'+contactChannels.email+'?subject=PERSONAL-SECRET',
    'tel:+5511999999999','javascript:alert(1)',
    'data:text/html,PHISH','http://wa.me/5585996632689'
  ])assert.throws(()=>audit(page([a(href)])),
    /external destination is not an approved/,href);
});
test('F149 requires isolated new tabs for external channels',()=>{
  for(const extra of [
    'target="_blank"',
    'target="_blank" rel="noopener"',
    'target="_blank" rel="noreferrer"'
  ])assert.throws(()=>audit(page([a(contactWhatsAppUrl(),extra)])),
    /lacks isolation/);
  assert.equal(audit(page([a(contactWhatsAppUrl(),
    'target="_blank" rel="noopener noreferrer"')])).externalLinksChecked,1);
});
test('F149 never exposes an invalid external URL in the error message',()=>{
  try{
    audit(page([a('https://evil.invalid/PERSONAL-SECRET-F149')]));
    assert.fail('must refuse bad domain');
  }catch(e){assert.doesNotMatch(String(e),/PERSONAL-SECRET-F149/);}
});
