import { v2 as cloudinaryV2, type UploadApiResponse } from 'cloudinary'
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER, CLOUDINARY_NAME } from '../../config'
import type { Image } from '../../types'

const startCloudinary = (): void => {
  cloudinaryV2.config({
    cloud_name: CLOUDINARY_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  })
  console.log('Connected to Cloudinary')
}

const uploadImage = async (image: Buffer, folder: string, name: string, size: string): Promise<string> => {
  try {
    const uploadResult: UploadApiResponse = await new Promise((resolve, reject) => {
      cloudinaryV2.uploader.upload_stream({
        public_id: name,
        folder,
        overwrite: true,
        transformation: [
          { aspect_ratio: '1.0', width: size, height: size, crop: 'pad' },
          { quality: 'auto:best', fetch_format: 'webp' }
        ]
      }, (error, result) => {
        if (error !== undefined) reject(error)
        else resolve(result as UploadApiResponse)
      }).end(image)
    })

    if (uploadResult.secure_url !== undefined) return uploadResult.secure_url.replace(/\/v\d+\//, '/')
    return ''
  } catch (error) {
    console.error('Error uploading image to cloudinary', error)
    return ''
  }
}

const saveImages = async (imageUrl: string, category: string, brand: string, sku: string): Promise<Image> => {
  const res = await fetch(imageUrl)
  const buffer = Buffer.from(await res.arrayBuffer())

  const folder = `${CLOUDINARY_FOLDER as string}/${category.toLowerCase()}/${brand.toLowerCase().replaceAll('/', '-')}/${sku}`

  const small = await uploadImage(buffer, folder.replaceAll(' ', '-'), `${sku}-200`, '200')
  const large = await uploadImage(buffer, folder.replaceAll(' ', '-'), `${sku}-600`, '600')
  const original = await uploadImage(buffer, folder.replaceAll(' ', '-'), `${sku}`, '1500')

  return { small, large, original }
}

export const cloudinary = {
  startCloudinary,
  saveImages
}
