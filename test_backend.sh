#!/bin/bash

# Configuration
BASE_URL="http://localhost:5002/api"
TIMESTAMP=$(date +%s)
EMAIL="testuser_${TIMESTAMP}@example.com"
PHONE="98${TIMESTAMP: -8}" # 10 digit phone
PASSWORD="password123"
NAME="Test User ${TIMESTAMP}"

echo "🧪 Starting Backend Validation..."
echo "Target: $BASE_URL"
echo "Test User: $EMAIL / $PHONE"

# 1. Signup
echo -e "\n1️⃣  Testing Signup..."
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/users/signup" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$NAME\",\"email\":\"$EMAIL\",\"phone\":\"$PHONE\",\"password\":\"$PASSWORD\",\"role\":\"user\"}")

# Extract token (simple grep/sed as jq might not be installed, but assuming basic tools)
# Try to use python for JSON parsing if jq is missing, or just simple grep
TOKEN=$(echo $SIGNUP_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Signup failed or token not found."
  echo "Response: $SIGNUP_RESPONSE"
  
  # Try login as fallback (maybe user exists from previous run if timestamp collision?)
  echo -e "\n⚠️  Attempting Login as fallback..."
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"emailOrPhone\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
    
  TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  
  if [ -z "$TOKEN" ]; then
     echo "❌ Login also failed. Aborting."
     echo "Response: $LOGIN_RESPONSE"
     exit 1
  fi
fi

echo "✅ Auth Successful. Token: ${TOKEN:0:10}..."

# Helper for authenticated requests
auth_curl() {
  curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"
}

# 2. Get Profile
echo -e "\n2️⃣  Testing Get Profile..."
PROFILE_RES=$(auth_curl "$BASE_URL/users/me")
if [[ $PROFILE_RES == *"email"* ]]; then
  echo "✅ Profile fetch success"
else
  echo "❌ Profile fetch failed: $PROFILE_RES"
fi

# 3. Get Canceled Orders (Marketplace)
echo -e "\n3️⃣  Testing Marketplace (Canceled Orders)..."
MARKET_RES=$(auth_curl "$BASE_URL/orders/canceled")
if [[ $MARKET_RES == *"orders"* ]]; then
  echo "✅ Marketplace fetch success"
else
  echo "❌ Marketplace fetch failed: $MARKET_RES"
fi

# 4. Get Restaurants
echo -e "\n4️⃣  Testing Get Restaurants..."
REST_RES=$(auth_curl "$BASE_URL/restaurants?limit=5")
if [[ $REST_RES == *"restaurants"* ]]; then
  echo "✅ Restaurants fetch success"
else
  echo "❌ Restaurants fetch failed: $REST_RES"
fi

# 5. Address CRUD
echo -e "\n5️⃣  Testing Address CRUD..."
# Add Address
ADD_ADDR_RES=$(auth_curl -X POST "$BASE_URL/users/me/addresses" \
  -d '{"label":"Home","street":"123 Test St","city":"Kathmandu","isDefault":true}')

if [[ $ADD_ADDR_RES == *"123 Test St"* ]]; then
  echo "✅ Add Address success"
else
  echo "❌ Add Address failed: $ADD_ADDR_RES"
fi

# Get Addresses
GET_ADDR_RES=$(auth_curl "$BASE_URL/users/me/addresses")
if [[ $GET_ADDR_RES == *"123 Test St"* ]]; then
  echo "✅ Get Addresses success"
else
  echo "❌ Get Addresses failed: $GET_ADDR_RES"
fi

# 6. FCM Token
echo -e "\n6️⃣  Testing FCM Token Registration..."
FCM_RES=$(auth_curl -X POST "$BASE_URL/users/fcm-token" \
  -d '{"fcmToken":"test_fcm_token_12345"}')

if [[ $FCM_RES == *"registered"* ]]; then
  echo "✅ FCM Token success"
else
  echo "❌ FCM Token failed: $FCM_RES"
fi

# 7. Game Leaderboard
echo -e "\n7️⃣  Testing Game Leaderboard..."
GAME_RES=$(auth_curl "$BASE_URL/game/leaderboard")
if [[ $GAME_RES == *"leaderboard"* ]]; then
  echo "✅ Leaderboard fetch success"
else
  echo "❌ Leaderboard fetch failed: $GAME_RES"
fi

echo -e "\n🏁 Backend Validation Complete."
