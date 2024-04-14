import mongoose from 'mongoose'
import { DB_URI } from '../config.js'

export const dbConnect = async (): Promise<boolean> => {
  try {
    await mongoose.connect(DB_URI as string)
    console.log('Connected to Database')
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

export const dbDisconnect = async (): Promise<void> => {
  await mongoose.connection.close()
}
