import mongoose from 'mongoose'
import { v2 as cloudinary } from 'cloudinary'
import { scheduleJob } from 'node-schedule'
import { ScheduleHour, TimeHour } from './enums'
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_NAME, DB_URI, ENVIRONMENT } from './config'
import { isSaturday, sleepAndGC } from './utils/time'
import { Scraper } from './classes'
import { runSpiders } from './run-spiders'
import { sendEmail } from './utils/resend'
import { curlFetch } from './helper/fetch'

console.log('Starting App')
console.log('Environment:', ENVIRONMENT)

// TODO: Connect to Database
try {
  await mongoose.connect(DB_URI as string)
  console.log('Connected to database')
} catch (error) {
  console.log('Error connecting to database', error)
  process.exit(1)
}

// TODO: Connect to Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
})
console.log('Connected to cloudinary')

// TODO: Scraping Function
const scraping = async (hour: TimeHour): Promise<void> => {
  const url = 'https://sm-web-api.ecomm.cencosud.com/catalog/api/v4/products/vinos-cervezas-y-licores/cervezas?sc=11'
  const headers = 'apiKey: WlVnnB7c1BblmgUPOfg'

  const data = await curlFetch(url, [headers])
  console.log(data)
  // console.log(`------------------------------------- Scraping  ${hour} ---------------------------------------`)

  // let notFound: Scraper[] | undefined = await runSpiders()
  // if (isSaturday() && hour === TimeHour.PM_2) {
  //   await sendEmail(notFound)
  // }
  // console.log('------------------------------------ Scraping Finished --------------------------------------')

  // notFound = undefined
  // await sleepAndGC()
}

// ? TESTING
await scraping(TimeHour.AM_8)

// TODO: Schedules every 2 hours between 8 am to 6 pm in Chilean time
scheduleJob(ScheduleHour.AM_8, async () => await scraping(TimeHour.AM_8))
scheduleJob(ScheduleHour.AM_10, async () => await scraping(TimeHour.AM_10))
scheduleJob(ScheduleHour.PM_12, async () => await scraping(TimeHour.PM_12))
scheduleJob(ScheduleHour.PM_2, async () => await scraping(TimeHour.PM_2))
scheduleJob(ScheduleHour.PM_4, async () => await scraping(TimeHour.PM_4))
scheduleJob(ScheduleHour.PM_6, async () => await scraping(TimeHour.PM_6))
