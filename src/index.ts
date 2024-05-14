import { Jumbo } from './spiders/Jumbo.js'

while (true) {
  console.time('Jumbo')
  const jumboSpider = new Jumbo()
  const [updated, completed, incompleted] = await jumboSpider.run([])
  console.log('Updated:', updated.length)
  console.log('Completed:', completed.length)
  console.log('Incompleted:', incompleted.length)
  console.timeEnd('Jumbo')

  await new Promise(resolve => setTimeout(resolve, 60000))
}
