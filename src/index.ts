import schedule from 'node-schedule'
import { ENVIRONMENT } from './config.js'
import { ScheduleHour, TimeHour } from './enum.js'
import { cloudinaryConnect } from './utils/cloudinary.js'
import { sendEmail } from './utils/resend.js'
import { runScraping } from './run.js'

console.log('Starting App')
console.log('Environment:', ENVIRONMENT)

// Connect to Cloudinary
cloudinaryConnect()

// Scraping Function
const scraping = async (hour: TimeHour): Promise<any> => {
  console.log(`------------------------------------------- Scraping ${hour} --------------------------------------------`)
  const notFoundProducts = await runScraping()
  if (new Date().getDay() === 6 && hour === TimeHour.PM_2) {
    await sendEmail(notFoundProducts)
  }
  console.log('----------------------------------------- Scraping Finished ------------------------------------------')
}

// Schedules (Cada 2 horas desde las 8 am hasta las 8 pm)
schedule.scheduleJob(ScheduleHour.AM_8, async () => await scraping(TimeHour.AM_8))

schedule.scheduleJob(ScheduleHour.AM_10, async () => await scraping(TimeHour.AM_10))

schedule.scheduleJob(ScheduleHour.PM_12, async () => await scraping(TimeHour.PM_12))

schedule.scheduleJob(ScheduleHour.PM_2, async () => await scraping(TimeHour.PM_2))

schedule.scheduleJob(ScheduleHour.PM_4, async () => await scraping(TimeHour.PM_4))

schedule.scheduleJob(ScheduleHour.PM_6, async () => await scraping(TimeHour.PM_6))

schedule.scheduleJob(ScheduleHour.PM_8, async () => await scraping(TimeHour.PM_8))
