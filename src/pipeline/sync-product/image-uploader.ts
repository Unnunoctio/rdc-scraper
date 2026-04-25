import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const s3 = new S3Client({ region: 'sa-east-1' })
const BUCKET = process.env['S3_BUCKET']!

export async function uploadImage(
  sku: string,
  category: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    const webp = await sharp(buffer).toFormat('webp', { quality: 85 }).toBuffer()

    const key = `images/${category}/${sku}/${sku}.webp`
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: webp,
      ContentType: 'image/webp',
    }))

    return `https://${BUCKET}.s3.amazonaws.com/${key}`
  } catch {
    return null
  }
}
