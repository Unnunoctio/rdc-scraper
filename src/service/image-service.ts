import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'
import { CLOUDINARY_FOLDER } from '../config'
import type { Image } from '../types'
import ImageModel from '../db/image-model'

const uploadImage = async (image: Buffer, folder: string, name: string, size: string): Promise<string> => {
  while (true) {
    try {
      const upload: UploadApiResponse = await new Promise((resolve) => {
        cloudinary.uploader.upload_stream({
          public_id: name,
          folder,
          overwrite: true,
          transformation: [
            { aspect_ratio: '1.0', width: size, height: size, crop: 'scale' },
            { quality: 'auto:best', fetch_format: 'webp' }
          ]
        }, (_, result) => {
          return resolve(result as UploadApiResponse)
        }).end(image)
      })

      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (upload.secure_url) return upload.secure_url
    } catch (error) {
      console.log('Error uploading image to cloudinary')
    }
  }
}

const uploadImages = async (url: string, category: string, brand: string, sku: string): Promise<Image> => {
  const res = await fetch(url)
  const data = Buffer.from(await res.arrayBuffer())

  const folder = `${CLOUDINARY_FOLDER as string}/${category.toLowerCase()}/${brand.toLowerCase().replaceAll('/', '-')}/${sku}`

  const small = await uploadImage(data, folder, `${sku}-200`, '200')
  const large = await uploadImage(data, folder, `${sku}-600`, '600')

  return {
    small: small.replace(/\/v\d+\//, '/'),
    large: large.replace(/\/v\d+\//, '/')
  }
}

const saveImage = async (url: string, category: string, brand: string, sku: string): Promise<string | undefined> => {
  try {
    const cloud = await uploadImages(url, category, brand, sku)
    const newImage = await ImageModel.create(cloud)
    return newImage._id
  } catch (error) {
    console.error('Error saving image:', error)
    return undefined
  }
}

export const imageService = {
  saveImage
}
