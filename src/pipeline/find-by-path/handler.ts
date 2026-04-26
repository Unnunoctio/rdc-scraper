import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { db } from '@rdc/database'
import type { ScrapedProduct } from '@rdc/spider'

const s3 = new S3Client({ region: 'sa-east-1' })
const BUCKET = process.env['S3_BUCKET']!

export const handler = async (event: { s3_key: string; category: string; sync_token: string }) => {
    const { s3_key, category, sync_token } = event

    await db.connect()

    const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3_key }))
    const body = await response.Body!.transformToString()
    const products = JSON.parse(body) as ScrapedProduct[]
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3_key }))

    const remaining: ScrapedProduct[] = []

    for (const product of products) {
        const existing = await db.findProductByUrl(product.url)
        if (existing) {
            await db.updatePriceIfChanged(existing, product, sync_token)
        } else {
            remaining.push(product)
        }
    }

    return { remaining, sync_token, category }
}
