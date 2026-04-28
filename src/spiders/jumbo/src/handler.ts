import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { JumboSpider } from './jumbo-spider'
import type { IJumboHandlerEvent, IJumboHandlerResult } from './types'

let _s3: S3Client | null = null

function getS3(): S3Client {
    if (!_s3) _s3 = new S3Client({})
    return _s3
}

export async function handler(event: IJumboHandlerEvent, _context: unknown): Promise<IJumboHandlerResult> {
    try {
        const bucket = process.env.S3_PIPELINE_BUCKET
        if (!bucket) throw new Error('Missing required environment variable: S3_PIPELINE_BUCKET')

        const { config, execution_id } = event
        const spider = new JumboSpider(config as unknown as Record<string, unknown>)
        const products = await spider.run()

        const s3Key = `pipeline/runs/jumbo/${execution_id}.json`

        await getS3().send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: s3Key,
                Body: JSON.stringify(products),
                ContentType: 'application/json',
            })
        )

        console.log(`[SpiderJumbo] ${products.length} productos subidos a s3://${bucket}/${s3Key}`)
        return { s3_key: s3Key, count: products.length }
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        console.error(`[SpiderJumbo] Error: ${error}`)
        return { s3_key: '', count: 0, error }
    }
}
