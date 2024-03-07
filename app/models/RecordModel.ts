import { Schema, model } from 'mongoose'
import { Record } from '../types'

const RecordSchema = new Schema<Record>({
  price: { type: Number, required: true },
  date: { type: Date, required: true }
})

const RecordModel = model<Record>('Record', RecordSchema)

export default RecordModel
