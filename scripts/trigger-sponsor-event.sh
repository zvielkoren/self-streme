#!/bin/bash

# Sponsor Event Trigger Script
# Manually triggers sponsor events via GitHub repository_dispatch API
# Usage: ./scripts/trigger-sponsor-event.sh <event-type> <sponsor-login> [additional-params]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER="${GITHUB_REPOSITORY_OWNER:-zviel}"
REPO_NAME="${GITHUB_REPOSITORY_NAME:-self-streme}"
SPONSOR_TOKEN="${SPONSOR_TOKEN}"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to display usage
usage() {
    cat << EOF
${BLUE}Sponsor Event Trigger Script${NC}

Manually triggers sponsor events via GitHub repository_dispatch API.

${YELLOW}USAGE:${NC}
  $0 <event-type> <sponsor-login> [options]

${YELLOW}EVENT TYPES:${NC}
  sponsor-created          New sponsor joined
  sponsor-cancelled        Sponsor cancelled
  sponsor-tier-changed     Sponsor changed tier

${YELLOW}OPTIONS:${NC}
  --tier-name <name>       Sponsor tier name (required for created/cancelled)
  --monthly-amount <num>   Monthly amount in dollars (optional for created)
  --new-tier <name>        New tier name (required for tier-changed)
  --old-tier <name>        Old tier name (optional for tier-changed)
  --token <token>          GitHub token (or set SPONSOR_TOKEN env var)

${YELLOW}EXAMPLES:${NC}
  # New sponsor
  $0 sponsor-created john_doe --tier-name "Gold Sponsor" --monthly-amount 50

  # Tier change
  $0 sponsor-tier-changed john_doe --new-tier "Platinum Sponsor" --old-tier "Gold Sponsor"

  # Cancellation
  $0 sponsor-cancelled john_doe --tier-name "Silver Sponsor"

${YELLOW}ENVIRONMENT VARIABLES:${NC}
  SPONSOR_TOKEN             GitHub personal access token (required)
  GITHUB_REPOSITORY_OWNER  Repository owner (default: zviel)
  GITHUB_REPOSITORY_NAME   Repository name (default: self-streme)

${YELLOW}NOTES:${NC}
  - This script is for manual testing and triggering
  - Requires GitHub token with 'repo' scope
  - In production, use GitHub Sponsors webhooks instead
  - For automated setup, see SPONSORS_AUTOMATION.md

EOF
    exit 1
}

# Check if enough arguments
if [ $# -lt 2 ]; then
    print_error "Missing required arguments"
    echo
    usage
fi

# Parse arguments
EVENT_TYPE="$1"
SPONSOR_LOGIN="$2"
shift 2

TIER_NAME=""
MONTHLY_AMOUNT=""
NEW_TIER=""
OLD_TIER=""

while [ $# -gt 0 ]; do
    case "$1" in
        --tier-name)
            TIER_NAME="$2"
            shift 2
            ;;
        --monthly-amount)
            MONTHLY_AMOUNT="$2"
            shift 2
            ;;
        --new-tier)
            NEW_TIER="$2"
            shift 2
            ;;
        --old-tier)
            OLD_TIER="$2"
            shift 2
            ;;
        --token)
            SPONSOR_TOKEN="$2"
            shift 2
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate inputs
if [ -z "$SPONSOR_TOKEN" ]; then
    print_error "SPONSOR_TOKEN is required"
    echo "Set it via environment variable or --token option"
    exit 1
fi

if [ -z "$SPONSOR_LOGIN" ]; then
    print_error "Sponsor login is required"
    exit 1
fi

# Validate event type
case "$EVENT_TYPE" in
    sponsor-created)
        if [ -z "$TIER_NAME" ]; then
            print_error "tier-name is required for sponsor-created event"
            exit 1
        fi
        ;;
    sponsor-cancelled)
        if [ -z "$TIER_NAME" ]; then
            print_error "tier-name is required for sponsor-cancelled event"
            exit 1
        fi
        ;;
    sponsor-tier-changed)
        if [ -z "$NEW_TIER" ]; then
            print_error "new-tier is required for sponsor-tier-changed event"
            exit 1
        fi
        ;;
    *)
        print_error "Invalid event type: $EVENT_TYPE"
        echo "Valid types: sponsor-created, sponsor-cancelled, sponsor-tier-changed"
        exit 1
        ;;
esac

# Build JSON payload
print_info "Building event payload..."

case "$EVENT_TYPE" in
    sponsor-created)
        PAYLOAD=$(cat <<EOF
{
  "event_type": "$EVENT_TYPE",
  "client_payload": {
    "sponsor_login": "$SPONSOR_LOGIN",
    "tier_name": "$TIER_NAME",
    "monthly_amount": "${MONTHLY_AMOUNT:-0}"
  }
}
EOF
)
        ;;
    sponsor-cancelled)
        PAYLOAD=$(cat <<EOF
{
  "event_type": "$EVENT_TYPE",
  "client_payload": {
    "sponsor_login": "$SPONSOR_LOGIN",
    "tier_name": "$TIER_NAME"
  }
}
EOF
)
        ;;
    sponsor-tier-changed)
        PAYLOAD=$(cat <<EOF
{
  "event_type": "$EVENT_TYPE",
  "client_payload": {
    "sponsor_login": "$SPONSOR_LOGIN",
    "new_tier": "$NEW_TIER",
    "old_tier": "${OLD_TIER:-Unknown}"
  }
}
EOF
)
        ;;
esac

# Display summary
echo
print_info "Event Summary:"
echo "  Repository: $REPO_OWNER/$REPO_NAME"
echo "  Event Type: $EVENT_TYPE"
echo "  Sponsor: @$SPONSOR_LOGIN"
case "$EVENT_TYPE" in
    sponsor-created)
        echo "  Tier: $TIER_NAME"
        [ -n "$MONTHLY_AMOUNT" ] && echo "  Amount: \$$MONTHLY_AMOUNT/month"
        ;;
    sponsor-cancelled)
        echo "  Tier: $TIER_NAME"
        ;;
    sponsor-tier-changed)
        echo "  New Tier: $NEW_TIER"
        echo "  Old Tier: $OLD_TIER"
        ;;
esac
echo

# Confirm before sending
read -p "Trigger this event? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Cancelled by user"
    exit 0
fi

# Send repository_dispatch event
print_info "Sending repository_dispatch event..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $SPONSOR_TOKEN" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/dispatches" \
    -d "$PAYLOAD")

# Extract status code
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | head -n-1)

# Check response
if [ "$HTTP_CODE" = "204" ]; then
    print_success "Event triggered successfully!"
    echo
    print_info "Check GitHub Actions:"
    echo "  https://github.com/$REPO_OWNER/$REPO_NAME/actions"
    echo
    print_info "Workflow should start within a few seconds."
    echo
    exit 0
else
    print_error "Failed to trigger event (HTTP $HTTP_CODE)"
    if [ -n "$RESPONSE_BODY" ]; then
        echo "Response: $RESPONSE_BODY"
    fi
    exit 1
fi
