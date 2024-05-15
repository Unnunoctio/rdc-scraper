import { TimeUnit } from './enum.js'
import { Jumbo, Lider, Santa } from './spiders/index.js'
import { dbConnect, dbDisconnect } from './db/client.js'
import { getAllPaths, updateManyWebsites, updateWebsitesWithoutStock } from './db/websites.js'
import { deleteManyDrinks, saveManyDrinks } from './db/drinks.js'
import { saveManyProducts } from './db/products.js'
import { Scraper } from './classes/Scraper.js'

export const runScraping = async (): Promise<Scraper[]> => {
  const db = await dbConnect()
  if (db === undefined) return []

  const paths = await getAllPaths(db)
  const drinks = await saveManyDrinks(db)

  const watcher = new Date().getTime()
  const notFoundProducts: Scraper[] = []

  console.log('Watcher:', watcher)
  console.log('-------------------------------------------------------------------------------------------------------')
  await new Promise(resolve => setTimeout(resolve, 5 * TimeUnit.SEC))

  //! JUMBO
  console.time('Jumbo Scraping')
  const jumboSpider = new Jumbo()
  const [jumboUpdated, jumboCompleted, jumboIncompleted] = await jumboSpider.run(paths)
  await updateManyWebsites(db, jumboUpdated, watcher)
  const jumboNotFound = await saveManyProducts(db, jumboCompleted, drinks, jumboSpider.info, watcher)
  console.timeEnd('Jumbo Scraping')

  notFoundProducts.push(...jumboNotFound)
  notFoundProducts.push(...jumboIncompleted)

  console.log('---------------------------------------------------------')
  await new Promise(resolve => setTimeout(resolve, 30 * TimeUnit.SEC))

  //! SANTA ISABEL
  console.time('Santa Isabel Scraping')
  const santaSpider = new Santa()
  const [santaUpdated, santaCompleted, santaIncompleted] = await santaSpider.run(paths)
  await updateManyWebsites(db, santaUpdated, watcher)
  const santaNotFound = await saveManyProducts(db, santaCompleted, drinks, santaSpider.info, watcher)
  console.timeEnd('Santa Isabel Scraping')

  notFoundProducts.push(...santaNotFound)
  notFoundProducts.push(...santaIncompleted)

  console.log('---------------------------------------------------------')
  await new Promise(resolve => setTimeout(resolve, 30 * TimeUnit.SEC))

  //! LIDER
  console.time('Lider Scraping')
  const liderSpider = new Lider()
  const [liderUpdated, liderCompleted, liderIncompleted] = await liderSpider.run(paths)
  await updateManyWebsites(db, liderUpdated, watcher)
  const liderNotFound = await saveManyProducts(db, liderCompleted, drinks, liderSpider.info, watcher)
  console.timeEnd('Lider Scraping')

  notFoundProducts.push(...liderNotFound)
  notFoundProducts.push(...liderIncompleted)

  console.log('-------------------------------------------------------------------------------------------------------')

  await updateWebsitesWithoutStock(db, watcher)
  await deleteManyDrinks(db)
  await dbDisconnect()

  return notFoundProducts
}
