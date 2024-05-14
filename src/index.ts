import { Jumbo } from './spiders/Jumbo.js'

while (true) {
  console.time('Jumbo')
  const jumboSpider = new Jumbo()
  await jumboSpider.run([])
  console.timeEnd('Jumbo')

  await new Promise(resolve => setTimeout(resolve, 10000))
}
