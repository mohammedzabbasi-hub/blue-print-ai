# BluePrintAI Shopify Listing Final Checklist

Status: Incomplete — listing assets and Partner Dashboard fields must be finalized before submission.

## Shopify guidance baseline

The installed Shopify plugin identified these current listing rules and best practices:

- Requirement 4.4.1: app card subtitle must concisely explain value, without keyword stuffing, merchant data, or statistics.
- Requirement 4.4.2: app details must clearly explain functionality, not just list keywords/features.
- Requirements 4.4.3–4.4.5: no Shopify trademark misuse; images must focus on actual UI/features; no browser/desktop chrome, logo-only image, duplicate, or near-duplicate.
- Requirements 4.5.3–4.5.6: mandatory demo screencast, current test credentials, full functional access when credentials are needed, and Partner emergency contact.
- Shopify best practices: app name up to 30 characters; 1200×1200 PNG/JPEG icon; 1600×900 feature image; 3–6 unique 1600×900 screenshots; alt text; app introduction up to 100 characters; app details up to 500 characters; features up to 80 characters each.

## Listing identity

- [x] App name: `BluePrintAI`
- [x] TOML name matches proposed listing name.
- [x] Name is below the 30-character best-practice limit.
- [ ] Confirm no confusingly similar published app name in Partner Dashboard/App Store.
- [ ] Confirm legal operator and ownership of the name with the owner.

## App icon

Current repository result: not satisfied. `public/favicon.ico` is 64×64 and is not the App Store icon.

- [ ] Create a 1200×1200 PNG or JPEG.
- [ ] Use bold color and a simple recognizable mark.
- [ ] No text, screenshot, Shopify logo/trademark, rounded baked-in corners, or edge-touching artwork.
- [ ] Keep square corners; Shopify rounds them automatically.
- [ ] Confirm rights to every element.
- [ ] Inspect at small size for legibility.

## App introduction / card subtitle

Proposed copy (under 100 characters):

> Turn product context and creative performance signals into clearer briefs and test plans.

- [ ] Confirm character count in the live form.
- [ ] Do not add data/statistics, “best,” “first,” “only,” guaranteed results, or keyword lists.

## App details

Proposed copy (under 500 characters):

> BluePrintAI helps Shopify merchants organize creative work, import performance data, review uploaded videos, compare creators and campaigns, and turn available evidence into Creative Briefs and directional Revenue Blueprints. Shopify product context works without an external account. Google Ads reporting is optional and read-only. Metrics remain labeled by source, and recommendations do not guarantee results.

- [ ] Confirm every described workflow is enabled on the production review store.
- [ ] Remove Google Ads or analyzer claims if those live flows will not be available to reviewers.
- [ ] Keep support links/test instructions in their designated fields, not the details field.

## Feature list

Proposed features; each is under 80 characters:

1. Organize uploaded and imported creative in one shop-scoped library
2. Review videos and save analyses only when you choose
3. Generate, edit, duplicate, and save Creative Briefs
4. Compare imported creator and campaign performance
5. Sync optional read-only Google Ads reporting

- [ ] Confirm the live form's feature count and length rules.
- [ ] Do not describe technical implementation details.
- [ ] Do not claim real-time data, automated optimization, ad mutation, guaranteed uplift, or total Shopify attribution.

## Category and integrations

- [ ] Select the closest current Partner Dashboard category after reviewing the live taxonomy. Likely candidate: Marketing and conversion / marketing analytics or advertising reporting, if that exact category exists.
- [ ] Submit as a regular app, not a Sales Channel; BluePrintAI does not publish products to a marketplace.
- [ ] List Shopify as the platform context.
- [ ] List Google Ads only if the controlled production integration is reviewer-accessible.
- [ ] Do not list TikTok Ads or Meta Ads as integrations; direct connections are unavailable.

## Pricing and billing

- [x] Repository state: Free.
- [x] In-app/legal/refund copy says no current charge.
- [x] No external payment provider or external app-charge form found.
- [ ] Partner Dashboard pricing is exactly Free.
- [ ] No paid trial, usage charge, one-time charge, or enterprise price is shown.
- [ ] External billing checkbox remains unchecked.
- [ ] `SHOPIFY_BILLING_REQUIRED=false` and `SHOPIFY_BILLING_BYPASS=false` in production.

Any future charge must use Shopify App Pricing or the Shopify Billing API. Shopify App Pricing is Shopify's current recommended default.

## Install requirements

Repository evidence does not show a geographic, shipping-country, currency, POS, or Online Store dependency.

- [ ] Do not set unnecessary install restrictions.
- [ ] Require only a Shopify Admin store and the approved `read_products` scope.
- [ ] Explain that CSV/manual upload works without Google Ads.
- [ ] If live behavior reveals a real eligibility constraint, add it accurately before submission.

## Tracking information

Repository scan found no storefront pixel, marketing analytics SDK, or active marketing-cookie vendor.

Disclose accurately:

- Essential Shopify authentication/session technologies.
- Server request, security, and error logs described in the privacy policy.
- No storefront/customer behavioral pixel in the current code.
- Google Ads data is processed only after optional merchant OAuth.

- [ ] Verify every Partner Dashboard tracking question against deployed infrastructure, not only source code.
- [ ] If Render, object storage, analyzer, or another provider adds tracking/analytics, update Privacy/Cookies and the listing before submission.

## Feature media

Current repository result: not satisfied. No final feature media exists.

### Static image option

- [ ] Exactly 1600×900, 16:9.
- [ ] Simple composition with one focal point and solid/high-contrast background.
- [ ] Contrast target of at least 4.5:1 where text is used (Shopify recommendation).
- [ ] Communicates merchant benefit or unique value.
- [ ] No Shopify logo/trademark, browser/desktop chrome, app-logo-only treatment, repeated app subtitle, pricing, testimonial, or guarantee.
- [ ] Add alt text.

Recommended alt text:

> BluePrintAI creative planning workspace connecting product context, creative evidence, and next-step briefs.

### Video option

Shopify best-practice guidance recommends a short 2–3 minute promotional video and limiting screencast footage to 25%. This is not the mandatory reviewer setup screencast.

- [ ] Confirm current file/hosting requirements in Partner Dashboard.
- [ ] Keep feature video promotional and accurate.
- [ ] Do not reuse the reviewer screencast without checking feature-media rules.

## Screenshots

Current repository result: not satisfied. Existing parity images are QA captures with noncompliant dimensions, not listing assets.

Shopify best practice: 3–6 unique desktop screenshots, each 1600×900 (16:9), including at least one actual app UI. Crop browser chrome, desktop background, PII, store/account identifiers, notifications, secret/configuration data, test errors, pricing, reviews, and guarantees.

### Recommended six-image set

1. Command Center
   - Caption: `See creative performance and saved work in one source-labeled view.`
   - Alt: `BluePrintAI Command Center showing imported performance metrics, trend controls, and saved creative activity.`
2. Connections
   - Caption: `Connect optional read-only Google Ads reporting and select campaigns.`
   - Alt: `BluePrintAI Connections page showing Google Ads reporting status and the compact campaign selector.`
3. Data Import
   - Caption: `Preview CSV rows and video matches before saving.`
   - Alt: `BluePrintAI Data Import page showing CSV requirements, selected videos, and preview controls.`
4. Creative Library
   - Caption: `Keep imported and explicitly saved creative in a playable workspace.`
   - Alt: `BluePrintAI Creative Library with playable creative cards and product, campaign, creator, and source labels.`
5. AI Review Studio
   - Caption: `Review uploaded video, then explicitly choose what to save.`
   - Alt: `BluePrintAI AI Review Studio showing a current video analysis and separate Save Review and Save to Creative Library actions.`
6. Creative Briefs
   - Caption: `Generate an unsaved preview, then save only when ready.`
   - Alt: `BluePrintAI Creative Briefs showing a structured unsaved preview with evidence and recommendations separated.`

Optional responsive evidence can be retained for reviewer QA, but do not exceed the live listing limit. Shopify recommends including responsive imagery when relevant.

### Screenshot acceptance

- [ ] 1600×900 each.
- [ ] 3–6 images total.
- [ ] Each shows a different feature/state.
- [ ] No browser tabs, address bar, desktop dock, notifications, personal data, test store identifier, account ID, raw provider error, file path, secret, or API key.
- [ ] No Shopify trademark in icon/feature graphics; compatibility use follows brand rules.
- [ ] Demo/imported data is visibly labeled and never called live/real platform performance.
- [ ] No screenshot solely contains the BluePrintAI logo.
- [ ] Alt text entered for every asset.

## URLs and contact information

- [ ] Privacy URL: `https://YOUR_PRODUCTION_APP_URL/privacy`
- [ ] Terms URL: `https://YOUR_PRODUCTION_APP_URL/terms`
- [ ] Support URL: `https://YOUR_PRODUCTION_APP_URL/support`
- [ ] Data deletion URL: `https://YOUR_PRODUCTION_APP_URL/data-deletion`
- [ ] Contact URL: `https://YOUR_PRODUCTION_APP_URL/contact`
- [ ] Support email: `support@blueprintai.app`
- [ ] Confirm all URLs use the final production origin and load while logged out.
- [ ] Confirm the support inbox is monitored and matches Partner Dashboard.
- [ ] Add/verify emergency developer contact in Partner Dashboard.

## Demo store and testing information

- [ ] Provide a development/review store link directly to the best demonstration state, if the current form requests it.
- [ ] Add contextual instructions; do not expose customer/merchant PII.
- [ ] Paste the finalized contents of `SHOPIFY_REVIEWER_TEST_INSTRUCTIONS_FINAL.md` into the testing-information field with all placeholders resolved.
- [ ] Put controlled third-party credentials only in confidential Partner Dashboard fields.
- [ ] Verify credentials grant the complete advertised feature set and do not require a developer's personal account.

## Mandatory review screencast

- [ ] Record step-by-step onboarding/setup and every core feature claimed in the listing.
- [ ] English narration/text or English subtitles.
- [ ] Use the exact production build submitted.
- [ ] Show expected outcome for each tested workflow.
- [ ] Follow `SHOPIFY_FINAL_VIDEO_CHECKLIST.md`.

## Final pre-submit checklist

- [ ] Exact reviewed build deployed.
- [ ] App URL and the single allowed Shopify callback URL (`/auth/callback`) use the final origin.
- [ ] Google redirect URI is exact if Google Ads is listed.
- [ ] App icon approved.
- [ ] Feature media approved.
- [ ] 3–6 screenshots approved with alt text.
- [ ] Introduction, details, features, category, integrations, and pricing match production.
- [ ] External billing unchecked.
- [ ] Install/tracking information complete and accurate.
- [ ] Privacy, terms, support, deletion, contact, and emergency contact complete.
- [ ] Reviewer credentials/instructions current.
- [ ] Mandatory screencast uploaded and rewatched.
- [ ] No unsupported claim, personal data, secret, browser chrome, duplicate image, or unavailable feature remains.
