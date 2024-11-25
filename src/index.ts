// import { executeSpiders } from './scraping/spiders/run'

import { Scraper } from './scraping/classes'
import { drinkTable } from './services/databases/drink-table'

// async function main (): Promise<void> {
//   // TODO: Scraping Function
//   await executeSpiders()
// }

// main().then(() => {
//   console.log('Process completed successfully')
//   process.exit(0)
// }).catch((error) => {
//   console.error('Process failed:', error)
//   process.exit(1)
// })

// TODO: TEST

// await drinkTable.saveDrinksByApi()

const product: Scraper = new Scraper('Jumbo')
product.title = 'Pack 6 un. Cerveza Royal Guard Golden Lager 4.5° 355 cc'
product.brand = 'Royal Guard'
product.alcoholicGrade = 4.5
product.content = 355
product.package = 'Botella'

const drink = await drinkTable.findDrink(product)
console.log(drink)
