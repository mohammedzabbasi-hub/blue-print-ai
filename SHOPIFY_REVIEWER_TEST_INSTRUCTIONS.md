# BluePrintAI Reviewer Test Instructions

Production app URL: `https://blueprintai-app.onrender.com`

1. Install BluePrintAI on the development store.
2. Open the embedded app in Shopify Admin and complete onboarding if prompted.
3. Go to **Connections**.
4. Connect Google Ads. Google Ads access is optional, read-only, and reporting-only.
5. Click **Sync latest data**.
6. If the test Google Ads account has no campaign activity, confirm the app shows: **“Sync completed. No live Google Ads performance rows were found for this account.”** The account must remain Connected.
7. If sample performance data is needed, use **Data Import** to upload a CSV.
8. Go to **Command Center**. Confirm real synced rows or manually imported CSV rows are displayed; when neither exists, confirm the empty state says **“No imported ad or creative performance data yet.”**
9. Visit Creative Library, AI Review Studio, Recommendations, Ad Briefs, Revenue Blueprint, Creators, Data Import, Campaigns, Connections, Settings, Privacy, Terms, Support, and Data Deletion.
10. Confirm TikTok Ads and Meta Ads are marked **Coming soon** and manual CSV import remains available.
11. Confirm campaign records are local planning folders only. The app does not create, edit, launch, pause, fund, or otherwise mutate Google Ads campaigns or any other ad-platform campaigns.
12. Return to Connections and confirm **Sync latest data** and **Disconnect** remain available.

If live Google Ads access is not available to the reviewer, the rest of the app remains testable with manual CSV import.
