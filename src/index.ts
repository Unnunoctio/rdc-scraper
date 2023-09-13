/* eslint-disable @typescript-eslint/no-misused-promises */
import 'dotenv/config.js'
import mongoose from 'mongoose'
import schedule from 'node-schedule'
import { getNewProductUnits } from './utils/utilsAPI.js'
import { JumboSpider, SantaSpider } from './spiders/index.js'

console.log('Starting app...')

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

// Scraping a las 8 am en chile
schedule.scheduleJob('0 11 * * *', scraping)

// Scraping a las 2 pm en chile
schedule.scheduleJob('0 17 * * *', scraping)
