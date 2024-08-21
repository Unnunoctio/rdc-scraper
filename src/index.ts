import { scheduleJob } from 'node-schedule'
import { v2 as cloudinary } from 'cloudinary'
import { ScheduleHour, TimeHour } from './enums'
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_NAME, ENVIRONMENT } from './config'
import { sleepAndGC } from './utils/time'

console.log('Starting App')
console.log('Environment:', ENVIRONMENT)

// TODO: Connect to Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
})
console.log('Connected to cloudinary')

// TODO: Scraping Function
const scraping = async (hour: TimeHour): Promise<void> => {
  console.log(`------------------------------------- Scraping  ${hour} ---------------------------------------`)
  // let notFound: Scraper[] | undefined = await runSpiders()
  // if (isSaturday() && hour === TimeHour.PM_2) {
  //   await sendEmail(notFound)
  // }
  console.log('------------------------------------ Scraping Finished --------------------------------------')

  // notFound = undefined
  await sleepAndGC()
}

// TODO: Schedules every 2 hours between 8 am to 6 pm in Chilean time
scheduleJob(ScheduleHour.AM_8, async () => await scraping(TimeHour.AM_8))
scheduleJob(ScheduleHour.AM_10, async () => await scraping(TimeHour.AM_10))
scheduleJob(ScheduleHour.PM_12, async () => await scraping(TimeHour.PM_12))
scheduleJob(ScheduleHour.PM_2, async () => await scraping(TimeHour.PM_2))
scheduleJob(ScheduleHour.PM_4, async () => await scraping(TimeHour.PM_4))
scheduleJob(ScheduleHour.PM_6, async () => await scraping(TimeHour.PM_6))
