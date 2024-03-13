import { Schema, model } from 'mongoose'
import { Website } from '../types'

const WebsiteSchema = new Schema<Website>({
  info: { type: Schema.Types.ObjectId, ref: 'Info' },
  path: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  best_price: { type: Number, required: true },
  average: { type: Number },
  last_update: { type: Number, required: true },
  in_stock: { type: Boolean, required: true },
  records: [{ type: Schema.Types.ObjectId, ref: 'Record' }]
})

const WebsiteModel = model<Website>('Website', WebsiteSchema)

export default WebsiteModel
