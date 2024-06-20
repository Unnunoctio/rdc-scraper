/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Db } from 'mongodb'
import type { DrinkDB } from './types'
import type { Scraper } from './classes'
import type { Spider } from './spiders/types'
import { dbConnect, dbDisconnect } from './db/client'
import { deleteManyDrinks, saveManyDrinks } from './db/drinks'
import { saveManyProducts } from './db/products'
import { getAllPaths, updateManyWebsites, updateWebsitesWithoutStock } from './db/websites'
import { SpiderName } from './utils/enums'
import { sleepBetweenSpiders, sleepStartEndSpiders } from './utils/time'
import { Jumbo, Lider, Santa } from './spiders'

const runSpider = async (db: Db, spider: Spider, name: SpiderName, paths: string[], drinks: DrinkDB[], watcher: number): Promise<Scraper[]> => {
  console.time(`${name} Scraping`)
  const [updated, completed, incompleted] = await spider.run(paths)
  // await updateManyWebsites(db, updated, watcher)
  // const notFound = await saveManyProducts(db, completed, drinks, spider.info, watcher)
  console.timeEnd(`${name} Scraping`)

  console.log(`Updated: ${updated.length}  -  Completed: ${completed.length}  -  Incompleted: ${incompleted.length}`)
  // return [...notFound, ...incompleted]
  return []
}

export const runSpiders = async (): Promise<Scraper[]> => {
  const db = await dbConnect()
  if (db === undefined) return []

  const paths = await getAllPaths(db)
  const drinks = await saveManyDrinks(db)

  const watcher = new Date().getTime()
  const notFound: Scraper[] = []

  console.log('Watcher:', watcher)
  await sleepStartEndSpiders()

  // TODO: JUMBO
  const jumboNotFound = await runSpider(db, new Jumbo(), SpiderName.JUMBO, paths, drinks, watcher)
  notFound.push(...jumboNotFound)

  // await sleepBetweenSpiders()

  // // TODO: SANTA
  // const santaNotFound = await runSpider(db, new Santa(), SpiderName.SANTA, paths, drinks, watcher)
  // notFound.push(...santaNotFound)

  // await sleepBetweenSpiders()

  // // TODO: LIDER
  // const liderNotFound = await runSpider(db, new Lider(), SpiderName.LIDER, paths, drinks, watcher)
  // notFound.push(...liderNotFound)

  await sleepStartEndSpiders()

  // // TODO: UPDATE DB && DISCONNECT
  // await updateWebsitesWithoutStock(db, watcher)
  // await deleteManyDrinks(db)
  await dbDisconnect()

  return notFound
}
