import { Schema, model } from 'mongoose'
import { Info } from '../types'

const InfoSchema = new Schema<Info>({
  name: { type: String, required: true, unique: true },
  url: { type: String, required: true, unique: true },
  logo: { type: String, required: true, unique: true }
})

const InfoModel = model<Info>('Info', InfoSchema)

export default InfoModel
