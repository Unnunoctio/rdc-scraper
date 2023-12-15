import { Schema, model } from 'mongoose'
import { Image } from '../types'

const ImageSchema = new Schema<Image>({
  small: { type: String, required: true },
  large: { type: String, required: true }
})

const ImageModel = model<Image>('Image', ImageSchema)

export default ImageModel
