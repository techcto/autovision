# AutoVision DevOps

Dockerfiles live in `devops/docker`; root Compose runs web, API, worker, DynamoDB Local, ElasticMQ, and S3Mock, plus OpenCV vision. Application code and Next.js API routes live in `src`. Public assets live in `public`.

CI runs types, lint, tests, builds, Compose validation, and CloudFormation lint. Release tags build and publish every application image and versioned CloudFormation templates before submitting a Marketplace delivery changeset. `DRY_RUN=1` on `devops/changeset.sh` prints the payload without submitting it.

Set GitHub variables: `AWS_REGION`, `ASSETS_BUCKET`, `REPOSITORY_PREFIX` (default `solodev/autovision`), and `AWS_ROLE_ARN` for OIDC. The access-key alternative uses `MP_AWS_ACCESS_KEY_ID` and secret `MP_AWS_SECRET_ACCESS_KEY`. Marketplace additionally needs `MP_AWS_ECR`, `MP_AWS_ACCOUNT_ID`, and `MP_AWS_MARKETPLACE_PRODUCT_ID`. Each product needs its own ID. Create ECR repositories for web, api, worker, vision in the target registry first. Marketplace-owned repositories must be created through the seller account. The workflow never creates a product or changes listing visibility.

Release with an immutable `v0.1.0` tag or workflow dispatch. The changeset adds a private-install delivery version to an existing container listing. Listing visibility, buyer access/private offers, commercial pricing, and any Marketplace usage metering remain seller configuration. SaaS billing uses Stripe; it is separate from the private container product.

Deployment assets can be made publicly readable under only the bucket's `cloudformation/` prefix using `public-assets.yml` (manual dispatch). Application media stays private. Configure AWS IAM and GitHub variables before triggering publishing. No live account identifiers, credentials, or product IDs are committed.


The publishing assets bucket defaults to `autovision-api`. Use the shared publishing account through the existing MP_AWS variables/secrets or the OIDC role. Secrets do not automatically become available in a new repository unless their organization/environment access policy allows it. Configure a separate Marketplace container product ID for each app before submitting changesets.


The application domain is `autovision.dev`. Use an ACM certificate covering this domain. The full-stack template accepts an optional `HostedZoneId` to create its Route 53 alias; otherwise configure DNS separately. Publishing buckets already exist and are not created by the application templates.

