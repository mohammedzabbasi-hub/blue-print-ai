# BluePrintAI — Shopify App Review Instructions

Paste the section below into Shopify App Review after replacing bracketed operational details. Do not include secrets. Verify every statement against production immediately before submission.

---

BluePrintAI is an embedded Shopify creative-planning and performance workspace. It helps merchants organize creative assets, review uploaded videos, import merchant-provided performance CSVs, view clearly identified Google Ads reporting data, generate advisory recommendations and ad briefs, and save revenue-planning blueprints. It does not place ads, change campaigns, alter budgets, or guarantee performance or revenue.

Test store: `blueprintai-test-store.myshopify.com`

Install/access: [PASTE PARTNER-DASHBOARD REVIEW INSTALL LINK OR SHOPIFY-PROVIDED ACCESS STEPS — NO PASSWORD OR SECRET]

No app-specific username or password is required. BluePrintAI uses the Shopify installation and authorization flow and should open embedded inside Shopify Admin.

## Recommended review path

1. Install BluePrintAI on the test store and approve the requested Shopify access. The app requests `read_products` so it can use product information as planning context.
2. Complete onboarding, or choose the available skip/manual-context path. A store with no products or no performance records is supported: the app should show useful empty states and must not invent analytics.
3. Open **Data Import** to use supplied safe CSV files. Preview the rows before confirming the import. Imported values are merchant-provided and are labeled as imported/CSV data; they are not represented as live ad-platform or Shopify analytics.
4. Open **Creative Library**, **AI Review Studio**, **Recommendations**, **Ad Briefs**, and **Revenue Blueprint**. These pages work with empty, demo, or imported context. Planning outputs are advisory; estimates are identified as estimated/directional rather than measured or guaranteed results.
5. Open **Connections**. Google Ads is optional. CSV import and the rest of the core app remain available without connecting Google Ads.

## Testing with no data

Use a clean install or leave the workspace unpopulated. Complete or skip onboarding, then visit Dashboard, Creative Library, AI Review Studio, Recommendations, Ad Briefs, Revenue Blueprint, and Connections. Expected behavior is an honest empty/onboarding state with links to add context, upload a video, or import a CSV. Zero, unavailable, and not-imported values should not be replaced by fabricated performance.

## Demo and imported data

For the prepared reviewer experience, use the non-secret sample files provided at [DESCRIBE REVIEWER-SAFE FILE LOCATION OR ATTACHMENT]. The repository also documents the sample flow in `DEMO_STORE_IMPORT_GUIDE.md` and `REVIEWER_INSTRUCTIONS.md`.

- **Demo/sample** labels identify synthetic example workspace content.
- **Imported/CSV/merchant-provided** labels identify values supplied in a file by the merchant.
- **Estimated/directional** labels identify planning calculations or heuristic guidance, not measured results or guaranteed outcomes.
- **Google Ads/connected-platform/synced** labels identify reporting rows retrieved from the merchant-authorized Google Ads account.

These sources remain distinct. BluePrintAI does not relabel demo or CSV values as Google Ads results.

## Safe Google Ads test

Google Ads testing is optional and is not required to evaluate the main BluePrintAI workflow. If testing it, use a dedicated Google test account/customer with no sensitive campaign or customer information:

1. Open **Connections** and select **Connect Google Ads**.
2. Complete Google's consent flow.
3. Back in BluePrintAI, select an accessible Google Ads customer account and click **Select**.
4. Click **Sync now**. BluePrintAI reads reporting metrics for the recent reporting window and labels them as Google Ads/connected-platform data. An account with no reportable activity is valid and should return a successful zero-row state.
5. Click **Disconnect** to remove the BluePrintAI connection and revoke the Google grant when Google accepts revocation.

The Google Ads integration is **read-only/reporting-only**. It does not create or edit campaigns, ads, bids, budgets, targeting, or billing. Google Ads is optional; users can use CSV import, uploads, Shopify product context, and planning features without it.

## Pricing and billing

BluePrintAI is currently free. There is no paid plan, subscription charge, usage charge, or Shopify billing approval step in this submitted version. [CONFIRM THE PARTNER DASHBOARD LISTING IS SET TO FREE BEFORE PASTING.]

## Support and legal pages

Public pages are available without logging in:

- Support: `https://blueprintai-app.onrender.com/support`
- Privacy: `https://blueprintai-app.onrender.com/privacy`
- Terms: `https://blueprintai-app.onrender.com/terms`
- Contact: `https://blueprintai-app.onrender.com/contact`
- Data deletion: `https://blueprintai-app.onrender.com/data-deletion`

Embedded versions are also available from the BluePrintAI sidebar and Settings. BluePrintAI is operated by BluePrintAI Commerce, and the support contact displayed there must match the Shopify App Store listing.

For support, contact BluePrintAI Commerce at support@blueprintai.app. Include your Shopify store domain and a non-sensitive description of the issue. Do not send passwords, API keys, OAuth codes, access tokens, refresh tokens, developer tokens, or private ad-account credentials.

---

## Submission-owner pre-paste checks

- [ ] Replace every bracketed field.
- [ ] Verify the production origin and each public URL.
- [ ] Confirm Google OAuth is configured and the tested consent is reporting-only.
- [ ] Confirm listing pricing is Free and no billing gate appears.
- [ ] Confirm the test store is installable by Shopify reviewers without sharing a secret.
- [ ] Attach or make reviewer-safe CSV/video assets accessible through Shopify's approved review mechanism.
- [ ] Ensure these instructions do not conflict with older `REVIEWER_INSTRUCTIONS.md`; the current production connector behavior in this file takes precedence.
