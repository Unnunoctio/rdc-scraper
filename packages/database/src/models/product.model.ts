import { Schema, model, type Types } from 'mongoose'

const drinkSchema = new Schema(
  {
    id:      { type: String, required: true },
    name:    { type: String, required: true },
    brand:   { type: String, required: true },
    abv:     { type: Number, required: true },
    packaging: { type: String, required: true },
    volume:  { type: Number, required: true },
    // optional — all categories:
    country: String,
    region:  String,
    // beer-specific:
    style:   String,
    ibu:     Number,
    servingTempMinC: Number,
    servingTempMaxC: Number,
    // spirit-specific:
    type:              String,
    agingContainer:    String,
    agingTimeMonths:   Number,
  },
  { _id: false },
)

const websiteSchema = new Schema(
  {
    info:        { type: Schema.Types.ObjectId, ref: 'Info', required: true },
    path:        { type: String, required: true },
    price:       { type: Number, required: true },
    bestPrice:   { type: Number, required: true },
    lastUpdate:  { type: String, required: true },
    inStock:     { type: Boolean, required: true, default: true },
  },
  { _id: false },
)

const productSchema = new Schema({
  sku:      { type: String, required: true, unique: true },
  slug:     { type: String, required: true },
  name:     { type: String, required: true },
  quantity: { type: Number, required: true },
  category: { type: String, required: true, enum: ['Cervezas', 'Destilados', 'Vinos'] },
  drink:    { type: drinkSchema, required: true },
  images:   [String],
  websites: [websiteSchema],
})

productSchema.index(
  { 'drink.id': 1, 'drink.volume': 1, 'drink.packaging': 1, quantity: 1 },
  { unique: true },
)
productSchema.index({ 'websites.path': 1 }, { unique: true, sparse: true })
productSchema.index({ category: 1 })

export type IDrink = {
  id: string; name: string; brand: string; abv: number
  packaging: string; volume: number
  country?: string; region?: string
  style?: string; ibu?: number; servingTempMinC?: number; servingTempMaxC?: number
  type?: string; agingContainer?: string; agingTimeMonths?: number
}

export type IWebsite = {
  info: Types.ObjectId; path: string; price: number
  bestPrice: number; lastUpdate: string; inStock: boolean
}

export type IProduct = {
  _id: Types.ObjectId; sku: string; slug: string; name: string
  quantity: number; category: string; drink: IDrink
  images: string[]; websites: IWebsite[]
}

export const Product = model('Product', productSchema, 'products')
