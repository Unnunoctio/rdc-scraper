import { model, Schema } from 'mongoose'
import { generateId, generateSku } from '../utils/generation'
import type { ProductDB } from '../types'

const ProductSchema = new Schema({
  _id: { type: String, default: () => generateId() },
  sku: { type: String, default: () => generateSku(), unique: true, index: true },
  quantity: { type: Number, required: true, min: 0, index: true },
  images: { type: String, ref: 'Image' },
  drink: { type: String, ref: 'Drink', index: true },
  websites: [{ type: String, ref: 'Website' }]
}, {
  timestamps: true,
  versionKey: false
})

const ProductModel = model<ProductDB>('Product', ProductSchema, 'products')
export default ProductModel
