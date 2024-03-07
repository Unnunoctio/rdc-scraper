import 'dotenv/config.js'
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_NAME, DB_URI, ENVIRONMENT } from './config'
import mongoose from 'mongoose'
import schedule from 'node-schedule'
import { v2 as cloudinary } from 'cloudinary'

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
  console.log('-------------- first scraping finished -------------')
}

const morningScraping = async (): Promise<void> => {
  console.log('------------------ scraping 8 am -------------------')
  console.log('----------------- scraping finised -----------------')
}

const afternoonScraping = async (): Promise<void> => {
  console.log('------------------ scraping 2 pm -------------------')
  console.log('----------------- scraping finised -----------------')
}

// First scraping
await new Promise(resolve => setTimeout(resolve, 3000))
await firstScraping()

// Scraping a las 8am en chile
schedule.scheduleJob('0 11 * * *', morningScraping)

// Scraping a las 2pm en chile
schedule.scheduleJob('0 17 * * *', afternoonScraping)
