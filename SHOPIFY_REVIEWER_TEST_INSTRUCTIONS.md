# BluePrintAI Reviewer Test Instructions

Production app URL: `https://YOUR_PRODUCTION_APP_URL`

1. Install BluePrintAI on the development store.
2. Open the embedded app in Shopify Admin and complete onboarding if prompted.
3. Go to **Connections**.
4. Connect Google Ads. Google Ads access is optional, read-only, and reporting-only.
5. Confirm **Campaign sync scope** defaults to **All campaigns**. Optionally open **Manage campaigns**, refresh the read-only campaign list, choose **Selected campaigns only**, select at least one campaign, and save. Selected mode with no checked campaign must show **“Select at least one campaign before syncing.”**
6. Click **Sync latest data**. All mode reads all reportable campaigns; selected mode reads only the chosen campaigns.
7. If the test Google Ads account has no campaign activity, confirm the app shows: **“Sync completed. No live Google Ads performance rows were found for this account.”** The account must remain Connected.
8. If sample performance data is needed, use **Data Import** to upload a CSV.
9. Go to **Command Center**. Confirm real synced rows or manually imported CSV rows are displayed; when neither exists, confirm the empty state says **“No imported ad or creative performance data yet.”**
10. Visit Creative Library, AI Review Studio, Recommendations, Ad Briefs, Revenue Blueprint, Creators, Data Import, Campaigns, Connections, Settings, Privacy, Terms, Support, and Data Deletion.
11. Confirm TikTok Ads and Meta Ads are marked **Coming soon** and manual CSV import remains available.
12. Confirm campaign records are local planning folders only. Google Ads campaign selection controls reporting scope only. The app does not create, edit, launch, pause, fund, spend on, or otherwise mutate Google Ads campaigns or any other ad-platform campaigns.
13. Return to Connections and confirm **Manage campaigns**, **Sync latest data**, and **Disconnect** remain available. Disconnect is the only action that removes the Google Ads connection.

If live Google Ads access is not available to the reviewer, the rest of the app remains testable with manual CSV import.
