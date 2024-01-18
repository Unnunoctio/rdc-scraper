import axios from 'axios'
import { Image } from '../types'
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary'

export const uploadImages = async (imageUrl: string, category: string, brand: string, sku: number): Promise<Image> => {
  // obtener la imagen
  const res = await axios.get(imageUrl, { responseType: 'arraybuffer' } as any)
  const data = Buffer.from(res.data)

  // upload image 280px
  const upload280: UploadApiResponse = await new Promise((resolve) => {
    cloudinary.uploader.upload_stream(
      {
        public_id: `${sku}-280`,
        folder: `${category.toLowerCase()}/${brand.toLowerCase().replaceAll('/', '-')}`,
        overwrite: true,
        transformation: [
          { aspect_ratio: '1.0', width: '280', height: '280', crop: 'scale' },
          { quality: 'auto:best', fetch_format: 'webp' }
        ]
      },
      (_, result) => {
        return resolve(result as UploadApiResponse)
      }).end(data)
  })

  // upload image 750px
  const upload750: UploadApiResponse = await new Promise((resolve) => {
    cloudinary.uploader.upload_stream(
      {
        public_id: `${sku}-750`,
        folder: `${category.toLowerCase()}/${brand.toLowerCase().replaceAll('/', '-')}`,
        overwrite: true,
        transformation: [
          { aspect_ratio: '1.0', width: '750', height: '750', crop: 'scale' },
          { quality: 'auto:best', fetch_format: 'webp' }
        ]
      },
      (_, result) => {
        return resolve(result as UploadApiResponse)
      }).end(data)
  })

  return {
    small: upload280.url,
    large: upload750.url
  }
}
