# AutoVision

Video observations and OpenCV motion processing for connected applications.

## Local stack

`bash app.sh up` starts the application and local AWS-compatible services. Open http://localhost:8081. Root username is `root`; the default local password is `autovision-local-change-me`. Local values can be overridden in `.env`. Do not use the local defaults in AWS. Signup creates an isolated personal workspace; root can create business workspaces and manage users.

Use **Run smoke sensor simulation** on the command center to demonstrate signal → device → deterministic incident. Settings exposes the workspace credential for `POST /api/v1/signals`. Device observations use `device_id`, `type`, and numeric `value`; an optional `event_id` deduplicates incident creation. Supported observations are smoke, temperature, CO, motion, and person. The current thresholds are demonstration rules, not a certified alarm system.

`docker compose logs -f` follows all services. `docker compose down` stops them while preserving data volumes. Database data persists across container restarts. The internal vision service uses OpenCV 5 to compare image pairs and return motion observations; no smoke/fire classifier, COOL acceleration, or Ring camera integration is claimed.

## SaaS and private installs

Both use the same images. Set `DeploymentMode=saas` for multi-workspace signup, users, and billing, or `on-premise` for a private single-workspace app with billing disabled. Stripe checkout and signed webhooks require your test/live keys and price IDs. AWS templates support an optional ACM certificate.

See [DevOps](devops/README.md) and [CloudFormation](devops/cloudformation/README.md) for GitHub configuration, release images, S3 templates, and Marketplace changesets. Cloud resources and Marketplace publishing have not been deployed as part of local preparation.


Provider credentials and API keys are scoped to organizations. AutoVision keys are stored as hashes and revealed only at creation. SmartDetector encrypts provider secrets with AES-GCM. Set a stable provider/session secret and keep it unchanged across deployments.

AutoVision supports `POST /api/v1/detect` with `Authorization: Bearer av_...` and JSON containing base64 `image` and `previous_image`. The current detector computes motion between two frames. Free, Starter, and Scale quotas are 1,000, 10,000, and 100,000 comparisons/month. Configure Stripe price IDs to sell paid plans. A video adapter should sample consecutive frames and submit image pairs; arbitrary live video URLs are not accepted yet.


Release deployment assets use the `autovision-api` S3 bucket. Private media storage is created separately per stack. Local incident work is delivered through ElasticMQ; AWS deployments use EventBridge → SQS → worker. Optional Bedrock failures never block deterministic incident creation.


The application domain is `autovision.dev`. Use an ACM certificate covering this domain. The full-stack template accepts an optional `HostedZoneId` to create its Route 53 alias; otherwise configure DNS separately. Publishing buckets already exist and are not created by the application templates.

