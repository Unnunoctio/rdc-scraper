import 'dotenv/config.js'
import mongoose from 'mongoose'
import schedule from 'node-schedule'
import { runSpiders } from './spiders/index.js'
import { sendEmail } from './utils/sendEmail.js'

console.log('Starting app...')

// Connect to MongoDB
mongoose.connect(process.env.DB_URI as string)
  .then(() => console.log('Connected to Database'))
  .catch(err => console.error(err))

// Scraping function
const firstScraping = async (): Promise<void> => {
  console.log('Scraping 8 am')
  await runSpiders()
  console.log('Finally scraping')
}

const secondScraping = async (): Promise<void> => {
  console.log('Scraping 2 pm')
  const notFoundProducts = await runSpiders()
  // Si es sabado - enviar un correo electronico
  if (new Date().getDay() === 6) {
    await sendEmail(notFoundProducts)
  }
  console.log('Finally scraping')
}

// Scraping a las 8am en chile
schedule.scheduleJob('0 11 * * *', firstScraping)

// Scraping a las 2pm en chile
schedule.scheduleJob('0 17 * * *', secondScraping)
