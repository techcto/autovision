# Hackathon local testing

Synthetic admin sample data is enabled only with `NODE_ENV=development` and
`AUTOVISION_DEPLOYMENT_MODE=on-premise`, using in-memory or local DynamoDB storage.
SaaS mode and all production builds (including local production previews) never seed it.
Changing this gate does not delete previously seeded data. The real-agent test fixture,
where available, uses its separate explicit enrollment workflow rather than synthetic logs.

Requirements: Docker Compose and Node.js 26 for host checks. From this repo:

```sh
# First setup only; preserve any existing .env.
cp -n .env.example .env
bash app.sh up
curl --fail http://localhost:8081/api/health
```

Open http://localhost:8081; example login is `root` /
`autovision-local-change-me`. Set unique root/session secrets in the ignored
`.env`. Compose uses `.env` for interpolation, not automatic injection of every
variable. Recreate containers after changing configuration. `bash app.sh down`
stops the stack without deleting volumes; avoid `down -v`.

## Enable real local Bedrock, separately from local storage

The default stack uses dummy credentials for DynamoDB Local, ElasticMQ and S3mock.
Real Bedrock requires an approved AWS identity with scoped model invocation
permissions. Use a short-lived development credential JSON file **outside the
repository**, readable only by your user and the intended container process:

```json
{"aws_access_key_id":"SESSION_ACCESS_KEY","aws_secret_access_key":"SESSION_SECRET","aws_session_token":"SESSION_TOKEN"}
```

This is the lowercase schema consumed by `src/lib/bedrock-client.ts`; do not
paste differently shaped CLI exports unchanged. Do not commit or print real
credentials. Set only the file's absolute host path in your ignored `.env`:

```dotenv
AWS_REGION=us-east-1
AUTOVISION_BEDROCK_CREDENTIALS_PATH=/absolute/private/path/bedrock-session.json
```

After initial `app.sh up` creates the shared network:

```sh
docker compose -f docker-compose.yml -f devops/testing/bedrock.compose.json up -d --build
```

The override read-only mounts that file into web/API, enables
`us.amazon.nova-lite-v1:0`, and keeps the dummy storage credentials separate.
It does not enable real Bedrock in the worker. Refresh expired sessions and
repeat the same Compose file list when recreating services. The region/profile
must support the selected model and inference profile. Failures are not negative
detections. Bedrock calls cost money; keep uploads and loop budgets bounded.

For host Next.js instead, use `.env.local` and
`AUTOVISION_BEDROCK_CREDENTIALS_FILE` pointing at that JSON, or omit the file
setting and use an approved AWS SDK profile/session. Production omits local
credential-file settings and uses its ECS task role, with CloudFormation-managed
model parameters and IAM. Local `.env` changes never update production.

## Live demo and checks

```sh
npm ci
npm run typecheck
npm run test:web
npm run lint
npm run test:mcp:local
# Explicit opt-in to billable inference, after credentials are configured:
AUTOVISION_TEST_BEDROCK=true npm run test:mcp:local
```

Use a new authorized image/video upload for the live pipeline. Enable enhanced
inspection and AI consent (`classify:true`) as documented in the API reference.
Show the actual OpenCV 5 runtime version, detections, planner-selected tool,
tool result and changed follow-up/review recommendation. The trace is structured
decision evidence, not private model chain-of-thought. Show a failure case and
human review control as well. Do not claim COOL acceleration without measuring it.

Supplied homepage videos use cached reports to avoid repeat inference costs;
viewing them is not a live Bedrock test. Live uploads invoke the real pipeline.
Use bounded authorized footage, not private customer material. See the README's
autonomous-app API examples for request flags, tool budgets and limitations.
