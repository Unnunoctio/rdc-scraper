import 'dotenv/config.js'
import mongoose from 'mongoose'
import { runSpiders } from './spiders/index.js'

console.log('Starting app...')

// Connect to MongoDB
mongoose.connect(process.env.DB_URI as string)
  .then(() => console.log('Connected to Database'))
  .catch(err => console.error(err))

// Scraping function
const scrape = async (): Promise<void> => {
  console.log('Scraping...')
  await runSpiders()
}

scrape()
  .then(() => console.log('Scraping complete'))
  .catch(err => console.error(err))
