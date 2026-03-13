#!/usr/bin/env bash
# Add SES DKIM CNAME records to Route 53 for kabasika.com.
# DNS for kabasika.com uses AWS nameservers - add records in Route 53.
# Usage: ./scripts/ses-add-dns-route53.sh [region]
# Prerequisites: AWS CLI, credentials with route53:ChangeResourceRecordSets

set -e
DOMAIN="kabasika.com"
REGION="${1:-ca-central-1}"

echo "=== Add SES DKIM records to Route 53 for $DOMAIN ==="
echo ""

# Get DKIM tokens from SES
echo "1. Fetching DKIM tokens from SES..."
TOKENS=$(aws sesv2 get-email-identity --email-identity "$DOMAIN" --region "$REGION" \
  --query 'DkimAttributes.Tokens[]' --output text)
if [ -z "$TOKENS" ]; then
  echo "   Error: Domain not in SES. Run ./scripts/ses-verify-domain.sh first."
  exit 1
fi
echo "   Got $(echo $TOKENS | wc -w) tokens."
echo ""

# Find hosted zone
echo "2. Finding Route 53 hosted zone for $DOMAIN..."
ZONE_ID=$(aws route53 list-hosted-zones-by-name --query "HostedZones[?Name=='${DOMAIN}.'].Id" --output text | head -1)
if [ -z "$ZONE_ID" ]; then
  ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='${DOMAIN}.'].Id" --output text | head -1)
fi
if [ -z "$ZONE_ID" ]; then
  echo "   Hosted zone for $DOMAIN not found in this AWS account."
  echo ""
  echo "   Add records manually in AWS Console:"
  echo "   https://console.aws.amazon.com/route53/v2/hostedzones"
  echo ""
  echo "   Or create hosted zone: aws route53 create-hosted-zone --name $DOMAIN --caller-reference \$(date +%s)"
  echo ""
  echo "   CNAME records to add:"
  for token in $TOKENS; do
    echo "     ${token}._domainkey.$DOMAIN  CNAME  ${token}.dkim.amazonses.com"
  done
  exit 1
fi
ZONE_ID="${ZONE_ID#/hostedzone/}"
echo "   Found zone: $ZONE_ID"
echo ""

# Build change batch
CHANGES=""
for token in $TOKENS; do
  CHANGES="${CHANGES}{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"${token}._domainkey.${DOMAIN}.\",\"Type\":\"CNAME\",\"TTL\":300,\"ResourceRecords\":[{\"Value\":\"${token}.dkim.amazonses.com\"}]}},"
done
CHANGES="[${CHANGES%,}]"

echo "3. Adding CNAME records..."
aws route53 change-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --change-batch "{\"Changes\":$CHANGES}" \
  --output text --query 'ChangeInfo.Status'
echo ""
echo "4. Update Namecheap nameservers to Custom DNS with:"
aws route53 get-hosted-zone --id "$ZONE_ID" --query 'DelegationSet.NameServers[]' --output text | tr '\t' '\n' | sed 's/^/   /'
echo ""
echo "   Domain List → kabasika.com → Manage → Domain → NAMESERVERS → Custom DNS"
echo ""
echo "5. Verification may take 10-72 min. Check status:"
echo "  aws sesv2 get-email-identity --email-identity $DOMAIN --region $REGION --query 'DkimAttributes.Status' --output text"
echo ""
