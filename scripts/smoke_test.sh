#!/bin/bash
set -e

API="http://localhost:4000"

echo "=== Sur Payments Smoke Test ==="

echo "1. Health check..."
curl -sf "$API/health" > /dev/null && echo "✓ API is healthy"

echo "2. List payments..."
COUNT=$(curl -sf "$API/payments" | grep -o '"id"' | wc -l | tr -d ' ')
echo "✓ Found $COUNT payments"

echo "3. Create payment..."
CREATE=$(curl -sf -X POST "$API/payments" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_cents": 99900,
    "currency": "USD",
    "beneficiary_name": "Smoke Test User",
    "beneficiary_account": "MX999888777",
    "corridor": "USD-MXN",
    "actor_email": "operator@sur.payments"
  }')

ID=$(echo "$CREATE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "✓ Created payment $ID"

echo "4. Submit payment..."
curl -sf -X POST "$API/payments/$ID/transition" \
  -H "Content-Type: application/json" \
  -d '{"action":"submit","actor_email":"operator@sur.payments"}' > /dev/null
echo "✓ Submitted"

echo "5. Approve as Approver..."
curl -sf -X POST "$API/payments/$ID/transition" \
  -H "Content-Type: application/json" \
  -d '{"action":"approve","actor_email":"approver@sur.payments"}' > /dev/null
echo "✓ Approved (maker-checker passed)"

echo ""
echo "=== ALL SMOKE TESTS PASSED ==="
