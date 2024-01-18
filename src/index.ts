import 'dotenv/config.js'
import mongoose from 'mongoose'
import schedule from 'node-schedule'
import { v2 as cloudinary } from 'cloudinary'
import { runSpiders } from './spiders/index.js'
import { sendEmail } from './utils/sendEmail.js'

console.log('Starting app...')

// Connect to MongoDB
mongoose.connect(process.env.DB_URI as string)
  .then(() => console.log('Connected to Database'))
  .catch(err => console.error(err))

// Connect to Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY
})

// Scraping function
const firstScraping = async (): Promise<void> => {
  console.log('------------------ first scraping ------------------')
  const notFoundProducts = await runSpiders()
  await sendEmail(notFoundProducts)
  console.log('-------------- first scraping finished -------------')
}

const morningScraping = async (): Promise<void> => {
  console.log('------------------- scraping 8 am ------------------')
  await runSpiders()
  console.log('----------------- scraping finised -----------------')
}

const afternoonScraping = async (): Promise<void> => {
  console.log('------------------- scraping 2 pm ------------------')
  const notFoundProducts = await runSpiders()
  // Si es sabado - enviar un correo electronico
  if (new Date().getDay() === 6) {
    await sendEmail(notFoundProducts)
  }
  console.log('----------------- scraping finised -----------------')
}

// Test scraping
// testSpider()
//   .then(() => console.log('Test scraping finished'))
//   .catch(err => console.error(err))

// First scraping
await new Promise(resolve => setTimeout(resolve, 3000))
await firstScraping()

// Scraping a las 8am en chile
schedule.scheduleJob('0 11 * * *', morningScraping)

// Scraping a las 2pm en chile
schedule.scheduleJob('0 17 * * *', afternoonScraping)
