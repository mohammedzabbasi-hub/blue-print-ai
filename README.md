# BluePrintAI for Shopify

BluePrintAI is a Shopify-native embedded app for merchant creative planning. It turns Shopify catalog and order context into product-specific ad angles, video analysis, recommendations, ad briefs, and a 7-day revenue blueprint.

This app uses the Shopify React Router app architecture and preserves the Shopify scaffolded OAuth/session flow through `@shopify/shopify-app-react-router`.

## Merchant-facing pages

- Dashboard: product count, order/revenue context when available, creative health score, and action items.
- Creative Library: product-linked hooks, angles, visual concepts, and CTAs.
- Video Analysis: description-based hook, clarity, CTA, pacing, and retention-risk review.
- Recommendations: prioritized product and conversion recommendations.
- Ad Briefs: copyable hooks, captions, scripts, visual concepts, CTAs, and creator direction.
- Revenue Blueprint: diagnosis, priorities, conversion ideas, positioning, ad plan, and next 7 days.
- Settings: connected store, scopes, AI provider status, billing placeholder, privacy notes, and support placeholder.

## Shopify architecture

- Embedded app: `embedded = true` in `shopify.app.toml`.
- Auth/session handling: `app/shopify.server.js`.
- Authenticated routes: every `/app/*` loader/action calls `authenticate.admin(request)`.
- App Bridge wrapper: `AppProvider` in `app/routes/app.jsx`.
- UI: Shopify web components with a Shopify-compatible embedded navigation menu.
- Data access: Shopify GraphQL Admin API from server loaders/actions only.
- Session storage: Prisma via `@shopify/shopify-app-session-storage-prisma`.
- Uninstall cleanup: `APP_UNINSTALLED` webhook at `app/routes/webhooks.app.uninstalled.jsx` deletes stored sessions for the shop.

## Scopes used

Current `shopify.app.toml` scopes:

- `read_products`: required to load product titles, descriptions, images, prices, inventory context, and product status for creative planning.
- `read_orders`: used only for Revenue Blueprint and Dashboard order/revenue context. The app handles missing or unavailable order data gracefully.

The app does not request customer scopes, product write access, metaobject write access, payment scopes, refund scopes, or protected customer data scopes in this build.

## AI and privacy

- AI provider keys must stay server-side in environment variables such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`.
- The frontend never receives AI API keys or Shopify access tokens.
- If no AI key is configured, the app uses deterministic demo recommendations so development-store testing and Shopify App Review do not fail.
- Do not log Shopify access tokens or AI secrets.
- Store app-specific AI analysis in the app database only when needed. This build does not require Shopify metaobjects.
- Before public submission, publish and link a privacy policy describing collected merchant data, retention, subprocessors, and deletion workflow.
- Before public submission, publish and link terms of service.

## Billing readiness

Do not add Stripe or off-platform billing for public Shopify App Store distribution.

Paid plans should use Shopify App Pricing or the Shopify Billing API. The current Settings page includes a billing-ready placeholder and does not block development-store testing behind payment.

## Development

```shell
npm install
npx prisma generate
npm run dev
```

For Shopify CLI development:

```shell
shopify app dev
```

The app should work on a Shopify development store with generated test data. If the store has no products or API calls fail, BluePrintAI shows demo products and clear notices instead of 404/500 failures.

## Verification

Run:

```shell
npm run build
npm run lint
npx prisma generate
```

Optional:

```shell
npm run typecheck
```

## Install and uninstall testing

1. Install the app on a Shopify development store through `shopify app dev`.
2. Confirm every app nav item loads inside Shopify Admin.
3. Confirm Dashboard, Creative Library, Recommendations, Ad Briefs, Revenue Blueprint, and Settings work with no store products.
4. Add Shopify generated test products and reload the app.
5. Confirm product-specific recommendations and briefs use Shopify product data.
6. Trigger or perform app uninstall.
7. Confirm `APP_UNINSTALLED` webhook receives the event and sessions for that shop are deleted.

## App Store listing readiness checklist

- Add production app URL and redirect URLs.
- Add support email and support documentation URL.
- Add privacy policy URL.
- Add terms of service URL.
- Confirm listed features match reachable in-app pages.
- Confirm no TikTok OAuth, TikTok seller data, separate username/password login, or off-platform billing is required.
- Confirm all authenticated Shopify admin loaders/actions use `authenticate.admin`.
- Confirm scopes are minimal and documented.
- Confirm no protected customer data is requested.
- Confirm AI fallback works without API keys.
- Confirm empty, loading, and error states are visible and clear.
- Confirm app stays embedded in Shopify Admin.
- Confirm no broken routes, redirect loops, 404s, or unhandled 500s during review.
- Confirm claims avoid guaranteed revenue or performance outcomes.
- Confirm billing, if enabled later, uses Shopify App Pricing or Billing API.
