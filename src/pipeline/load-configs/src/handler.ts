import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { DatabaseService, type IInfo } from '@rdc/database'
import type { ILoadConfigsResult, ISpiderConfig } from './types'

let _dynamoClient: DynamoDBDocumentClient | null = null
let _dbService: DatabaseService | null = null

function getDynamoClient(): DynamoDBDocumentClient {
    if (!_dynamoClient) {
        _dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
    }
    return _dynamoClient
}

async function getDbService(uri: string, dbName: string): Promise<DatabaseService> {
    if (!_dbService) {
        _dbService = new DatabaseService(uri, dbName)
        await _dbService.connect()
    }
    return _dbService
}

export async function handler(_event: unknown, _context: unknown): Promise<ILoadConfigsResult> {
    try {
        const uri = process.env.MONGODB_URI
        const dbName = process.env.MONGODB_DB
        const table = process.env.CONFIG_TABLE
        if (!uri || !dbName || !table) {
            throw new Error('Missing required environment variables: MONGODB_URI, MONGODB_DB, CONFIG_TABLE')
        }

        const result = await getDynamoClient().send(
            new ScanCommand({
                TableName: table,
                FilterExpression: 'enabled = :true',
                ExpressionAttributeValues: { ':true': true },
            })
        )

        const items = result.Items ?? []
        const db = await getDbService(uri, dbName)

        for (const item of items) {
            const info = item.info as IInfo | undefined
            if (info?.code) {
                await db.insertInfoIfNotExists(info)
            }
        }

        const spiders: ISpiderConfig[] = items.map((item: any) => ({
            lambda_name: item.lambda_name as string,
            config: (item.config ?? {}) as Record<string, unknown>,
        }))

        console.log(`[LoadConfigs] ${spiders.length} spider(s) loaded`)
        return { spiders }
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        console.error(`[LoadConfigs] Error: ${error}`)
        return { spiders: [], error }
    }
}
