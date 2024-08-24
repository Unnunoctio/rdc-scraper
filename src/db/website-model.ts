import { model, Schema } from 'mongoose'
import { generateId } from '../utils/generation'
import type { WebsiteDB } from '../types'

const WebsiteSchema = new Schema({
  _id: { type: String, default: () => generateId() },
  info: { type: String, ref: 'Info', required: true, index: true },
  path: { type: String, required: true, unique: true, index: true },
  price: { type: Number, required: true },
  bestPrice: { type: Number, required: true },
  average: { type: Number },
  lastUpdate: { type: String, required: true },
  inStock: { type: Boolean, required: true, index: true },
  priceLogs: [{ type: String, ref: 'PriceLog' }]
}, {
  timestamps: true,
  versionKey: false
})

const WebsiteModel = model<WebsiteDB>('Website', WebsiteSchema, 'websites')
export default WebsiteModel
