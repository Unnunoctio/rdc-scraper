import { Schema, model } from 'mongoose'
import { Product } from '../types'

const ProductSchema = new Schema<Product>({
  sku: { type: Number, required: true, unique: true },
  quantity: { type: Number, required: true },
  images: { type: Schema.Types.ObjectId, ref: 'Image' },
  drink: { type: Schema.Types.ObjectId, ref: 'Drink' },
  websites: [{ type: Schema.Types.ObjectId, ref: 'Website' }]
})

const ProductModel = model<Product>('Product', ProductSchema)

export default ProductModel
