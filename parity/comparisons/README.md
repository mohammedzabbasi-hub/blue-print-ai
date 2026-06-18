# Screenshot Comparison Notes

Captured on 2026-06-17.

## Files

| View | Source | Target |
| --- | --- | --- |
| Desktop 1440px | `parity/source/source-dashboard-1440.png` | `parity/target/shopify-auth-boundary-1440.png` |
| Mobile 390px | `parity/source/source-dashboard-390.png` | `parity/target/shopify-auth-boundary-390.png` |

## Result

The source Vite frontend rendered directly at `/dashboard`.

The Shopify target production server rendered successfully, but `/app` is protected by Shopify embedded app authentication. Without a live Shopify OAuth/session URL, screenshots stop at the expected Shopify auth boundary instead of rendering authenticated app pages.

This is a platform-specific verification constraint, not a target route build failure. The production build includes all `/app/*` chunks and automated tests cover the Shopify-safe builder logic used by those routes.
