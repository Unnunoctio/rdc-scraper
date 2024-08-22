import { model, Schema } from 'mongoose'
import { generateId } from '../utils/generation'
import type { ImageDB } from '../types'

const ImageSchema = new Schema({
  _id: { type: String, default: () => generateId() },
  small: { type: String, required: true },
  large: { type: String, required: true }
}, {
  timestamps: true,
  versionKey: false
})

const ImageModel = model<ImageDB>('Image', ImageSchema, 'images')
export default ImageModel
