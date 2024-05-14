import { Jumbo } from './spiders/Jumbo.js'

console.time('Jumbo')
const jumboSpider = new Jumbo()
await jumboSpider.run([])
console.timeEnd('Jumbo')
