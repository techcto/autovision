#!/usr/bin/env bash
set -euo pipefail
: "${ASSETS_BUCKET:?Set the deployment assets bucket}"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
if ! aws s3api get-bucket-policy --bucket "$ASSETS_BUCKET" --query Policy --output text > "$work_dir/current.json" 2> "$work_dir/error.txt"; then
  if grep -q '(NoSuchBucketPolicy)' "$work_dir/error.txt"; then
    printf '%s' '{"Version":"2012-10-17","Statement":[]}' > "$work_dir/current.json"
  else
    cat "$work_dir/error.txt" >&2
    exit 1
  fi
fi
aws s3api put-public-access-block --bucket "$ASSETS_BUCKET" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
jq --arg bucket "$ASSETS_BUCKET" '.Statement=((.Statement//[])|map(select(.Sid!="PublicDeploymentTemplates")))|.Statement += [{Sid:"PublicDeploymentTemplates",Effect:"Allow",Principal:"*",Action:"s3:GetObject",Resource:("arn:aws:s3:::"+$bucket+"/cloudformation/*")}]' "$work_dir/current.json" > "$work_dir/policy.json"
aws s3api put-bucket-policy --bucket "$ASSETS_BUCKET" --policy "file://$work_dir/policy.json"

