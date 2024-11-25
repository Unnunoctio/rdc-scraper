import { sleepSync } from 'bun'
import { generateWatcher } from '../../utils/nanoid'
import type { Scraper } from '../classes'
import { Jumbo, Lider, Santa } from './api'
import { SpiderName } from './enums'
import type { Spider } from './types'

const runSpider = async (spider: Spider, name: SpiderName, watcher: string): Promise<Scraper[]> => {
  console.time(`${name} Spider`)
  const paths: string[] = []
  const [updated, complete, incomplete] = await spider.run(paths)
  console.timeEnd(`${name} Spider`)

  console.info(`Updated: ${updated.length} - Completed: ${complete.length} - Incompleted: ${incomplete.length} \n`)
  return []
}

export const executeSpiders = async (): Promise<Scraper[]> => {
  const watcher = generateWatcher()
  const notFound: Scraper[] = []

  console.log(`Watcher: ${watcher} \n`)

  // TODO: JUMBO
  const jumboNotFound = await runSpider(new Jumbo(), SpiderName.JUMBO, watcher)
  notFound.push(...jumboNotFound)
  sleepSync(5000)

  // TODO: SANTA ISABEL
  const santaNotFound = await runSpider(new Santa(), SpiderName.SANTA, watcher)
  notFound.push(...santaNotFound)
  sleepSync(5000)

  // TODO: LIDER
  const liderNotFound = await runSpider(new Lider(), SpiderName.LIDER, watcher)
  notFound.push(...liderNotFound)
  sleepSync(5000)

  return notFound
}
