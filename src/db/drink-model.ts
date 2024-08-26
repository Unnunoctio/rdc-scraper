import { Schema, model } from 'mongoose'
import { generateId } from '../utils/generation'
import type { DrinkDB } from '../types'

const DrinkSchema = new Schema({
  _id: { type: String, default: () => generateId() },
  drinkId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  brand: { type: String, required: true, index: true },
  abv: { type: Number, required: true, min: 0, max: 100, index: true },
  volume: { type: Number, required: true, min: 0, index: true }, // in cc
  packaging: { type: String, required: true, index: true },
  category: { type: String, required: true },
  subCategory: { type: String, required: true },
  origin: { type: String, required: true },
  // ? CERVEZAS
  variety: { type: String },
  ibu: { type: Number, min: 0, max: 100 },
  servingTemp: { type: String },
  // ? VINOS
  strain: { type: String },
  vineyard: { type: String }
}, {
  timestamps: true,
  versionKey: false
})

const DrinkModel = model<DrinkDB>('Drink', DrinkSchema, 'drinks')
export default DrinkModel
