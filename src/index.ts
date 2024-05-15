import { ENVIRONMENT } from './config.js'
import { TimeUnit } from './enum.js'
import { Jumbo } from './spiders/Jumbo.js'
import { Lider } from './spiders/Lider.js'
import { Santa } from './spiders/Santa.js'
import { cloudinaryConnect } from './utils/cloudinary.js'
import { dbConnect, dbDisconnect } from './db/client.js'
import { getAllPaths, updateManyWebsites, updateWebsitesWithoutStock } from './db/websites.js'
import { deleteManyDrinks, saveManyDrinks } from './db/drinks.js'
import { saveManyProducts } from './db/products.js'
import { Scraper } from './classes/Scraper.js'

console.log('Starting App')
console.log('Environment:', ENVIRONMENT)

// Connect to Cloudinary
cloudinaryConnect()

while (true) {
  const db = await dbConnect()
  if (db === undefined) process.exit(1)

  // obtener los paths y guardar los drinks
  const paths = await getAllPaths(db)
  const drinks = await saveManyDrinks(db)

  // inicializa el watcher y los productos no encontrados
  const watcher = new Date().getTime()
  const notFoundProducts: Scraper[] = []

  console.log('Watcher:', watcher)
  console.log('-------------------------------------------------------------------------------------------')
  await new Promise(resolve => setTimeout(resolve, 30 * TimeUnit.SEC))

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

  console.log('---------------------------------------------------------')
  await new Promise(resolve => setTimeout(resolve, 30 * TimeUnit.SEC))

  await updateWebsitesWithoutStock(db, watcher)
  await deleteManyDrinks(db)
  await dbDisconnect()
  console.log('-------------------------------------------------------------------------------------------')

  await new Promise(resolve => setTimeout(resolve, 10 * TimeUnit.MIN))
}
