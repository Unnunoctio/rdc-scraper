import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { ScrapedProduct } from '@rdc/spider'

const s3 = new S3Client({ region: 'sa-east-1' })
const BUCKET = process.env['S3_BUCKET']!
const BATCH_SIZE = 250

type BatchResult = { s3_key: string; category: string; count: number }

export const handler = async (event: { s3_keys: string[]; execution_id: string }): Promise<BatchResult[]> => {
  const { s3_keys, execution_id } = event

  const allProducts: ScrapedProduct[] = []
  await Promise.all(s3_keys.map(async key => {
    const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const body = await response.Body!.transformToString()
    allProducts.push(...(JSON.parse(body) as ScrapedProduct[]))
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
  }))

  const seen = new Set<string>()
  const unique = allProducts.filter(p => {
    if (seen.has(p.url)) return false
    seen.add(p.url)
    return true
  })

  const byCategory = new Map<string, ScrapedProduct[]>()
  for (const product of unique) {
    const cat = product.category ?? 'Uncategorized'
    const arr = byCategory.get(cat) ?? []
    arr.push(product)
    byCategory.set(cat, arr)
  }

  const batches: BatchResult[] = []
  let index = 0
  for (const [category, products] of byCategory) {
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE)
      const key = `pipeline/batches/${execution_id}/${index}.json`
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: JSON.stringify(batch),
        ContentType: 'application/json',
      }))
      batches.push({ s3_key: key, category, count: batch.length })
      index++
    }
  }

  return batches
}
