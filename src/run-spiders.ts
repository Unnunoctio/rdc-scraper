import type { Scraper } from './classes'
import type { Spider } from './spiders/types'
import { SpiderName } from './utils/enums'
import { Jumbo, Lider, Santa } from './spiders'
import { sleepBetweenSpiders, sleepStartEndSpiders } from './utils/time'

const runSpider = async (spider: Spider, name: SpiderName, paths: string[], watcher: number): Promise<Scraper[]> => {
  console.time(`${name} Scraping`)
  const [updated, completed, incompleted] = await spider.run(paths)
  //! Update websites
  //! Save products
  console.timeEnd(`${name} Scraping`)

  console.log(`Updated: ${updated.length}`)
  return [...completed, ...incompleted]
}

export const runSpiders = async (): Promise<Scraper[]> => {
  const watcher = new Date().getTime()
  const notFound: Scraper[] = []

  console.log('Watcher:', watcher)
  await sleepStartEndSpiders()

  // TODO: JUMBO
  const jumboNotFound = await runSpider(new Jumbo(), SpiderName.JUMBO, [], watcher)
  notFound.push(...jumboNotFound)

  await sleepBetweenSpiders()

  // TODO: SANTA
  const santaNotFound = await runSpider(new Santa(), SpiderName.SANTA, [], watcher)
  notFound.push(...santaNotFound)

  await sleepBetweenSpiders()

  // TODO: LIDER
  const liderNotFound = await runSpider(new Lider(), SpiderName.LIDER, [], watcher)
  notFound.push(...liderNotFound)

  await sleepStartEndSpiders()

  return notFound
}
