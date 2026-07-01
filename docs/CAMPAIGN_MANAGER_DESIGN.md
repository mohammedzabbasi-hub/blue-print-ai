# Campaign Manager design

BluePrintAI stores workspace campaigns in the shop-scoped `AdCampaign` model. Campaign names are unique per shop through `normalizedName`, so casing and repeated whitespace cannot create accidental duplicates.

Assignments use `AdCampaignCreative`, which can link a `SavedCreative`, a `CreativePerformance`, or both. This join model was chosen because `CreativePerformance.campaignId` already represents an external ad-platform campaign ID. Reusing that field as a Prisma foreign key would lose imported source identity. `externalCampaignId` and the original imported payload remain available for matching and auditability.

CSV aliases normalize `campaign`, `campaign_name`, `campaignName`, `ad_campaign`, and `adCampaign` to the imported campaign name; `campaign_id` and `campaignId` remain the source campaign ID. Imports match by source ID first and normalized name second, then create an active campaign when no shop-scoped match exists. Creative-plus-performance imports store both linked records in one assignment.

Deleting a campaign cascades only its assignment rows. Creative and performance records remain usable and become unassigned. Reset deletes assignments before campaigns and creative records, always scoped to the current shop; Shopify `Session` rows are preserved.
