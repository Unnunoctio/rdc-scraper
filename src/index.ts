import dotenv from 'dotenv'
import mongoose from 'mongoose'
import cron from 'node-cron'

// Configure dotenv
dotenv.config()

// Configure mongoose
mongoose.connect(process.env.DB_URI as string)
  .then(() => console.log('Database connected'))
  .catch((err) => console.log(err))

const scraping = async (): Promise<void> => {
  console.log('Starting scraping...')
  console.log('Finally scraping.')
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises
cron.schedule('* * * * *', scraping)
