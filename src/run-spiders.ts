import type { Scraper } from './classes'
import { SpiderName } from './enums'
import type { Spider } from './spiders/types'
import { drinkService } from './service/drink-service'
import { generateWatcher } from './utils/generation'
import { sleepBetweenSpiders, sleepStartEndSpiders } from './utils/time'
import { websiteService } from './service/website-service'
import { productService } from './service/product-service'
import { Jumbo } from './spiders'

const runSpider = async (spider: Spider, name: SpiderName, watcher: string): Promise<Scraper[]> => {
  console.time(`${name} Scraping`)
  const paths = await websiteService.getAllPaths()
  const [updated, completed, incompleted] = await spider.run(paths)
  await websiteService.updateManyWebsites(updated, watcher)
  const notFound = await productService.saveManyProducts(completed, spider.INFO, watcher)
  console.timeEnd(`${name} Scraping`)

  console.log(`Updated: ${updated.length}  -  Completed: ${completed.length}  -  Incompleted: ${incompleted.length}`)
  return [...notFound, ...incompleted]
}

export const runSpiders = async (): Promise<Scraper[]> => {
  await drinkService.saveManyDrinksByApi()

  const watcher = generateWatcher()
  const notFound: Scraper[] = []

  console.log('Watcher:', watcher)
  await sleepStartEndSpiders()

  // TODO: JUMBO
  const jumboNotFound = await runSpider(new Jumbo(), SpiderName.JUMBO, watcher)
  notFound.push(...jumboNotFound)
  await sleepBetweenSpiders()

  // // TODO: SANTA ISABEL
  // const santaNotFound = await runSpider(new Santa(), SpiderName.SANTA, watcher)
  // notFound.push(...santaNotFound)
  // await sleepBetweenSpiders()

  // // TODO: LIDER
  // const liderNotFound = await runSpider(new Lider(), SpiderName.LIDER, watcher)
  // notFound.push(...liderNotFound)

  await sleepStartEndSpiders()

  // TODO: UPDATE DB
  await websiteService.updateWebsitesWithoutStock(watcher)
  await drinkService.deleteManyDrinks()

  return notFound
}
