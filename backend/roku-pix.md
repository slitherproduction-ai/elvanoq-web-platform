# Native Roku annual Pix activation

The public activation form now offers TV Roku. The current APK already checks license activation and expiration; the obsolete preparation notice was removed. Android identity/payment and the LG portal-control checkout adapter remain unchanged.

`paghiper-payments` accepts these additional requests (same public key/CORS as existing payments):

```json
{"action":"validate","platform":"roku","deviceCode":"ROKU-4F7A2C91-B03E58D6","device_key":"<key shown on TV>","payment_access":"<random 64 hex browser session>"}
```

`create` uses the same identity plus payer_name, payer_email, payer_cpf_cnpj and consent:true. `status` uses that identity plus order_id. The TV must first register through the existing native Roku actions, and its stored key hash must match. Roku requests containing mac or MAC are rejected. Identifiers are never converted to legacy identifiers. Responses expose the visual code and safe order/payment fields only. Server/client hashes, internal native device IDs, provider credentials and payer documents are not returned or persisted in orders.

The existing provider webhook searches legacy orders first, then native Roku orders; notification and provider status/amount verification remain mandatory. Automatic application adds one year to max(now, paid_until), binds the registered device, preserves trial dates and active/block status and is idempotent. Lifetime and currently valid server-code access reject unnecessary billing. Refunds require review as in the existing payment flow.

Migration: `portal_roku_pix_checkout` (`roku-pix.sql`), new service-only RLS table portal_roku_pix_orders and service-only reserve/apply RPCs. Existing Android/LG orders are untouched. The new table is separate from administrator-confirmed manual Roku payments.

Validation:
- `node --experimental-transform-types backend/paghiper-tests.mjs`: existing Android payment regression using the deployed-source entrypoint.
- `node --experimental-transform-types backend/roku-pix-tests.mjs`: mocked provider; registration/key/format, blocked device, rate limiting, consent, fixed amount, safe output, duplicate and ambiguous issuance, scoped status and native webhook.
- `roku-pix-db-tests.sql`: synthetic transaction rolled back; duplicate/session protection, amount checks, accumulation, idempotency, preserved blocked state and trial dates, active license, refund review and public-role restrictions.
- Browser: Roku code autoformat and required key/hidden legacy input; LG formatting and Android optional key preserved. No real invoice, payment or physical TV test performed.

Roku automatic Pix orders are stored in the new native table; the existing administrator legacy Pix history is unchanged by this patch. License status is available through the existing Roku device/license screens and native endpoint.
