#!/usr/bin/env bash
# Seed Sunrise Coffee Co. demo: company, employees, and all sample SOPs.
# Requires: npm run dev running on http://localhost:3000
# Requires: valid GEMINI_API_KEY in .env.local for document processing

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SOPS_DIR="$(cd "$(dirname "$0")/../samples/sops" && pwd)"

echo "==> Creating company..."
COMPANY=$(curl -sf -X POST "$BASE_URL/api/companies" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sunrise Coffee Co.","industry":"Food & Beverage"}')
COMPANY_ID=$(echo "$COMPANY" | python3 -c "import sys,json; print(json.load(sys.stdin)['_id'])")
echo "    Company ID: $COMPANY_ID"

echo "==> Adding employees..."
for row in \
  "Alex Rivera|alex@sunrisecoffee.demo|Barista" \
  "Jordan Lee|jordan@sunrisecoffee.demo|Shift Lead" \
  "Sam Patel|sam@sunrisecoffee.demo|Manager"; do
  IFS='|' read -r name email role <<< "$row"
  curl -sf -X POST "$BASE_URL/api/employees" \
    -H "Content-Type: application/json" \
    -d "{\"companyId\":\"$COMPANY_ID\",\"name\":\"$name\",\"email\":\"$email\",\"role\":\"$role\"}" > /dev/null
  echo "    Added: $name ($role)"
done

echo "==> Uploading SOP documents..."
for sop in "$SOPS_DIR"/*.txt; do
  name=$(basename "$sop")
  curl -sf -X POST "$BASE_URL/api/documents/upload" \
    -F "companyId=$COMPANY_ID" \
    -F "file=@$sop;type=text/plain" > /dev/null
  echo "    Uploaded: $name"
done

echo ""
echo "Done! Demo seeded successfully."
echo ""
echo "  Company ID:  $COMPANY_ID"
echo "  Owner UI:    $BASE_URL/owner"
echo "  Employee UI: $BASE_URL/employee"
echo "  Manager UI:  $BASE_URL/manager"
echo ""
echo "Documents process async via Gemini (1-2 min each)."
echo "Check status on Owner dashboard — should show 'processed' when ready."
