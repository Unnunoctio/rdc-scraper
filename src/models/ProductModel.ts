import { Schema, model } from 'mongoose'
import { Product } from '../types'

const ProductSchema = new Schema<Product>({
  title: { type: String, required: true, unique: true },
  quantity: { type: Number, required: true },
  images: {
    small: { type: String, required: true },
    large: { type: String, required: true }
  },
  product: {
    _id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    brand: { type: String, required: true },
    alcoholic_grade: { type: Number, required: true },
    content: { type: Number, required: true },
    package: { type: String, required: true },
    category: { type: String, required: true },
    sub_category: { type: String, required: true },
    made_in: { type: String },
    variety: { type: String }, // Cervezas
    bitterness: { type: String }, // Cervezas
    strain: { type: String }, // Vinos
    vineyard: { type: String } // Vinos
  },
  websites: [
    {
      name: { type: String, required: true },
      logo: { type: String, required: true },
      url: { type: String, required: true },
      price: { type: Number, required: true },
      best_price: { type: Number, required: true },
      average: { type: Number },
      watch: { type: Number, required: true } // only backend
    }
  ]
})

const ProductModel = model<Product>('Product', ProductSchema)

export default ProductModel
