#!/bin/bash

# Configuration
BASE_URL="http://localhost:5002/api"
TIMESTAMP=$(date +%s)
EMAIL="testuser_${TIMESTAMP}@example.com"
PASSWORD="password123"

echo "🧪 Starting Order Flow Verification..."

# 1. Signup/Login
echo -e "\n1️⃣  Authenticating..."
SIGNUP_RES=$(curl -s -X POST "$BASE_URL/users/signup" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test\",\"email\":\"$EMAIL\",\"phone\":\"98${TIMESTAMP: -8}\",\"password\":\"$PASSWORD\",\"role\":\"user\"}")
TOKEN=$(echo $SIGNUP_RES | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Auth failed"
  exit 1
fi
echo "✅ Auth Success"

# 2. Get Restaurant & Menu Item
echo -e "\n2️⃣  Fetching Restaurant..."
REST_RES=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/restaurants?limit=1")
REST_ID=$(echo $REST_RES | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$REST_ID" ]; then
  echo "❌ No restaurants found"
  exit 1
fi
echo "✅ Restaurant ID: $REST_ID"

echo -e "\n3️⃣  Fetching Menu..."
MENU_RES=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/restaurants/$REST_ID/menu")
MENU_ID=$(echo $MENU_RES | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$MENU_ID" ]; then
  echo "❌ No menu items found"
  exit 1
fi
echo "✅ Menu Item ID: $MENU_ID"

# 3. Create Order (Simulating Frontend Payload)
echo -e "\n4️⃣  Creating Order..."
# Note: sending 'menuItem' key as frontend does, and expecting backend to handle it
ORDER_PAYLOAD="{\"restaurantId\":\"$REST_ID\",\"items\":[{\"menuItem\":\"$MENU_ID\",\"quantity\":1}],\"totalAmount\":100,\"deliveryAddress\":\"Test Addr\",\"contactPhone\":\"9812345678\",\"paymentMethod\":\"cod\"}"

ORDER_RES=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$ORDER_PAYLOAD")

# Extract ID using python
ORDER_ID=$(echo $ORDER_RES | python3 -c "import sys, json; print(json.load(sys.stdin)['order']['_id'])")

if [ -z "$ORDER_ID" ] || [ "$ORDER_ID" == "None" ]; then
  echo "❌ Order creation failed"
  echo "Response: $ORDER_RES"
  exit 1
fi
echo "✅ Order Created: $ORDER_ID"

# 4. Verify Order Details (Check for Image)
echo -e "\n5️⃣  Verifying Order Details..."
GET_ORDER_RES=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/orders/$ORDER_ID")

echo "Debug Response: $GET_ORDER_RES"

if [[ $GET_ORDER_RES == *"image"* ]]; then
  echo "✅ Image field found in order items!"
else
  echo "❌ Image field MISSING in order items!"
  echo "Response: $GET_ORDER_RES"
fi

if [[ $GET_ORDER_RES == *"productId"* ]]; then
  echo "✅ productId field found (Backend Schema Correct)"
else
  echo "❌ productId field MISSING!"
fi

echo -e "\n🏁 Verification Complete."
