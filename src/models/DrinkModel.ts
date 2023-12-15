import { Schema, model } from 'mongoose'
import { Drink } from '../types'

const DrinkSchema = new Schema<Drink>({
  name: { type: String, required: true },
  brand: { type: String, required: true },
  alcoholic_grade: { type: Number, required: true },
  content: { type: Number, required: true },
  package: { type: String, required: true },
  category: { type: String, required: true },
  sub_category: { type: String, required: true },
  made_in: { type: String, required: true },
  variety: { type: String },
  bitterness: { type: Number },
  temperature: { type: String },
  strain: { type: String },
  vineyard: { type: String }
})

const DrinkModel = model<Drink>('Drink', DrinkSchema)

export default DrinkModel
