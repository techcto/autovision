#!/usr/bin/env bash
set -euo pipefail
: "${ASSETS_BUCKET:?Set the deployment assets bucket}"
# Publishing verifies infrastructure configuration; it never mutates bucket policy.
# Manage/import the publishing bucket and policy through reviewed CloudFormation.
aws s3api get-public-access-block --bucket "$ASSETS_BUCKET" --output json |
  jq -e '.PublicAccessBlockConfiguration | .BlockPublicPolicy == false and .RestrictPublicBuckets == false' >/dev/null || {
    echo "Public template access is blocked. Update the owning CloudFormation stack before publishing." >&2
    exit 1
  }
aws s3api get-bucket-policy --bucket "$ASSETS_BUCKET" --query Policy --output text |
  jq -e --arg resource "arn:aws:s3:::$ASSETS_BUCKET/cloudformation/*" 'any(.Statement[]; .Effect == "Allow" and .Principal == "*" and (.Action == "s3:GetObject" or (.Action | type == "array" and index("s3:GetObject") != null)) and (.Resource == $resource or (.Resource | type == "array" and index($resource) != null)) and (.Condition == null))' >/dev/null || {
    echo "Public template policy is missing. Update the owning CloudFormation stack before publishing." >&2
    exit 1
  }
