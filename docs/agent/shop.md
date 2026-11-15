## Swag Shop

Uses Fourthwall for merch. The Storefront API has a persistent 403 issue (unresolved with Fourthwall), so the shop tab pulls product data from the **Merchant Center RSS feed** (`/.well-known/merchant-center/rss.xml`). Products are grouped by `item_group_id` to deduplicate size/color variants.

