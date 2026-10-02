#!/usr/bin/env bash
set -euo pipefail
: "${MP_AWS_MARKETPLACE_PRODUCT_ID:?Set the container product ID}"
: "${RELEASE_VERSION:?Set the immutable release version}"
: "${MP_AWS_ECR:?Set the Marketplace ECR registry}"
: "${REPOSITORY_PREFIX:=solodev/autovision}"
case "$RELEASE_VERSION" in ''|*[!0-9A-Za-z.-]*) exit 1;; esac
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
images='[]'
for service in web api worker vision; do images="$(jq --arg uri "$MP_AWS_ECR/$REPOSITORY_PREFIX-$service:$RELEASE_VERSION" '. + [$uri]' <<<"$images")"; done
jq -n --arg id "$MP_AWS_MARKETPLACE_PRODUCT_ID" --arg version "$RELEASE_VERSION" --argjson images "$images" '[{ChangeType:"AddDeliveryOptions",Entity:{Identifier:$id,Type:"ContainerProduct@1.0"},DetailsDocument:{Version:{VersionTitle:$version,ReleaseNotes:("AutoVision "+$version)},DeliveryOptions:[{DeliveryOptionTitle:"Private ECS installation",Details:{EcrDeliveryOptionDetails:{ContainerImages:$images,CompatibleServices:["ECS"],Description:"AutoVision application containers installed in the buyer AWS account.",UsageInstructions:"Deploy the CloudFormation templates at https://github.com/techcto/autovision/tree/main/devops/cloudformation with DeploymentMode=on-premise."}}}]}}]' > "$work_dir/changeset.json"
if [ "${DRY_RUN:-0}" = 1 ]; then jq . "$work_dir/changeset.json"; else aws marketplace-catalog start-change-set --catalog AWSMarketplace --change-set "file://$work_dir/changeset.json" --client-request-token "$(printf '%s' "$MP_AWS_MARKETPLACE_PRODUCT_ID:$RELEASE_VERSION" | sha256sum | cut -c1-32)"; fi

