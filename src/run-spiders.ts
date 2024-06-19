import { sleep } from 'bun'
import type { Scraper } from './classes'
import type { Spider } from './spiders/types'
import { SpiderName, TimeUnit } from './utils/enums'
import { Jumbo, Santa } from './spiders'

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
  console.log('---------------------------------------------------------------------------------------------')
  await sleep(5 * TimeUnit.SEC)

  // TODO: JUMBO
  const jumboNotFound = await runSpider(new Jumbo(), SpiderName.JUMBO, [], watcher)
  notFound.push(...jumboNotFound)

  console.log('---------------------------------------------------------')
  await sleep(30 * TimeUnit.SEC)

  // TODO: SANTA
  const santaNotFound = await runSpider(new Santa(), SpiderName.SANTA, [], watcher)
  notFound.push(...santaNotFound)

  console.log('---------------------------------------------------------')
  await sleep(30 * TimeUnit.SEC)

  // TODO: LIDER
  console.log('---------------------------------------------------------------------------------------------')

  return notFound
}
