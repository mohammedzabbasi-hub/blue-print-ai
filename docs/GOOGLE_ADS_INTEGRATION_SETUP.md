# Google Ads integration setup

BluePrintAI uses Google OAuth 2.0 with the Google Ads scope and stores only an encrypted refresh token. Access tokens are short-lived and are never persisted. Metrics are not shown as Google Ads data until a merchant selects an account and a sync succeeds.

## Google Cloud and Google Ads setup

1. Create or select a Google Cloud project and configure its OAuth consent screen.
2. Create a **Web application** OAuth client.
3. Add the exact callback URL as an authorized redirect URI:
   - Local Shopify dev preview: `https://YOUR_CURRENT_DEV_TUNNEL/auth/google-ads/callback`
   - Production: `https://blueprintai-app.onrender.com/auth/google-ads/callback`
4. Request or locate the Google Ads API developer token in the Google Ads manager account under **API Center**.
5. Keep every credential in the server environment or deployment secret manager. Never expose these values through Vite/client variables or commit them.

The OAuth scope is `https://www.googleapis.com/auth/adwords`. Google may issue a refresh token only on consent; BluePrintAI requests offline access and forces the consent prompt. If Google does not return one, remove the previous BluePrintAI grant from the Google Account and connect again.

## Required environment variables

```text
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_REDIRECT_URI=https://YOUR_HOST/auth/google-ads/callback
GOOGLE_ADS_ENCRYPTION_SECRET=
```

`GOOGLE_ADS_ENCRYPTION_SECRET` must be a 32-byte key encoded as base64 or 64 hexadecimal characters. The existing `AD_PLATFORM_TOKEN_ENCRYPTION_KEY` is also supported as a shared encryption-key fallback.

Optional variables:

```text
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_API_VERSION=v24
AD_PLATFORM_OAUTH_STATE_SECRET=
```

Use `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (digits only) when requests must run through a manager account. OAuth state uses `AD_PLATFORM_OAUTH_STATE_SECRET`, falling back to `SHOPIFY_API_SECRET`.

## Development and API access

Google Ads test accounts are appropriate for development and do not serve ads. Production customer accounts require an approved Google Ads API developer token with the appropriate access level. OAuth success alone does not guarantee API access: account discovery or sync can still return a recoverable Google Ads API permission error.

After changing the Prisma schema, deploy migrations before starting the app:

```sh
npx prisma migrate deploy
npx prisma generate
```

Then open **Connections**, connect Google Ads, explicitly select an accessible customer ID, and choose **Sync now**. The initial sync stores separate Google Ads daily campaign and ad snapshots for the previous 30 days; it does not alter manual CSV records.
