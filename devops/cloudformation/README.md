# AutoVision deployment

Use `autovision.yaml` to create an ALB and ECS cluster in an existing VPC. Use `autovision-existing.yaml` to attach the app to an existing cluster and listener. Private subnets need NAT or the appropriate AWS VPC endpoints for image pulls, logs, DynamoDB, and SQS.

Select `DeploymentMode=saas` for hosted workspaces and Stripe billing or `on-premise` for a private installation. Set root credentials and a random session secret at launch. Supply an ACM certificate and configure DNS for HTTPS. The existing-listener template expects you to provide an HTTPS listener.

Example parameters contain placeholders only. Do not commit filled parameter files. Deploy with `aws cloudformation create-stack --stack-name autovision-test --template-body file://devops/cloudformation/autovision.yaml --parameters file://your-private.parameters.json --capabilities CAPABILITY_IAM`.

Both modes provision DynamoDB, a private media bucket, SQS with a dead-letter queue, an EventBridge bus, IAM roles, and CloudWatch logs. Evidence buckets are retained on stack deletion. Web/API/worker run as separate ECS services. The worker task also contains the OpenCV vision sidecar.


The application domain is `autovision.dev`. Use an ACM certificate covering this domain. The full-stack template accepts an optional `HostedZoneId` to create its Route 53 alias; otherwise configure DNS separately. Publishing buckets already exist and are not created by the application templates.

## Shared ALB and ECS cluster

The existing template creates only app services, target groups, and hostname rules—not a new ALB or cluster. Supply Cluster, ListenerArn (HTTPS port 443), LoadBalancerSecurityGroup, VpcId and PrivateSubnets. HTTP-to-HTTPS redirection remains owned by the shared platform. Supply CertificateArn to attach the app certificate via SNI. Optional HostedZoneId requires LoadBalancerDnsName and LoadBalancerCanonicalHostedZoneId to create an alias. Do not overwrite existing DNS records. API priority must be lower than web priority and both unused on the listener. Defaults are 300/301. Keep the platform stack until all attached apps are removed.

