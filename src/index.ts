import mongoose from 'mongoose'
import { v2 as cloudinary } from 'cloudinary'
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_NAME, DB_URI, ENVIRONMENT, RESEND_SEND } from './config'
import { isSaturday } from './utils/time'
import { runSpiders } from './run-spiders'
import { sendEmail } from './utils/resend'
import { EmailSend } from './enums'
import { viewPublicIPInfo } from './utils/ip'

console.log('Starting App')
console.log('Environment:', ENVIRONMENT)
await viewPublicIPInfo()

async function main (): Promise<void> {
  try {
    // TODO: Connect to Database
    await mongoose.connect(DB_URI as string)
    console.log('Connected to database')

    // TODO: Connect to Cloudinary
    cloudinary.config({
      cloud_name: CLOUDINARY_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET
    })
    console.log('Connected to cloudinary')

    // TODO: Scraping Function
    console.log('------------------------------------ Scraping Started ---------------------------------------')
    const notFound = await runSpiders()
    if (isSaturday() && RESEND_SEND === EmailSend.SEND) {
      await sendEmail(notFound)
    }
    console.log('------------------------------------ Scraping Finished --------------------------------------')
  } catch (error) {
    console.error('An error occurred:', error)
    process.exit(1)
  } finally {
    // TODO: Ensure database disconnection happens even if there's an error
    await mongoose.disconnect()
    console.log('Disconnected from database')
  }
}

// TODO: Run the main function
main().then(() => {
  console.log('Process completed successfully')
  process.exit(0)
}).catch((error) => {
  console.error('Process failed:', error)
  process.exit(1)
})
