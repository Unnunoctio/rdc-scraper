import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { getConnection, Info } from '@rdc/database'

const dynamo = new DynamoDBClient({ region: 'sa-east-1' })

type SpiderItem = {
    lambda_name: string
    config: Record<string, unknown>
}

export const handler = async () => {
    const result = await dynamo.send(
        new ScanCommand({
            TableName: process.env['SPIDER_CONFIGS_TABLE']!,
            FilterExpression: 'enabled = :enabled',
            ExpressionAttributeValues: { ':enabled': { BOOL: true } },
        })
    )

    const items = result.Items ?? []
    if (items.length === 0) return { spiders: [] }

    await getConnection()

    const spiders: SpiderItem[] = []

    for (const item of items) {
        const config = unmarshall(item) as {
            lambda_name: string
            config: Record<string, unknown>
            info: { code: string; name: string; logo: string; url: string }
        }

        await Info.updateOne({ code: config.info.code }, { $set: config.info }, { upsert: true })

        spiders.push({ lambda_name: config.lambda_name, config: config.config })
    }

    return { spiders }
}
