"""Update only the already-authorized private Commercial preview from Portal terms.
No public production target, DNS, financial integration or customer data.
"""
import argparse,datetime,hashlib,json,os,pathlib,re,stat
POLICY='performance-postpaid-170-per-channel-2026-11-14'
PREVIEW=pathlib.Path('/var/www/imagine-dev-previews/comercial-dev.imaginecomunica.com.br/index.html')
CATALOG=pathlib.Path('/srv/imagine/purchase-preview/apps/portal/app/Homologation/Commerce/approved-catalog.json')
BASE='https://portal-dev.imaginecomunica.com.br/_preview/portal/shop?product=performance'

def transform(source,offer):
 if offer.get('pricing_policy')!=POLICY or offer.get('management_fee_basis_points')!=2000 or offer.get('activation_per_channel_cents')!=49000 or offer.get('minimum_management_fee_per_channel_cents')!=17000:
  raise RuntimeError('Unexpected Portal policy; manual review required')
 counts={};changed=0
 def card(match):
  nonlocal changed
  article=match.group(0)
  keys=[slug for slug in ('gestao-google-ads','gestao-meta-ads') if 'data-quick-hire="'+slug+'"' in article]
  if not keys:return article
  if len(keys)!=1:raise RuntimeError('Ambiguous private card')
  slug=keys[0];counts[slug]=counts.get(slug,0)+1
  channel='google_ads' if slug=='gestao-google-ads' else 'meta_ads'
  if 'data-performance-policy="'+POLICY+'"' in article:
   if BASE+'&amp;channel='+channel not in article:raise RuntimeError('Inconsistent existing copy')
   return article
  if article.count('href="'+BASE+'"')!=1 or article.count('</h3>')!=1:
   raise RuntimeError('Private card changed; manual review required')
  article=article.replace('href="'+BASE+'"','href="'+BASE+'&amp;channel='+channel+'"')
  markup='<p data-performance-policy="'+POLICY+'"><strong>Gestão a partir de R$170/mês por canal.</strong><br>20% do investimento realizado, com mínimo de R$170. Cobrança após a apuração mensal.<br><strong>Ativação única: R$490 por canal.</strong> Verba de anúncios paga diretamente às plataformas.</p>'
  article=article.replace('</h3>','</h3>'+markup,1);changed+=1
  return article
 result=re.sub(r'<article\b[^>]*>.*?</article>',card,source,flags=re.S)
 if counts!={'gestao-google-ads':1,'gestao-meta-ads':1}:raise RuntimeError('Expected exactly two private channel cards')
 return result,changed

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
 if PREVIEW.is_symlink() or PREVIEW.resolve()!=PREVIEW:raise SystemExit('Unexpected preview path')
 before=PREVIEW.read_bytes();meta=PREVIEW.stat()
 catalog=json.loads(CATALOG.read_text());offer=next(o for o in catalog['offers'] if o['id']=='performance')
 after,changed=transform(before.decode(),offer)
 if args.apply and changed:
  if os.geteuid()!=0:raise SystemExit('Private preview operator required')
  if PREVIEW.read_bytes()!=before:raise SystemExit('Concurrent preview update; retry only after review')
  stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
  backup=pathlib.Path('/root/imagine-commercial-before-postpaid-'+stamp+'.html')
  fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'wb') as out:out.write(before)
  candidate=PREVIEW.with_name('index.postpaid-review.tmp')
  fd=os.open(candidate,os.O_WRONLY|os.O_CREAT|os.O_EXCL,stat.S_IMODE(meta.st_mode))
  with os.fdopen(fd,'w') as out:out.write(after)
  os.chown(candidate,meta.st_uid,meta.st_gid);os.chmod(candidate,stat.S_IMODE(meta.st_mode))
  if PREVIEW.read_bytes()!=before:candidate.unlink();raise SystemExit('Concurrent preview update; source preserved')
  os.replace(candidate,PREVIEW)
 print('PASS private Commercial postpaid copy; channel cards:',changed,'applied:',bool(args.apply),'source SHA256:',hashlib.sha256(before).hexdigest())
