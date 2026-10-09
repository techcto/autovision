import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, UpdateCommand} from '@aws-sdk/lib-dynamodb';
import {store} from './store';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({endpoint: process.env.AUTOVISION_DYNAMODB_ENDPOINT}));
let day = '', used = 0;
export async function publicBudget() {
  if (process.env.AUTOVISION_PUBLIC_DEMO_ENABLED === 'false') return false;
  const today = new Date().toISOString().slice(0, 10);
  const limit = Number(process.env.AUTOVISION_PUBLIC_DEMO_DAILY_LIMIT ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) return false;
  const table = process.env.AUTOVISION_TABLE;
  if (!table) {if (today !== day) {day = today; used = 0;} return ++used <= limit;}
  if(process.env.AUTOVISION_DYNAMODB_ENDPOINT)await store.ensureSingleDeploymentOrg();
  try {
    await db.send(new UpdateCommand({TableName: table, Key: {pk: 'PUBLIC#DEMO', sk: today}, UpdateExpression: 'ADD #count :one SET #ttl = :ttl', ConditionExpression: 'attribute_not_exists(#count) OR #count < :limit', ExpressionAttributeNames: {'#count': 'count', '#ttl': 'ttl'}, ExpressionAttributeValues: {':one': 1, ':limit': limit, ':ttl': Math.floor(Date.now()/1000)+172800}}));
    return true;
  } catch (e) {if (e instanceof Error && e.name === 'ConditionalCheckFailedException') return false; throw new MediaErrorBudget();}
}
class MediaErrorBudget extends Error {constructor() {super('Public demo temporarily unavailable');}}
