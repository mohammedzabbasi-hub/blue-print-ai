# Comparison Notes

Automated side-by-side comparison images were not generated in this pass.

The local `react-router-serve` captures for both before and after were blocked by the preserved Shopify authentication boundary, so comparing those images would only compare the auth boundary rather than the rebuilt authenticated dashboard.

Use a real embedded Shopify session, or a sanctioned visual-preview mode that does not alter production auth behavior, before generating pixel comparisons for the app shell and dashboard.
