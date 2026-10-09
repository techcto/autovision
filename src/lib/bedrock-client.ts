import {readFile} from 'node:fs/promises';
import {BedrockRuntimeClient} from '@aws-sdk/client-bedrock-runtime';

// Optional dedicated local credentials; do not replace DynamoDB Local credentials.
// AWS deployments omit this setting and use the ECS task role.
export function createBedrockClient() {
  const filename = process.env.AUTOVISION_BEDROCK_CREDENTIALS_FILE;
  return new BedrockRuntimeClient({
    ...(filename ? {credentials: async () => {
      const value = JSON.parse(await readFile(filename, 'utf8'));
      if (typeof value.aws_access_key_id !== 'string' || typeof value.aws_secret_access_key !== 'string') {
        throw new Error('Invalid local Bedrock credential file');
      }
      return {accessKeyId: value.aws_access_key_id, secretAccessKey: value.aws_secret_access_key,
        ...(value.aws_session_token ? {sessionToken: value.aws_session_token} : {})};
    }} : {}),
  });
}
