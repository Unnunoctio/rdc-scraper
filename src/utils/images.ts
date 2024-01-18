import axios from 'axios'
import { Image } from '../types'
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary'

export const uploadImages = async (imageUrl: string, category: string, brand: string, sku: number): Promise<Image> => {
  // obtener la imagen
  const res = await axios.get(imageUrl, { responseType: 'arraybuffer' } as any)
  const data = Buffer.from(res.data)

  const folder = `${category.toLowerCase()}/${brand.toLowerCase().replaceAll('/', '-')}`

  // get images
  const url280 = await getImage(data, folder, `${sku}-280`, '280')
  const url750 = await getImage(data, folder, `${sku}-750`, '750')

  return {
    small: url280,
    large: url750
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
      if (upload.url) return upload.url
    } catch (error) {
      console.log('Error al subir la imagen en cloudinary')
    }
  }
}
