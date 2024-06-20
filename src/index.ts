import { scheduleJob } from 'node-schedule'
import { ENVIRONMENT } from './config'
import type { Scraper } from './classes'
import { ScheduleHour, TimeHour } from './utils/enums'
import { isSaturday, sleepAndGC } from './utils/time'
import { cloudinaryConnect } from './utils/cloudinary'
import { sendEmail } from './utils/resend'
import { runSpiders } from './run-spiders'

console.log('Starting App')
console.log('Environment:', ENVIRONMENT)

// TODO: Connect to Cloudinary
cloudinaryConnect()

// TODO: Scraping Function
const scraping = async (hour: TimeHour): Promise<void> => {
  console.log(`------------------------------------- Scraping  ${hour} ---------------------------------------`)
  let notFound: Scraper[] | undefined = await runSpiders()
  if (isSaturday() && hour === TimeHour.PM_2) {
    await sendEmail(notFound)
  }
  console.log('------------------------------------ Scraping Finished --------------------------------------')

  notFound = undefined
  await sleepAndGC()
}

// TODO: Schedules every 2 hours between 8 am to 6 pm in Chilean time
scheduleJob(ScheduleHour.AM_8, async () => await scraping(TimeHour.AM_8))
scheduleJob(ScheduleHour.AM_10, async () => await scraping(TimeHour.AM_10))
scheduleJob(ScheduleHour.PM_12, async () => await scraping(TimeHour.PM_12))
scheduleJob(ScheduleHour.PM_2, async () => await scraping(TimeHour.PM_2))
scheduleJob(ScheduleHour.PM_4, async () => await scraping(TimeHour.PM_4))
scheduleJob(ScheduleHour.PM_6, async () => await scraping(TimeHour.PM_6))
