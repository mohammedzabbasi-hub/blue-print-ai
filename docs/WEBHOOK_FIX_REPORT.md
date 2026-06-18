# Webhook Fix Report

## Original Error

`shopify app dev` failed while updating the dev preview with:

- `The following topic is invalid: customers/data_request`
- `The following topic is invalid: customers/redact`
- `The following topic is invalid: shop/redact`
- `Failed to start dev preview`
- `Error updating dev preview`

## Root Cause

The three required Shopify privacy webhook topics were declared as normal webhook `topics` in `shopify.app.toml`. Shopify CLI validates those privacy topics as compliance webhooks, so they must be declared with `compliance_topics` rather than `topics`.

## Exact Files Changed

- `shopify.app.toml`
- `app/routes/webhooks.customers.data_request.jsx`
- `app/routes/webhooks.customers.redact.jsx`
- `app/routes/webhooks.shop.redact.jsx`
- `docs/WEBHOOK_FIX_REPORT.md`

## Exact TOML Changes

Kept the existing webhook API version:

```toml
[webhooks]
api_version = "2026-07"
```

Preserved existing normal webhook subscriptions:

```toml
[[webhooks.subscriptions]]
uri = "/webhooks/app/scopes_update"
topics = [ "app/scopes_update" ]

[[webhooks.subscriptions]]
uri = "/webhooks/app/uninstalled"
topics = [ "app/uninstalled" ]
```

Changed the three privacy topics from normal `topics` to compliance webhook declarations:

```toml
[[webhooks.subscriptions]]
uri = "/webhooks/customers/data_request"
compliance_topics = [ "customers/data_request" ]

[[webhooks.subscriptions]]
uri = "/webhooks/customers/redact"
compliance_topics = [ "customers/redact" ]

[[webhooks.subscriptions]]
uri = "/webhooks/shop/redact"
compliance_topics = [ "shop/redact" ]
```

No duplicate `[webhooks]` section was added.

## Webhook Handler Changes

### APP_UNINSTALLED

File: `app/routes/webhooks.app.uninstalled.jsx`

Existing behavior was preserved. It verifies the webhook with `authenticate.webhook(request)`, logs only topic/shop metadata, deletes app-owned workspace data for the verified shop, and deletes stored sessions for that shop.

### CUSTOMERS_DATA_REQUEST

File: `app/routes/webhooks.customers.data_request.jsx`

The handler already verified the webhook with `authenticate.webhook(request)` and returned success. I kept that behavior and added non-sensitive topic/shop logging plus comments documenting that BluePrintAI does not currently persist customer records in its Prisma schema. If customer-specific storage is added later, the required retrieval workflow must be implemented here.

### CUSTOMERS_REDACT

File: `app/routes/webhooks.customers.redact.jsx`

The handler already verified the webhook with `authenticate.webhook(request)` and returned success. I kept that behavior and added non-sensitive topic/shop logging plus comments documenting that BluePrintAI does not currently persist customer records in its Prisma schema. If customer-specific storage is added later, deletion/anonymization must be implemented here.

### SHOP_REDACT

File: `app/routes/webhooks.shop.redact.jsx`

The handler verifies the webhook with `authenticate.webhook(request)`, logs only topic/shop metadata, deletes app-owned workspace data keyed by the verified shop domain through `deleteWorkspaceData(shop)`, and deletes sessions for that shop.

## HMAC Verification

Present. All four webhook routes use the project's Shopify helper:

```js
await authenticate.webhook(request)
```

or destructure values from that verified result. Request bodies are not trusted before this call.

## Topic Handling Status

| Topic | Route file | Verified | Handling status |
|---|---|---:|---|
| `APP_UNINSTALLED` | `app/routes/webhooks.app.uninstalled.jsx` | Yes | Deletes workspace data and sessions for verified shop |
| `CUSTOMERS_DATA_REQUEST` | `app/routes/webhooks.customers.data_request.jsx` | Yes | Acknowledges; no customer records are stored in current Prisma schema |
| `CUSTOMERS_REDACT` | `app/routes/webhooks.customers.redact.jsx` | Yes | Acknowledges; no customer records are stored in current Prisma schema |
| `SHOP_REDACT` | `app/routes/webhooks.shop.redact.jsx` | Yes | Deletes app-owned workspace data and sessions for verified shop |

## Validation and Test Results

### Shopify Config Validation

Command:

```bash
shopify app config validate --json
```

Result:

```json
{
  "valid": true,
  "issues": []
}
```

Note: Shopify CLI auto-upgraded from 4.1.0 to 4.2.0 during this command.

### Lint Result

Command:

```bash
npm run lint
```

Result: Passed.

### Typecheck Result

Command:

```bash
npm run typecheck
```

Result: Passed. React Router emitted v8 future-flag warnings, but the command exited successfully.

### Build Result

Command:

```bash
npm run build
```

Result: Passed. React Router emitted v8 future-flag warnings, but the command exited successfully.

### Shopify App Dev Result

Command:

```bash
shopify app dev
```

Result: Passed. The dev preview started successfully.

Observed output included:

- Preview URL generated for `blueprintai-test-store.myshopify.com`
- GraphiQL URL generated
- `Preparing dev preview on blueprintai-test-store.myshopify.com`
- `✅ Ready, watching for changes in your app`
- No invalid-topic errors for `customers/data_request`, `customers/redact`, or `shop/redact`

I stopped the temporary dev processes after confirming startup.

## Remaining Manual Work

- If BluePrintAI later stores customer-specific personal data, implement retrieval for `CUSTOMERS_DATA_REQUEST` and deletion/anonymization for `CUSTOMERS_REDACT`.
- Review retention policy before deciding whether `APP_UNINSTALLED` should delete all workspace data immediately or only invalidate sessions. Existing behavior already deletes workspace data, so I preserved it.
- Consider opting into or addressing React Router v8 future flags separately; they are warnings and unrelated to the webhook topic failure.

## Is It Safe To Run `shopify app deploy`?

The webhook configuration error is fixed, config validation passes, and local dev preview starts. It is reasonable to run `shopify app deploy` when you are ready to deploy these app configuration changes.

Because `shopify.app.toml` has `include_config_on_deploy = true`, deploying will publish the updated webhook configuration. Do not deploy until you are comfortable with the preserved existing behavior where `APP_UNINSTALLED` and `SHOP_REDACT` delete app-owned workspace data and sessions for the verified shop.
