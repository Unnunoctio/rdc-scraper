/* eslint-disable @typescript-eslint/no-misused-promises */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import cron from 'node-cron'
import { getNewProductUnits } from './utils/utilsAPI.js'
import { JumboSpider, SantaSpider } from './spiders/index.js'

// Configure dotenv
dotenv.config()

// Configure mongoose
mongoose.connect(process.env.DB_URI as string)
  .then(() => console.log('Database connected'))
  .catch((err) => console.log(err))

// Scraping function
const scraping = async (): Promise<void> => {
  console.log('Starting scraping...')
  try {
    await getNewProductUnits()

    const jumboSpider = new JumboSpider()
    const santaSpider = new SantaSpider()

    await jumboSpider.run()
    await new Promise(resolve => setTimeout(resolve, 1000))
    await santaSpider.run()

    console.log('Finally scraping.')
  } catch (error) {
    console.log('Error in scraping.')
    console.error(error)
  }
}

// Scraping a las 8 am
cron.schedule('0 8 * * *', scraping)

// Scraping a las 2 pm
cron.schedule('0 14 * * *', scraping)
