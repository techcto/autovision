# AutoVision deployment

## Optional COOL backend

Both application templates accept `VisionBackend=standard|cool` (default: `standard`). Standard mode preserves the bundled OpenCV sidecars. COOL mode removes the API/worker standard sidecars and sends vision calls to `CoolVisionUrl`; web/API/worker ECS services remain otherwise unchanged. A template rule requires a URL when COOL is selected. Switching backend creates new task-definition revisions and rolls services; review the change set before executing.

`CoolVisionUrl` must be a private service implementing the same `/analyze`, `/detect`, and health protocol on a separately provisioned, licensed COOL Marketplace Graviton host. This option does **not** subscribe, install COOL, create that host, or establish award eligibility. Do not point it to a standard OpenCV instance and call that COOL. Restrict host ingress to application task security groups; do not expose an unauthenticated vision endpoint publicly. The [official Marketplace offering](https://aws.amazon.com/marketplace/pp/prodview-fdvbfiewzuehs) is AMI-based; verify entitlement and supported installation before preparing its separate reviewed CloudFormation deployment.

Keep standard mode until the COOL endpoint and Arm execution are verified. Capture the COOL version, instance type, actual workload trace, and identical-input standard-vs-COOL latency/throughput/cost measurements. A backend selection is configuration, not evidence of acceleration. Local Compose continues to use standard OpenCV.

Use `autovision.yaml` to create an ALB and ECS cluster in an existing VPC. Use `autovision-existing.yaml` to attach the app to an existing cluster and listener. Private subnets need NAT or the appropriate AWS VPC endpoints for image pulls, logs, DynamoDB, and SQS.

Select `DeploymentMode=saas` for hosted workspaces and Stripe billing or `on-premise` for a private installation. Set root credentials and a random session secret at launch. Supply an ACM certificate and configure DNS for HTTPS. The existing-listener template expects you to provide an HTTPS listener.

Example parameters contain placeholders only. Do not commit filled parameter files. The formatted templates exceed the inline CloudFormation size limit; use the release's published HTTPS S3 template URL. Create a reviewed change set with `aws cloudformation create-change-set --stack-name autovision-test --change-set-name initial-install --change-set-type CREATE --template-url YOUR_PUBLISHED_HTTPS_S3_TEMPLATE_URL --parameters file://your-private.parameters.json --capabilities CAPABILITY_IAM`. Wait for creation, inspect it with `describe-change-set`, and execute only after reviewing resources, IAM changes and replacements. Update and delete applications through CloudFormation, not manual resource operations.

## Credentials, SES and verified SaaS signup

Both application templates store root bootstrap and session-signing values in
separate Secrets Manager secrets. Stripe uses a JSON secret with `secret_key`
and `webhook_secret`. ECS `Secrets` injects these values; task definitions and
stack outputs contain only secret references. The execution role has read
permission only for the selected credentials. Secrets use the AWS-managed key
by default; optional `CoreSecretsKmsKeyArn` and `StripeCredentialsKmsKeyArn`
support customer-managed keys with service/encryption-context-scoped decrypt
permissions. The KMS key policy must also permit the execution role.

For enterprise-owned Stripe credentials, set `StripeCredentialsSecretArn` to an
existing same-account, same-region JSON secret and leave both raw Stripe
parameters empty. Otherwise supply both NoEcho `StripeSecretKey` and
`StripeWebhookSecret` and let the stack own the secret. Never supply a partial
pair or both sources. Stripe price IDs and metering settings remain ordinary
configuration; AutoVision pricing and usage-export behavior are unchanged.
Never copy SmartDetector's Stripe account keys, webhook secret or price IDs.

Preserve exact current `RootPassword` and `SessionSecret` values with
`UsePreviousValue=true` when updating an existing stack. These resources use
`RetainExceptOnCreate`: failed initial creation rolls back cleanly, while normal
stack deletion retains secrets. `UpdateReplacePolicy=Retain` protects replaced
resources. Historical task-definition revisions are not scrubbed by migration.

Rotate stack-owned values through a reviewed CloudFormation change set. After
updating credentials, increment `CoreSecretsRevision` or
`StripeCredentialsRevision` to roll tasks and load the current secret version.
Enterprise-owned secrets rotate through their owning stack/process, followed by
the same application rollout. Changing a secret alone does not refresh running
containers. Session rotation signs users out. RootPassword remains the launch
operator credential. No automatic Stripe or application-key rotation is assumed.

SaaS installs require `SesFrom` (e.g. `noreply@autovision.dev`) and
`PublicOrigin=https://autovision.dev`. Use an SES-verified sender/domain in the
deployment region and production SES access before sending to arbitrary users.
Existing SES identity and DNS verification are prerequisites, not resources
silently duplicated by these templates. Sending uses ECS task-role permissions,
not static AWS access keys. Verify the AutoVision domain independently; a verified
SmartDetector domain does not verify AutoVision. No email deliverability claim is
made until a real verification email has been received and used successfully.

New SaaS accounts require email, atomically claim it with their username, and
cannot sign in until verification succeeds. Verification tokens expire after
24 hours, are address-bound, and only the first successful verification starts
a session. Resends have a per-account 25-minute cooldown. Shared DynamoDB limits
signup to 20 requests and resend/enrollment to 10 requests per IP per 15 minutes.
Canonical PublicOrigin prevents mail-link host spoofing. Production SaaS fails
closed without real SES configuration and never exposes reset/verification links
as JSON or uses local mock delivery as a signup bypass.

Existing SaaS accounts without email sign in with their password to reach an
email enrollment form, attach an unclaimed address and verify it. They are not
silently marked verified or required to recreate their workspace. Admin-created
SaaS users also need a verified email. Password resets target the stored email,
not the username. Private/root login remains separate and does not require SES.
No dummy users or seeded production data are introduced.

`BlockedSignupDomains` defaults empty so Gmail and reviewer accounts remain
allowed. To explicitly block Gmail, set `gmail.com,googlemail.com`; subdomains
are blocked too. Email verification establishes inbox control, not proof that
the applicant is human. Keep test keys/local `.env` separate from live secrets.

Both modes provision DynamoDB, a private media bucket, SQS with a dead-letter queue, an EventBridge bus, IAM roles, and CloudWatch logs. Evidence buckets are retained on stack deletion. Web/API/worker run as separate ECS services. API and worker tasks contain the vision sidecar. ALB routes API and MCP requests to the API task.


The application domain is `autovision.dev`. Use an ACM certificate covering this domain. The full-stack template accepts an optional `HostedZoneId` to create its Route 53 alias; otherwise configure DNS separately. Publishing buckets already exist and are not created by the application templates.

## Shared ALB and ECS cluster

The existing template creates only app services, target groups, and hostname rules—not a new ALB or cluster. Supply Cluster, ListenerArn (HTTPS port 443), LoadBalancerSecurityGroup, VpcId and PrivateSubnets. HTTP-to-HTTPS redirection remains owned by the shared platform. Supply CertificateArn to attach the app certificate via SNI. Optional HostedZoneId requires LoadBalancerDnsName and LoadBalancerCanonicalHostedZoneId to create an alias. Do not overwrite existing DNS records. API priority must be lower than web priority and both unused on the listener. Defaults are 300/301. Keep the platform stack until all attached apps are removed.

## Judge quickstart

Deploy in us-east-1 for the included US Nova Lite profile. Choose `DeploymentMode=on-premise` for root-only login without signup/Stripe; `VisionAIEnabled=true` for grounding; `PublicDemoEnabled=true` for the homepage demo. `PublicDemoDailyLimit` bounds anonymous requests across replicas in DynamoDB (default 100/day). Bedrock calls incur charges; either feature flag can disable its feature. ECS uses task-role credentials, not access keys.

1. Subscribe and select an immutable published release containing this revision; local source changes do not publish images automatically.
2. Supply VPC/subnets, image prefix/tag, root credentials and a random session secret. Private subnets need AWS/Bedrock egress. Use the standalone template for a new cluster/ALB or the existing template for AppHub.
3. Create, inspect and execute the reviewed change set. Wait for healthy stack/services and open the endpoint or HTTPS domain.
4. Analyze a sample with AI checked. Verify OpenCV version 5 and a complete Nova Lite classification, not merely HTTP 200.
5. Sign in with launch root credentials, create an API key, follow the in-app REST/MCP guides, inspect job details and test revocation.

Verify the deployed revision before recording. Share judge access privately; never commit launch secrets or expose production credentials in recordings.

