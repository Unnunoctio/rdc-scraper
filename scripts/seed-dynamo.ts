import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TABLE  = process.argv[2] ?? 'RDCScraper-SpiderConfigsTable'
const REGION = process.argv[3] ?? 'sa-east-1'

const dynamo = new DynamoDBClient({ region: REGION })

type SpiderConfig = {
  spider_id: string; lambda_name: string; enabled: boolean
  info: Record<string, string>; config: Record<string, unknown>
}

const configs: SpiderConfig[] = JSON.parse(
  readFileSync(join(__dirname, '../seed/spider_configs.json'), 'utf-8'),
)

for (const config of configs) {
  await dynamo.send(new PutItemCommand({
    TableName: TABLE,
    Item: marshall({
      id:          config.spider_id,
      lambda_name: config.lambda_name,
      enabled:     config.enabled,
      info:        config.info,
      config:      config.config,
    }),
  }))
  console.log(`Seeded: ${config.spider_id}`)
}
