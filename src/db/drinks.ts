import { Db } from 'mongodb'
import { Drink, DrinkDB } from '../types.js'
import { getDrinkInProducts } from './products.js'
import { getDrinksApi } from '../utils/drinksApi.js'
import { Scraper } from '../classes/Scraper.js'

export const getDrink = (product: Scraper, drinks: DrinkDB[]): DrinkDB | undefined => {
  try {
    const drinkOptions = drinks.filter(d => d.brand === product.brand && d.content === product.content && d.package === product.package && d.alcoholic_grade === product.alcoholicGrade)
    if (drinkOptions.length === 0) return undefined

    let selectedDrink: DrinkDB | undefined
    let matchingWords: number = -1

    const titleSplit = product.title?.toLowerCase().split(' ').filter(word => word !== '') as string[]

    drinkOptions.forEach(option => {
      const nameSplit = option.name.toLowerCase().replace(`${option.brand.toLowerCase()}`, '').split(' ').filter(word => word !== '')
      const isMatching = nameSplit.every(word => titleSplit.includes(word))

      if (isMatching && (nameSplit.length > matchingWords)) {
        matchingWords = nameSplit.length
        selectedDrink = option
      }
    })

    return selectedDrink
  } catch (error) {
    console.error('Error al obtener el drink', product.title)
    return undefined
  }
}

const saveDrink = async (db: Db, drink: Drink): Promise<void> => {
  try {
    const collection = db.collection<Drink>('drinks')
    const drinkDB = await collection.findOne<DrinkDB>({ name: drink.name, brand: drink.brand, content: drink.content, package: drink.package, alcoholic_grade: drink.alcoholic_grade })
    if (drinkDB !== null) return

    await collection.insertOne(drink)
  } catch (error) {
    console.error(`Error al guardar el drink: ${drink.name}`)
  }
}

export const saveManyDrinks = async (db: Db): Promise<DrinkDB[]> => {
  const drinksApi = await getDrinksApi()

  await Promise.all(drinksApi.map(async (d: any) => {
    delete d._id
    await saveDrink(db, d)
  }))

  try {
    const collection = db.collection<Drink>('drinks')
    return await collection.find().toArray()
  } catch (error) {
    console.error('Error al obtener los drinks guardados')
    return []
  }
}

export const deleteManyDrinks = async (db: Db): Promise<void> => {
  try {
    const drinksId = await getDrinkInProducts(db)
    const collection = db.collection<Drink>('drinks')

    await collection.deleteMany({ _id: { $nin: drinksId } })
  } catch (error) {
    console.error('Error al eliminar los drinks')
  }
}
