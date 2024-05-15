import { dbConnect, dbDisconnect } from './db/client.js'
import { deleteManyDrinks, saveManyDrinks } from './db/drinks.js'
import { getAllPaths } from './db/websites.js'
import { TimeUnit } from './enum.js'
import { Jumbo } from './spiders/Jumbo.js'
import { Lider } from './spiders/Lider.js'
import { Santa } from './spiders/Santa.js'

while (true) {
  const db = await dbConnect()
  if (db === undefined) process.exit(1)

  const paths = await getAllPaths(db)
  await saveManyDrinks(db)

  console.time('Jumbo')
  const jumboSpider = new Jumbo()
  const [jumboUpdated, jumboCompleted, jumboIncompleted] = await jumboSpider.run(paths)
  console.log('Jumbo Updated:', jumboUpdated.length)
  console.log('Jumbo Completed:', jumboCompleted.length)
  console.log('Jumbo Incompleted:', jumboIncompleted.length)
  console.timeEnd('Jumbo')

  await new Promise(resolve => setTimeout(resolve, 30 * TimeUnit.SEC))

  console.time('Santa')
  const santaSpider = new Santa()
  const [santaUpdated, santaCompleted, santaIncompleted] = await santaSpider.run(paths)
  console.log('Santa Updated:', santaUpdated.length)
  console.log('Santa Completed:', santaCompleted.length)
  console.log('Santa Incompleted:', santaIncompleted.length)
  console.timeEnd('Santa')

  await new Promise(resolve => setTimeout(resolve, 30 * TimeUnit.SEC))

  console.time('Lider')
  const liderSpider = new Lider()
  const [liderUpdated, liderCompleted, liderIncompleted] = await liderSpider.run(paths)
  console.log('Lider Updated:', liderUpdated.length)
  console.log('Lider Completed:', liderCompleted.length)
  console.log('Lider Incompleted:', liderIncompleted.length)
  console.timeEnd('Lider')

  await deleteManyDrinks(db)
  await dbDisconnect()
  await new Promise(resolve => setTimeout(resolve, 2 * TimeUnit.MIN))
}
