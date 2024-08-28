import { model, Schema } from 'mongoose'
import { generateInfoId } from '../utils/generation'
import type { InfoDB } from '../types'

const InfoSchema = new Schema({
  _id: { type: String, default: () => generateInfoId() },
  name: { type: String, required: true, unique: true, index: true },
  logo: { type: String, required: true, unique: true }
}, {
  timestamps: true,
  versionKey: false
})

const InfoModel = model<InfoDB>('Info', InfoSchema, 'infos')
export default InfoModel
