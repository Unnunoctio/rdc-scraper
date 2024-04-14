import 'dotenv/config.js'
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_NAME, DB_URI, ENVIRONMENT } from './config.js'
import mongoose from 'mongoose'
import schedule from 'node-schedule'
import { v2 as cloudinary } from 'cloudinary'
import { runSpiders } from './spiders/index.js'
import { sendEmail } from './utils/emails.js'

console.log('Starting App')
console.log('Environment:', ENVIRONMENT)

// Connect to MongoDB
mongoose.connect(DB_URI as string)
  .then(() => console.log('Connected to Database'))
  .catch(err => console.error(err))

// Connect to Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
})

// Scraping function
const firstScraping = async (): Promise<void> => {
  console.log('------------------ first scraping ------------------')
  const notFound = await runSpiders()
  if (ENVIRONMENT === 'PRODUCTION') {
    await sendEmail(notFound)
  }
  console.log('-------------- first scraping finished -------------')
}

const morningScraping = async (): Promise<void> => {
  console.log('------------------ scraping 8 am -------------------')
  await runSpiders()
  console.log('----------------- scraping finised -----------------')
}

const afternoonScraping = async (): Promise<void> => {
  console.log('------------------ scraping 2 pm -------------------')
  const notFound = await runSpiders()
  // Si es sabado - enviar un correo electronico
  if (new Date().getDay() === 6) {
    await sendEmail(notFound)
  }
  console.log('----------------- scraping finised -----------------')
}

// First scraping
await new Promise(resolve => setTimeout(resolve, 3000))
await firstScraping()

// Scraping a las 8am en chile
schedule.scheduleJob('0 11 * * *', morningScraping)

// Scraping a las 2pm en chile
schedule.scheduleJob('0 17 * * *', afternoonScraping)
