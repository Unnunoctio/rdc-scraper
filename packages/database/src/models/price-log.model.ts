import { Schema, model, type Types } from 'mongoose'

const priceLogSchema = new Schema({
  productId:   { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  websitePath: { type: String, required: true },
  price:       { type: Number, required: true },
  bestPrice:   { type: Number, required: true },
  date:        { type: Date,   required: true },
})

priceLogSchema.index({ productId: 1, websitePath: 1, date: -1 }, { unique: true })
priceLogSchema.index({ date: 1 }, { expireAfterSeconds: 15552000 }) // 180 days

export type IPriceLog = {
  productId: Types.ObjectId; websitePath: string
  price: number; bestPrice: number; date: Date
}

export const PriceLog = model('PriceLog', priceLogSchema, 'priceLogs')
