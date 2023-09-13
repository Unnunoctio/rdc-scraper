import { Schema, model } from 'mongoose'
import { ProductUnit } from '../types'

const ProductUnitSchema = new Schema<ProductUnit>({
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
})

const ProductUnitModel = model<ProductUnit>('Product_Unit', ProductUnitSchema)

export default ProductUnitModel
