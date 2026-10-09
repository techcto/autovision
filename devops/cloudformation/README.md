# AutoVision deployment

Use `autovision.yaml` to create an ALB and ECS cluster in an existing VPC. Use `autovision-existing.yaml` to attach the app to an existing cluster and listener. Private subnets need NAT or the appropriate AWS VPC endpoints for image pulls, logs, DynamoDB, and SQS.

Select `DeploymentMode=saas` for hosted workspaces and Stripe billing or `on-premise` for a private installation. Set root credentials and a random session secret at launch. Supply an ACM certificate and configure DNS for HTTPS. The existing-listener template expects you to provide an HTTPS listener.

Example parameters contain placeholders only. Do not commit filled parameter files. Create a reviewed change set with `aws cloudformation create-change-set --stack-name autovision-test --change-set-name initial-install --change-set-type CREATE --template-body file://devops/cloudformation/autovision.yaml --parameters file://your-private.parameters.json --capabilities CAPABILITY_IAM`. Wait for creation, inspect it with `describe-change-set`, and execute only after reviewing resources, IAM changes and replacements. Update and delete applications through CloudFormation, not manual resource operations.

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

