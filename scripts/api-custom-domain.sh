#!/bin/bash
# Set up api.dev.kabasika.com custom domain for API Gateway (REGIONAL)
# kabasika.com DNS is in tkh-shared account's Route 53 zone.
# Run: ./scripts/api-custom-domain.sh

set -e
DOMAIN="api.dev.kabasika.com"
CERT_ARN="arn:aws:acm:ca-central-1:873998455576:certificate/c2be9acd-dcc4-4455-a81e-61e44b52e64d"
ZONE_ID="Z0916747N8RQ4RLXFAC6"
ROUTE53_PROFILE="tkh-shared"
API_ID="6b8a9uu6z2"
STAGE="dev"
REGION="ca-central-1"

echo "=== API Gateway custom domain: $DOMAIN (REGIONAL) ==="

# 1. Wait for cert
echo "Checking ACM cert..."
until [ "$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region "$REGION" --query 'Certificate.Status' --output text)" = "ISSUED" ]; do
  echo "  Cert pending, waiting 30s..."
  sleep 30
done
echo "  Cert ISSUED."

# 2. Create REGIONAL custom domain (API is in ca-central-1)
echo "Creating API Gateway custom domain..."
aws apigateway create-domain-name \
  --domain-name "$DOMAIN" \
  --regional-certificate-arn "$CERT_ARN" \
  --endpoint-configuration types=REGIONAL \
  --region "$REGION" 2>/dev/null || echo "  (may already exist)"

# 3. Create base path mapping
echo "Creating base path mapping..."
aws apigateway create-base-path-mapping \
  --domain-name "$DOMAIN" \
  --rest-api-id "$API_ID" \
  --stage "$STAGE" \
  --region "$REGION" 2>/dev/null || echo "  (may already exist)"

# 4. Add Route 53 A record (alias to regional endpoint)
REGIONAL_DOMAIN=$(aws apigateway get-domain-name --domain-name "$DOMAIN" --region "$REGION" --query 'regionalDomainName' --output text 2>/dev/null)
REGIONAL_ZONE=$(aws apigateway get-domain-name --domain-name "$DOMAIN" --region "$REGION" --query 'regionalHostedZoneId' --output text 2>/dev/null)

if [ -n "$REGIONAL_DOMAIN" ] && [ "$REGIONAL_DOMAIN" != "None" ]; then
  echo "Adding Route 53 alias record..."
  aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --profile "$ROUTE53_PROFILE" --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"$DOMAIN\",
        \"Type\": \"A\",
        \"AliasTarget\": {
          \"HostedZoneId\": \"$REGIONAL_ZONE\",
          \"DNSName\": \"$REGIONAL_DOMAIN\",
          \"EvaluateTargetHealth\": false
        }
      }
    }]
  }"
  echo "Done. https://$DOMAIN should resolve in a few minutes."
else
  echo "Could not get regional domain. Run: aws apigateway get-domain-name --domain-name $DOMAIN --region $REGION"
fi
