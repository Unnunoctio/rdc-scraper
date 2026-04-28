import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { IBatchRef, IMergeResultsEvent, IMergeResultsResult, IS3SpiderRef } from './types'

const BATCH_SIZE = 250

let _s3: S3Client | null = null

function getS3(): S3Client {
    if (!_s3) _s3 = new S3Client({})
    return _s3
}

async function loadSpiderResults(s3Refs: IS3SpiderRef[], bucket: string): Promise<Record<string, unknown>[]> {
    const products: Record<string, unknown>[] = []
    for (const ref of s3Refs) {
        const { Body } = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: ref.s3_key }))
        if (Body) {
            const text = await Body.transformToString()
            products.push(...(JSON.parse(text) as Record<string, unknown>[]))
        }
        await getS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: ref.s3_key }))
    }
    return products
}

function deduplicate(products: Record<string, unknown>[]): Record<string, unknown>[] {
    const seen = new Set<string>()
    return products.filter((p) => {
        const url = p['url'] as string | undefined
        if (!url || seen.has(url)) return false
        seen.add(url)
        return true
    })
}

function groupByCategory(products: Record<string, unknown>[]): Map<string, Record<string, unknown>[]> {
    const groups = new Map<string, Record<string, unknown>[]>()
    for (const p of products) {
        const category = (p['category'] as string | undefined) ?? ''
        if (!groups.has(category)) groups.set(category, [])
        groups.get(category)!.push(p)
    }
    return groups
}

async function writeBatches(groups: Map<string, Record<string, unknown>[]>, executionId: string, bucket: string): Promise<IBatchRef[]> {
    const batchRefs: IBatchRef[] = []
    let index = 0
    for (const [category, products] of groups) {
        for (let i = 0; i < products.length; i += BATCH_SIZE) {
            const batch = products.slice(i, i + BATCH_SIZE)
            const key = `pipeline/batches/${executionId}/${index}.json`
            await getS3().send(
                new PutObjectCommand({
                    Bucket: bucket,
                    Key: key,
                    Body: JSON.stringify(batch),
                    ContentType: 'application/json',
                })
            )
            batchRefs.push({ s3_key: key, category, count: batch.length })
            index++
        }
    }
    return batchRefs
}

export async function handler(event: IMergeResultsEvent): Promise<IMergeResultsResult> {
    const bucket = process.env.S3_PIPELINE_BUCKET
    if (!bucket) throw new Error('Missing required environment variable: S3_PIPELINE_BUCKET')

    const { s3_keys: s3Refs = [], execution_id: executionId = 'local' } = event

    const allProducts = await loadSpiderResults(s3Refs, bucket)
    const unique = deduplicate(allProducts)
    const groups = groupByCategory(unique)
    const batchRefs = await writeBatches(groups, executionId, bucket)

    console.log(`[MergeResults] ${allProducts.length} total → ${unique.length} unique → ${batchRefs.length} batches (${groups.size} categories)`)
    return batchRefs
}
