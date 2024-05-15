import { dbConnect, dbDisconnect } from './db/client.js'
import { deleteManyDrinks, saveManyDrinks } from './db/drinks.js'
import { getAllPaths, updateManyWebsites, updateWebsitesWithoutStock } from './db/websites.js'
import { TimeUnit } from './enum.js'
import { Jumbo } from './spiders/Jumbo.js'
import { Lider } from './spiders/Lider.js'
import { Santa } from './spiders/Santa.js'

while (true) {
  const db = await dbConnect()
  if (db === undefined) process.exit(1)
  console.log('----------------------------------------------------------')

  // obtener los paths y guardar los drinks
  const paths = await getAllPaths(db)
  await saveManyDrinks(db)

  // inicializa el watcher y los productos no encontrados
  const watcher = new Date().getTime()
  console.log('Watcher:', watcher)

  //! JUMBO
  console.time('Jumbo Scraping')
  const jumboSpider = new Jumbo()
  const [jumboUpdated, jumboCompleted, jumboIncompleted] = await jumboSpider.run(paths)
  console.log('Jumbo Updated:', jumboUpdated.length)
  await updateManyWebsites(db, jumboUpdated, watcher)
  console.log('Jumbo Completed:', jumboCompleted.length)
  console.log('Jumbo Incompleted:', jumboIncompleted.length)
  console.timeEnd('Jumbo Scraping')
  console.log('----------------------------------------')

  await new Promise(resolve => setTimeout(resolve, 30 * TimeUnit.SEC))

  //! SANTA ISABEL
  console.time('Santa Isabel Scraping')
  const santaSpider = new Santa()
  const [santaUpdated, santaCompleted, santaIncompleted] = await santaSpider.run(paths)
  console.log('Santa Updated:', santaUpdated.length)
  await updateManyWebsites(db, santaUpdated, watcher)
  console.log('Santa Completed:', santaCompleted.length)
  console.log('Santa Incompleted:', santaIncompleted.length)
  console.timeEnd('Santa Isabel Scraping')
  console.log('----------------------------------------')

  await new Promise(resolve => setTimeout(resolve, 30 * TimeUnit.SEC))

  //! LIDER
  console.time('Lider Scraping')
  const liderSpider = new Lider()
  const [liderUpdated, liderCompleted, liderIncompleted] = await liderSpider.run(paths)
  console.log('Lider Updated:', liderUpdated.length)
  await updateManyWebsites(db, liderUpdated, watcher)
  console.log('Lider Completed:', liderCompleted.length)
  console.log('Lider Incompleted:', liderIncompleted.length)
  console.timeEnd('Lider Scraping')
  console.log('----------------------------------------')

  await updateWebsitesWithoutStock(db, watcher)
  await deleteManyDrinks(db)
  await dbDisconnect()
  console.log('----------------------------------------------------------')

  await new Promise(resolve => setTimeout(resolve, 10 * TimeUnit.MIN))
}
