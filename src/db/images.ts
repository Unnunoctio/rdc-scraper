import type { Db, ObjectId } from 'mongodb'
import type { Image } from '../types'
import { uploadImages } from '../utils/cloudinary'

export const saveImage = async (db: Db, imageUrl: string, category: string, brand: string, sku: number): Promise<ObjectId | undefined> => {
  try {
    const collection = db.collection<Image>('images')
    const cloudImages = await uploadImages(imageUrl, category, brand, sku)

    const newImage = await collection.insertOne({ small: cloudImages.small, large: cloudImages.large })
    return newImage.insertedId
  } catch (error) {
    console.error('Error saving images:', error)
    return undefined
  }
}

export const deleteImage = async (db: Db, imageId: ObjectId | undefined): Promise<void> => {
  if (imageId === undefined) return

  try {
    const collection = db.collection<Image>('images')
    await collection.deleteOne({ _id: imageId })
  } catch (error) {
    console.error('Error deleting image:', imageId)
  }
}
