import { scheduleJob } from 'node-schedule'
import { ENVIRONMENT } from './config'
import { ScheduleHour, TimeHour, TimeUnit } from './utils/enums'
import { isSaturday } from './utils/time'
import { runSpiders } from './run-spiders'
import { sleep } from 'bun'

console.log('Starting App')
console.log('Environment:', ENVIRONMENT)

// TODO: Scraping Function
const scraping = async (hour: TimeHour): Promise<void> => {
  console.log(`------------------------------------- Scraping  ${hour} ---------------------------------------`)
  const notFound = await runSpiders()
  if (isSaturday() && hour === TimeHour.PM_2) {
    //! Send Email
  }
  console.log('Not found products:', notFound.length)
  console.log('------------------------------------ Scraping Finished --------------------------------------')
}

// TODO: Schedules every 2 hours between 8 am to 6 pm in Chilean time
scheduleJob(ScheduleHour.AM_8, async () => await scraping(TimeHour.AM_8))
scheduleJob(ScheduleHour.AM_10, async () => await scraping(TimeHour.AM_10))
scheduleJob(ScheduleHour.PM_12, async () => await scraping(TimeHour.PM_12))
scheduleJob(ScheduleHour.PM_2, async () => await scraping(TimeHour.PM_2))
scheduleJob(ScheduleHour.PM_4, async () => await scraping(TimeHour.PM_4))
scheduleJob(ScheduleHour.PM_6, async () => await scraping(TimeHour.PM_6))

// ? Testing
await sleep(1 * TimeUnit.MIN)
await scraping(TimeHour.AM_8)
