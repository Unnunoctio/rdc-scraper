import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_NAME } from '../config'
import type { Image } from '../types'

export const cloudinaryConnect = (): void => {
  cloudinary.config({
    cloud_name: CLOUDINARY_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  })
  console.log('Conected to cloudinary')
}

export const uploadImages = async (imageUrl: string, category: string, brand: string, sku: number): Promise<Image> => {
  // TODO: Get product image
  const res = await fetch(imageUrl)
  const data = Buffer.from(await res.arrayBuffer())

  const folder = `${category.toLowerCase()}/${brand.toLowerCase().replaceAll('/', '-')}`

  // TODO: Upload images
  const small = await getImage(data, folder, `${sku}-200`, '200')
  const large = await getImage(data, folder, `${sku}-600`, '600')

  return {
    small,
    large
  }
}

const getImage = async (image: Buffer, folder: string, name: string, size: string): Promise<string> => {
  while (true) {
    try {
      const upload: UploadApiResponse = await new Promise((resolve) => {
        cloudinary.uploader.upload_stream(
          {
            public_id: name,
            folder,
            overwrite: true,
            transformation: [
              { aspect_ratio: '1.0', width: size, height: size, crop: 'scale' },
              { quality: 'auto:best', fetch_format: 'webp' }
            ]
          },
          (_, result) => {
            return resolve(result as UploadApiResponse)
          }
        ).end(image)
      })

      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (upload.secure_url) return upload.secure_url
    } catch (error) {
      console.log('Error uploading image to cloudinary')
    }
  }
}
