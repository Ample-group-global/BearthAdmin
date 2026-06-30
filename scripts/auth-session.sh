#!/bin/bash
# ============================================================
# Auth Session Helper Script
# Manages admin session for the whitelist backend API
# ============================================================

API_BASE="https://remarkable-consideration-production-1c76.up.railway.app"
ADMIN_ADDRESS="0xfb989d8296dd44d26c55ac8b839d998add5e9d01"
COOKIE_FILE="/tmp/admin_session_cookie.txt"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

usage() {
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN} Auth Session Helper${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""
  echo "Usage: $0 <command>"
  echo ""
  echo "Commands:"
  echo "  login       Create a new admin session"
  echo "  verify      Verify current session"
  echo "  whitelist   Fetch the whitelist"
  echo "  cookie      Print the saved cookie"
  echo ""
  echo "Examples:"
  echo "  $0 login"
  echo "  $0 verify"
  echo "  $0 whitelist"
  echo ""
}

# ---- Step 1: Create session ----
cmd_login() {
  echo -e "${YELLOW}Creating session for ${ADMIN_ADDRESS}...${NC}"
  
  RESPONSE=$(curl -s -X POST "${API_BASE}/api/auth/session" \
    -H "Content-Type: application/json" \
    -d "{\"address\":\"${ADMIN_ADDRESS}\"}")

  echo -e "${GREEN}Response:${NC}"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

  # Extract cookie from response
  COOKIE=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('cookie',''))" 2>/dev/null)

  if [ -n "$COOKIE" ] && [ "$COOKIE" != "" ]; then
    echo "$COOKIE" > "$COOKIE_FILE"
    echo ""
    echo -e "${GREEN}✓ Cookie saved to ${COOKIE_FILE}${NC}"
    echo -e "${CYAN}Cookie: ${COOKIE}${NC}"
  else
    echo ""
    echo -e "${RED}✗ Could not extract cookie from response${NC}"
  fi
}

# ---- Step 2: Verify session ----
cmd_verify() {
  if [ ! -f "$COOKIE_FILE" ]; then
    echo -e "${RED}✗ No saved cookie. Run '$0 login' first.${NC}"
    exit 1
  fi
  
  COOKIE=$(cat "$COOKIE_FILE")
  echo -e "${YELLOW}Verifying session...${NC}"
  
  RESPONSE=$(curl -s "${API_BASE}/api/auth/verify" \
    -H "Cookie: ${COOKIE}")

  echo -e "${GREEN}Response:${NC}"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
}

# ---- Step 3: Fetch whitelist ----
cmd_whitelist() {
  if [ ! -f "$COOKIE_FILE" ]; then
    echo -e "${RED}✗ No saved cookie. Run '$0 login' first.${NC}"
    exit 1
  fi
  
  COOKIE=$(cat "$COOKIE_FILE")
  echo -e "${YELLOW}Fetching whitelist...${NC}"
  
  RESPONSE=$(curl -s "${API_BASE}/api/whitelist" \
    -H "Cookie: ${COOKIE}")

  echo -e "${GREEN}Response:${NC}"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
}

# ---- Print saved cookie ----
cmd_cookie() {
  if [ ! -f "$COOKIE_FILE" ]; then
    echo -e "${RED}✗ No saved cookie. Run '$0 login' first.${NC}"
    exit 1
  fi
  echo -e "${CYAN}$(cat "$COOKIE_FILE")${NC}"
}

# ---- Main ----
case "${1:-}" in
  login)    cmd_login ;;
  verify)   cmd_verify ;;
  whitelist) cmd_whitelist ;;
  cookie)   cmd_cookie ;;
  *)        usage ;;
esac
