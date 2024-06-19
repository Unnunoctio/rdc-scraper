import { sleep } from 'bun'
import { TimeUnit } from './enums'

export const isSaturday = (): boolean => {
  const today = new Date()
  return today.getDay() === 6
}

export const sleepBetweenSpiders = async (): Promise<void> => {
  await sleep(5 * TimeUnit.SEC)
  console.log('---------------------------------------------------------')
  await sleep(5 * TimeUnit.SEC)
}

export const sleepStartEndSpiders = async (): Promise<void> => {
  await sleep(5 * TimeUnit.SEC)
  console.log('---------------------------------------------------------------------------------------------')
}

export const sleepAndGC = async (): Promise<void> => {
  console.time('GC execution')
  await sleep(1 * TimeUnit.MIN)
  Bun.gc(true)
  console.timeEnd('GC execution')
}
