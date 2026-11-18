-- CI-only companion to test-crossrepo-v5-browser-http.py, on a NEW PG18.
-- Verifies actual browser-created quotes, then exercises signed owner RLS.
-- No schema/policy changes, provider calls, new charges or persistent writes.
\set ON_ERROR_STOP on
BEGIN;

DO $quotes$
DECLARE
 o record;
 expected jsonb;
 reviewed_version constant text := '75aab147df8d937f6f0630c92eec8b4783dc345e308292abe7706bcb31a905fa';
BEGIN
 IF current_database()<>'portal_purchase_rehearsal'
    OR current_setting('server_version_num')::integer / 10000<>18
 THEN RAISE EXCEPTION 'Requires the disposable portal_purchase_rehearsal PG18 database'; END IF;
 IF (SELECT count(*) FROM purchase_rehearsal.customer_orders)<>5
    OR (SELECT count(DISTINCT customer_id) FROM purchase_rehearsal.customer_orders)<>2
 THEN RAISE EXCEPTION 'Expected exactly five browser orders owned by two customers'; END IF;
 IF NOT EXISTS (SELECT FROM pg_class
     WHERE oid='purchase_rehearsal.customer_orders'::regclass
       AND relrowsecurity AND relforcerowsecurity)
 THEN RAISE EXCEPTION 'Customer order FORCE RLS is required'; END IF;
 IF EXISTS (SELECT FROM purchase_rehearsal.sandbox_payment_intents)
 THEN RAISE EXCEPTION 'V5 HTTP quote proof must not queue any Sandbox payment'; END IF;
 IF EXISTS (SELECT FROM purchase_rehearsal.customer_orders
     WHERE payment IS DISTINCT FROM 'pending' OR payment_source IS DISTINCT FROM 'manual_test'
       OR revision<>0 OR briefing IS NOT NULL OR offer_accepted_at IS NULL)
 THEN RAISE EXCEPTION 'Quote-only orders must stay pending, unchanged and without a briefing'; END IF;

 -- Match complete server snapshots, not a browser price echo or an aggregate
 -- total that could hide a wrong fee/channel. The digest is independently
 -- pinned to approved-catalog.json in reviewed Portal V5 b90f6d8d30fe82509823e9eeee903446140857db.
 FOR o IN SELECT product,offer_snapshot FROM purchase_rehearsal.customer_orders LOOP
   expected := jsonb_build_object(
     'catalog_version',reviewed_version,'product',o.product,
     'currency','BRL','gateway','asaas','real_charge_enabled',false);
   IF o.product IN ('onepage','landing-pages') THEN
     expected := expected || jsonb_build_object(
       'setup_total_cents',CASE WHEN o.product='onepage' THEN 99000 ELSE 129000 END,
       'setup_charges',CASE WHEN o.product='onepage' THEN
         '[{"offset_days":0,"amount_cents":33000},{"offset_days":30,"amount_cents":33000},{"offset_days":60,"amount_cents":33000}]'::jsonb ELSE
         '[{"offset_days":0,"amount_cents":43000},{"offset_days":30,"amount_cents":43000},{"offset_days":60,"amount_cents":43000}]'::jsonb END,
       'monthly','{"amount_cents":7990,"mandatory":true,"first_due_offset_days":90,"anchor":"contract_acceptance","independent_of_publication":true}'::jsonb,
       'amount_now_cents',CASE WHEN o.product='onepage' THEN 33000 ELSE 43000 END);
   ELSIF o.product='performance' THEN
     IF o.offer_snapshot->'media_by_channel_cents' IS DISTINCT FROM '{"google_ads":100000}'::jsonb
        AND o.offer_snapshot->'media_by_channel_cents' IS DISTINCT FROM '{"meta_ads":70000}'::jsonb
     THEN RAISE EXCEPTION 'Unexpected or inherited channel/budget in a V5 HTTP order'; END IF;
     expected := expected || jsonb_build_object(
       'pricing_policy','performance-postpaid-170-per-channel-2026-11-14',
       'minimum_management_fee_per_channel_cents',17000,
       'activation_per_channel_cents',49000,'activation_total_cents',49000,
       'media_by_channel_cents',o.offer_snapshot->'media_by_channel_cents',
       'media_paid_directly_to_platforms',true,'management_fee_basis_points',2000,
       'estimated_management_fee_cents',CASE WHEN o.offer_snapshot->'media_by_channel_cents'='{"google_ads":100000}'::jsonb THEN 20000 ELSE 17000 END,
       'reference_period','monthly','amount_now_cents',49000,
       'settlement_policy','calendar_month_actual_spend_per_channel_floor_postpaid',
       'real_postpaid_invoice_authorized',false);
   ELSE
     RAISE EXCEPTION 'Unexpected product in the four-CTA proof';
   END IF;
   IF o.offer_snapshot IS DISTINCT FROM expected
   THEN RAISE EXCEPTION 'Persisted V5 quote differs from the approved complete snapshot'; END IF;
 END LOOP;

 IF (SELECT count(*) FROM purchase_rehearsal.customer_orders WHERE product='onepage')<>1
    OR (SELECT count(*) FROM purchase_rehearsal.customer_orders WHERE product='landing-pages')<>1
    OR (SELECT count(*) FROM purchase_rehearsal.customer_orders WHERE product='performance' AND offer_snapshot->'media_by_channel_cents'='{"google_ads":100000}'::jsonb)<>2
    OR (SELECT count(*) FROM purchase_rehearsal.customer_orders WHERE product='performance' AND offer_snapshot->'media_by_channel_cents'='{"meta_ads":70000}'::jsonb)<>1
 THEN RAISE EXCEPTION 'Expected Onepage, Landing, two Google and one Meta quotes'; END IF;
 IF (SELECT count(*) FROM (
       SELECT customer_id FROM purchase_rehearsal.customer_orders GROUP BY customer_id
       HAVING count(*)=4
         AND count(*) FILTER (WHERE product='onepage')=1
         AND count(*) FILTER (WHERE product='landing-pages')=1
         AND count(*) FILTER (WHERE offer_snapshot->'media_by_channel_cents'='{"google_ads":100000}'::jsonb)=1
         AND count(*) FILTER (WHERE offer_snapshot->'media_by_channel_cents'='{"meta_ads":70000}'::jsonb)=1
     ) first_owner)<>1
    OR (SELECT count(*) FROM (
       SELECT customer_id FROM purchase_rehearsal.customer_orders GROUP BY customer_id
       HAVING count(*)=1
         AND count(*) FILTER (WHERE product='performance' AND offer_snapshot->'media_by_channel_cents'='{"google_ads":100000}'::jsonb)=1
     ) second_owner)<>1
 THEN RAISE EXCEPTION 'Browser owners must retain their exact four/one quote sets'; END IF;
END $quotes$;

-- Derive genuine synthetic owners on the database-owner connection. Neither
-- the key, MAC nor customer ID is printed. They authenticate row ownership;
-- they are not a financial quote signature or production authorization.
SELECT o.customer_id AS owner,
       encode(purchase_rehearsal.hmac(
         convert_to('imagine-owned-preview-v1:'||o.customer_id,'UTF8'),s.key,'sha256'),'hex') AS mac
FROM purchase_rehearsal.customer_orders o
CROSS JOIN purchase_rehearsal.preview_scope_secret s
WHERE s.id=1 GROUP BY o.customer_id,s.key HAVING count(*)=4 \gset owner_a_
SELECT o.customer_id AS owner,
       encode(purchase_rehearsal.hmac(
         convert_to('imagine-owned-preview-v1:'||o.customer_id,'UTF8'),s.key,'sha256'),'hex') AS mac
FROM purchase_rehearsal.customer_orders o
CROSS JOIN purchase_rehearsal.preview_scope_secret s
WHERE s.id=1 GROUP BY o.customer_id,s.key HAVING count(*)=1 \gset owner_b_

SET SESSION AUTHORIZATION purchase_rehearsal_a;
SELECT set_config('imagine.preview_principal','',true),
       set_config('imagine.preview_mac','',true) \gset unsigned_
DO $unsigned$
BEGIN
 IF EXISTS (SELECT FROM purchase_rehearsal.customer_orders)
    OR EXISTS (SELECT FROM purchase_rehearsal.customers)
 THEN RAISE EXCEPTION 'Unsigned shared SQL login must not enumerate orders or customers'; END IF;
 BEGIN
   PERFORM key FROM purchase_rehearsal.preview_scope_secret;
   RAISE EXCEPTION 'Shared SQL login must not read the owner signing key';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $unsigned$;

SELECT set_config('imagine.preview_principal',:'owner_a_owner',true),
       set_config('imagine.preview_mac',:'owner_a_mac',true) \gset signed_a_
DO $owner_a$
BEGIN
 IF (SELECT count(*) FROM purchase_rehearsal.customer_orders)<>4
    OR (SELECT count(*) FROM purchase_rehearsal.customers)<>1
    OR EXISTS (SELECT FROM purchase_rehearsal.customer_orders
               WHERE customer_id<>current_setting('imagine.preview_principal'))
 THEN RAISE EXCEPTION 'Valid owner A must see its four orders and only its own identity'; END IF;
END $owner_a$;

SELECT set_config('imagine.preview_principal',:'owner_b_owner',true) \gset switched_owner_
DO $wrong_mac$
BEGIN
 IF EXISTS (SELECT FROM purchase_rehearsal.customer_orders)
    OR EXISTS (SELECT FROM purchase_rehearsal.customers)
 THEN RAISE EXCEPTION 'A valid owner MAC must not transfer to another customer'; END IF;
END $wrong_mac$;
SELECT set_config('imagine.preview_principal','admin',true) \gset forged_admin_
DO $forged_admin$
BEGIN
 IF EXISTS (SELECT FROM purchase_rehearsal.customer_orders)
 THEN RAISE EXCEPTION 'An owner MAC must not authorize an admin claim'; END IF;
END $forged_admin$;

SELECT set_config('imagine.preview_principal',:'owner_b_owner',true),
       set_config('imagine.preview_mac',:'owner_b_mac',true),
       set_config('imagine.preview_foreign_owner',:'owner_a_owner',true) \gset signed_b_
DO $owner_b$
DECLARE changed bigint;
BEGIN
 IF (SELECT count(*) FROM purchase_rehearsal.customer_orders)<>1
    OR (SELECT count(*) FROM purchase_rehearsal.customers)<>1
    OR EXISTS (SELECT FROM purchase_rehearsal.customer_orders
               WHERE customer_id<>current_setting('imagine.preview_principal'))
 THEN RAISE EXCEPTION 'Valid owner B must see its one order and only its own identity'; END IF;
 UPDATE purchase_rehearsal.customer_orders SET revision=revision+1
 WHERE customer_id=current_setting('imagine.preview_foreign_owner');
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'Owner B must not mutate any of owner A four orders'; END IF;
END $owner_b$;

RESET SESSION AUTHORIZATION;
DO $unchanged$
BEGIN
 IF (SELECT count(*) FROM purchase_rehearsal.customer_orders)<>5
    OR EXISTS (SELECT FROM purchase_rehearsal.customer_orders WHERE revision<>0 OR payment<>'pending')
    OR EXISTS (SELECT FROM purchase_rehearsal.sandbox_payment_intents)
 THEN RAISE EXCEPTION 'Ownership probes must leave all five quotes and zero Sandbox intents unchanged'; END IF;
END $unchanged$;
ROLLBACK;
\echo 'PASS V5 PG18: five exact server quotes; two signed owners (4/1); unsigned/forged/foreign access denied; zero Sandbox intents; probes rolled back'
