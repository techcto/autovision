import {readFile} from 'node:fs/promises';
import {BedrockRuntimeClient} from '@aws-sdk/client-bedrock-runtime';
import {measureBedrock} from './usage-ledger';

// Optional dedicated local credentials; do not replace DynamoDB Local credentials.
// AWS deployments omit this setting and use the ECS task role.
export function createBedrockClient() {
  const filename = process.env.AUTOVISION_BEDROCK_CREDENTIALS_FILE;
  const client = new BedrockRuntimeClient({
    ...(filename ? {credentials: async () => {
      const value = JSON.parse(await readFile(filename, 'utf8'));
      if (typeof value.aws_access_key_id !== 'string' || typeof value.aws_secret_access_key !== 'string') {
        throw new Error('Invalid local Bedrock credential file');
      }
      return {accessKeyId: value.aws_access_key_id, secretAccessKey: value.aws_secret_access_key,
        ...(value.aws_session_token ? {sessionToken: value.aws_session_token} : {})};
    }} : {}),
  });
  client.middlewareStack.add(next=>async args=>{
    const input=args.input as {modelId?:string};
    return measureBedrock(input.modelId??'unknown',async()=>{
      const result=await next(args);
      // SDK middleware returns an envelope; expose usage to the ledger without recording content.
      return Object.assign(result,{usage:(result.output as {usage?:unknown}).usage,$metadata:(result.output as {$metadata?:unknown}).$metadata});
    });
  },{step:'initialize',name:'autovisionUsageAccounting'});
  return client;
}
