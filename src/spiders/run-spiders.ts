import { ScraperClass } from '../classes/ScraperClass'
import { deleteManyDrinks } from '../utils/db-delete.js'
import { getAllPathWebsites } from '../utils/db-get.js'
import { saveManyDrinks, saveManyProducts } from '../utils/db-save.js'
import { updateManyWebsites, updateManyWebsitesWithoutStock } from '../utils/db-update.js'
import { getDrinksApi } from '../utils/drinks-api.js'
import { JumboSpider, LiderSpider, SantaSpider } from './index.js'

export const runSpiders = async (): Promise<ScraperClass[]> => {
  // obtener los drinks api, todos los paths y guardar los drinks into de db
  const drinksApi = await getDrinksApi()
  const allPaths = await getAllPathWebsites()
  const drinks = await saveManyDrinks(drinksApi)

  // inicializa el watcher y el array de productos no encontrados
  const watcher = new Date().getTime()
  const notFound: ScraperClass[] = []

  //! jumbo
  console.time('Jumbo Scraping')
  const jumboSpider = new JumboSpider()
  const [jumboUpdated, jumboScraped] = await jumboSpider.run(allPaths)
  await updateManyWebsites(jumboUpdated, watcher)
  const jumboNotFound = await saveManyProducts(jumboScraped, drinks, jumboSpider.info, watcher)
  console.timeEnd('Jumbo Scraping')
  console.log('----------------------------------------')
  notFound.push(...jumboNotFound)

  //! santa
  console.time('Santa Scraping')
  const santaSpider = new SantaSpider()
  const [santaUpdated, santaScraped] = await santaSpider.run(allPaths)
  await updateManyWebsites(santaUpdated, watcher)
  const santaNotFound = await saveManyProducts(santaScraped, drinks, santaSpider.info, watcher)
  console.timeEnd('Santa Scraping')
  console.log('----------------------------------------')
  notFound.push(...santaNotFound)

  //! lider
  console.time('Lider Scraping')
  const liderSpider = new LiderSpider()
  const [liderUpdated, liderScraped] = await liderSpider.run(allPaths)
  await updateManyWebsites(liderUpdated, watcher)
  const liderNotFound = await saveManyProducts(liderScraped, drinks, liderSpider.info, watcher)
  console.timeEnd('Lider Scraping')
  console.log('----------------------------------------')
  notFound.push(...liderNotFound)

  // actualizan todos los productos sin stock y se eliminan los drinks que no esten en ningun producto
  await updateManyWebsitesWithoutStock(watcher)
  await deleteManyDrinks()

  return notFound
}
