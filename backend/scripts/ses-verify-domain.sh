#!/usr/bin/env bash
# Verify kabasika.com in AWS SES via CLI.
# Prerequisites: AWS CLI installed, credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
# Usage: ./scripts/ses-verify-domain.sh [region]
# Default region: ca-central-1

set -e
DOMAIN="${SES_DOMAIN:-kabasika.com}"
REGION="${1:-ca-central-1}"

echo "=== AWS SES Domain Verification: $DOMAIN (region: $REGION) ==="
echo ""

# 1. Create domain identity (idempotent - safe to re-run)
echo "1. Creating domain identity..."
if aws sesv2 get-email-identity --email-identity "$DOMAIN" --region "$REGION" 2>/dev/null | grep -q IdentityType; then
  echo "   Identity already exists."
else
  aws sesv2 create-email-identity --email-identity "$DOMAIN" --region "$REGION" >/dev/null
  echo "   Identity created."
fi
echo ""

# 2. Get DKIM CNAME records to add to DNS
echo "2. Add these CNAME records in Namecheap (Domain List → $DOMAIN → Manage → Advanced DNS):"
echo ""
for token in $(aws sesv2 get-email-identity --email-identity "$DOMAIN" --region "$REGION" \
  --query 'DkimAttributes.Tokens[]' --output text); do
  echo "   Type:   CNAME"
  echo "   Host:   ${token}._domainkey"
  echo "   Value:  ${token}.dkim.amazonses.com"
  echo ""
done

echo "3. TTL: Automatic or 300. Save each record."
echo ""
echo "4. After adding records, wait 10–72 min. Check status:"
echo "   aws sesv2 get-email-identity --email-identity $DOMAIN --region $REGION --query 'DkimAttributes.Status' --output text"
echo ""
echo "5. When Status is SUCCESS, update .env:"
echo "   AWS_SES_FROM=noreply@$DOMAIN"
echo ""
