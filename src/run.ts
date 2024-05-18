import { Db } from 'mongodb'
import { DrinkDB } from './types.js'
import { Spider } from './spiders/types.js'
import { SpiderName, TimeUnit } from './enum.js'
import { Jumbo, Lider, Santa } from './spiders/index.js'
import { dbConnect, dbDisconnect } from './db/client.js'
import { getAllPaths, updateManyWebsites, updateWebsitesWithoutStock } from './db/websites.js'
import { deleteManyDrinks, saveManyDrinks } from './db/drinks.js'
import { saveManyProducts } from './db/products.js'
import { Scraper } from './classes/Scraper.js'

const runSpider = async (db: Db, spider: Spider, name: SpiderName, paths: string[], drinks: DrinkDB[], watcher: number): Promise<Scraper[]> => {
  console.time(`${name} Scraping`)
  const [updated, completed, incompleted] = await spider.run(paths)
  await updateManyWebsites(db, updated, watcher)
  const notFound = await saveManyProducts(db, completed, drinks, spider.info, watcher)
  console.timeEnd(`${name} Scraping`)

  return [...notFound, ...incompleted]
}

export const runScraping = async (): Promise<Scraper[]> => {
  const db = await dbConnect()
  if (db === undefined) return []

  const paths = await getAllPaths(db)
  const drinks = await saveManyDrinks(db)

  const watcher = new Date().getTime()
  const notFoundProducts: Scraper[] = []

  console.log('Watcher:', watcher)
  console.log('---------------------------------------------------------------------------------------------')
  await new Promise(resolve => setTimeout(resolve, 5 * TimeUnit.SEC))

  //! JUMBO
  const jumboNotFound = await runSpider(db, new Jumbo(), SpiderName.JUMBO, paths, drinks, watcher)
  notFoundProducts.push(...jumboNotFound)

  console.log('---------------------------------------------------------')
  await new Promise(resolve => setTimeout(resolve, 30 * TimeUnit.SEC))

  //! SANTA ISABEL
  const santaNotFound = await runSpider(db, new Santa(), SpiderName.SANTA, paths, drinks, watcher)
  notFoundProducts.push(...santaNotFound)

  console.log('---------------------------------------------------------')
  await new Promise(resolve => setTimeout(resolve, 30 * TimeUnit.SEC))

  //! LIDER
  console.time('Lider Scraping')
  const liderNotFound = await runSpider(db, new Lider(), SpiderName.LIDER, paths, drinks, watcher)
  notFoundProducts.push(...liderNotFound)

  console.log('---------------------------------------------------------------------------------------------')

  //! UPDATE DB && DISCONECT
  await updateWebsitesWithoutStock(db, watcher)
  await deleteManyDrinks(db)
  await dbDisconnect()

  return notFoundProducts
}
