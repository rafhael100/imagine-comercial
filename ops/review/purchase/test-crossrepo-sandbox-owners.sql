-- CI-only cross-repository signed-owner proof, runs on a NEW disposable PG18.
-- Never execute on VPS, persistent/production databases or real customer records.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'portal_purchase_rehearsal'
 THEN RAISE EXCEPTION 'Reject non-synthetic database'; END IF;
 IF (SELECT count(DISTINCT o.customer_id)
     FROM purchase_rehearsal.sandbox_payment_intents i
     JOIN purchase_rehearsal.customer_orders o ON o.id=i.order_id)<2
 THEN RAISE EXCEPTION 'Need two separate owners with Sandbox intents'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='purchase_rehearsal.sandbox_payment_intents'::regclass
     AND relrowsecurity AND relforcerowsecurity)
 THEN RAISE EXCEPTION 'Sandbox intent FORCE RLS is required'; END IF;
 IF pg_has_role('purchase_rehearsal_a','purchase_rehearsal_psp','member')
 THEN RAISE EXCEPTION 'Web role must not be a member of PSP worker role'; END IF;
END $guard$;

-- Derive two distinct, authentic but entirely fictitious customer principals
-- on the database-owner connection. No MAC, secret or customer ID is printed.
SELECT o.customer_id AS owner,
       encode(purchase_rehearsal.hmac(
         convert_to('imagine-owned-preview-v1:'||o.customer_id,'UTF8'),
         s.key,'sha256'),'hex') AS mac,
       (SELECT count(*) FROM purchase_rehearsal.sandbox_payment_intents i2
         JOIN purchase_rehearsal.customer_orders o2 ON o2.id=i2.order_id
         WHERE o2.customer_id=o.customer_id) AS expected
FROM purchase_rehearsal.sandbox_payment_intents i
JOIN purchase_rehearsal.customer_orders o ON o.id=i.order_id
CROSS JOIN purchase_rehearsal.preview_scope_secret s
WHERE s.id=1
ORDER BY o.customer_id LIMIT 1 \gset owner_a_

SELECT o.customer_id AS owner,
       encode(purchase_rehearsal.hmac(
         convert_to('imagine-owned-preview-v1:'||o.customer_id,'UTF8'),
         s.key,'sha256'),'hex') AS mac,
       (SELECT count(*) FROM purchase_rehearsal.sandbox_payment_intents i2
         JOIN purchase_rehearsal.customer_orders o2 ON o2.id=i2.order_id
         WHERE o2.customer_id=o.customer_id) AS expected
FROM purchase_rehearsal.sandbox_payment_intents i
JOIN purchase_rehearsal.customer_orders o ON o.id=i.order_id
CROSS JOIN purchase_rehearsal.preview_scope_secret s
WHERE s.id=1 AND o.customer_id<>:'owner_a_owner'
ORDER BY o.customer_id LIMIT 1 \gset owner_b_

SET SESSION AUTHORIZATION purchase_rehearsal_a;

-- Missing signed principal denies every intent even under shared application login.
DO $denied$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM purchase_rehearsal.sandbox_payment_intents;
 IF n<>0 THEN RAISE EXCEPTION 'CRITICAL: unsigned app SQL enumerates Sandbox intents'; END IF;
END $denied$;

SELECT set_config('imagine.preview_principal', :'owner_a_owner', false),
       set_config('imagine.preview_mac', :'owner_a_mac', false),
       set_config('imagine.preview_expected', :'owner_a_expected', false) \gset signed_a_
DO $owned$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM purchase_rehearsal.sandbox_payment_intents;
 IF n<>current_setting('imagine.preview_expected')::bigint THEN RAISE EXCEPTION 'Signed owner A sees wrong number of payment intents'; END IF;
END $owned$;

-- The same MAC with the wrong owner or forged admin identity must reveal nothing.
SELECT set_config('imagine.preview_principal', :'owner_b_owner', false) \gset switched_
DO $forged$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM purchase_rehearsal.sandbox_payment_intents;
 IF n<>0 THEN RAISE EXCEPTION 'CRITICAL: owner MAC was transferable to another customer'; END IF;
END $forged$;
SELECT set_config('imagine.preview_principal','admin',false) \gset forged_admin_
DO $forged_admin$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM purchase_rehearsal.sandbox_payment_intents;
 IF n<>0 THEN RAISE EXCEPTION 'CRITICAL: forged SQL admin lists Sandbox intents'; END IF;
END $forged_admin$;

SELECT set_config('imagine.preview_principal', :'owner_b_owner', false),
       set_config('imagine.preview_mac', :'owner_b_mac', false),
       set_config('imagine.preview_expected', :'owner_b_expected', false) \gset signed_b_
DO $owned_b$
DECLARE n bigint;
BEGIN
 SELECT count(*) INTO n FROM purchase_rehearsal.sandbox_payment_intents;
 IF n<>current_setting('imagine.preview_expected')::bigint THEN RAISE EXCEPTION 'Signed owner B sees wrong number of payment intents'; END IF;
 -- Never let a customer update server-owned financial amounts, provider status,
 -- payment holder or worker-only data. Column-level GRANT must fail closed.
 BEGIN
   UPDATE purchase_rehearsal.sandbox_payment_intents SET amount_cents=1;
   RAISE EXCEPTION 'CRITICAL: shared web role can overwrite payment amount';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   UPDATE purchase_rehearsal.sandbox_payment_intents SET provider_status='RECEIVED';
   RAISE EXCEPTION 'CRITICAL: web role can forge provider settlement';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $owned_b$;

-- No customer-scope proof can grant worker privileges.
DO $worker$
BEGIN
 BEGIN
   PERFORM set_config('role','purchase_rehearsal_psp',true);
   RAISE EXCEPTION 'CRITICAL: web login can become NOLOGIN payment worker';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $worker$;
RESET SESSION AUTHORIZATION;
\echo 'PASS signed HMAC isolates TWO sandbox-queue owners; forged admin, price, settlement, and worker role denied'
