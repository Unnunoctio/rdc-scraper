import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { JumboSpider } from './spider'

const s3 = new S3Client({ region: process.env['AWS_REGION'] ?? 'sa-east-1' })

export const handler = async (event: { config: Record<string, unknown>; executionId: string }) => {
    const spider = new JumboSpider(event.config)
    const products = await spider.run()
    const bucket = process.env['S3_BUCKET']!
    const key = `spider/jumbo/${event.executionId}.json`
    await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: JSON.stringify(products),
            ContentType: 'application/json',
        })
    )
    return { source: 'jumbo', s3Key: key, count: products.length }
}
