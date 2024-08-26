import { model, Schema } from 'mongoose'
import { generateId } from '../utils/generation'
import type { PriceLogDB } from '../types'

const PriceLogSchema = new Schema({
  _id: { type: String, default: () => generateId() },
  price: { type: Number, required: true },
  date: { type: Date, required: true }
}, {
  timestamps: true,
  versionKey: false
})

const PriceLogModel = model<PriceLogDB>('PriceLog', PriceLogSchema, 'price_logs')
export default PriceLogModel
