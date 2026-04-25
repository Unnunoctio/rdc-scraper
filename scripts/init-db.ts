import mongoose from 'mongoose'
import { Info, Product, PriceLog } from '@rdc/database'

const MONGODB_URI = process.env['MONGODB_URI']
const MONGODB_DB  = process.env['MONGODB_DB']

if (!MONGODB_URI || !MONGODB_DB) {
  console.error('MONGODB_URI and MONGODB_DB env vars are required')
  process.exit(1)
}

await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB })

await Info.createIndexes()
await Product.createIndexes()
await PriceLog.createIndexes()

console.log('Database initialized successfully')
await mongoose.disconnect()
