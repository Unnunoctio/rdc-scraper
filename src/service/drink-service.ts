import DrinkModel from '../db/drink-model'
import type { DrinkDB } from '../types'
import type { Scraper } from '../classes'
import { getDrinksApi } from '../utils/drinks-api'
import { productService } from './product-service'

const saveManyDrinksByApi = async (): Promise<void> => {
  const drinksApi = await getDrinksApi()

  const updateOperations = drinksApi.map(drink => ({
    updateOne: {
      filter: { drinkId: drink._id },
      update: {
        $set: {
          name: drink.name,
          brand: drink.brand,
          abv: drink.abv,
          volume: drink.volume,
          packaging: drink.packaging,
          category: drink.category,
          subCategory: drink.subCategory,
          origin: drink.origin,
          variety: drink.variety,
          ibu: drink.ibu,
          servingTemp: drink.servingTemp,
          strain: drink.strain,
          vineyard: drink.vineyard
        }
      },
      upsert: true
    }
  }))

  await DrinkModel.bulkWrite(updateOperations)
}

const findDrink = async (product: Scraper): Promise<DrinkDB | undefined> => {
  const drinks = await DrinkModel.find({ brand: product.brand, volume: product.content, packaging: product.package, abv: product.alcoholicGrade }, { createdAt: 0, updatedAt: 0 }).lean().exec()
  if (drinks.length === 0) return undefined

  let selected: DrinkDB | undefined
  let matching = -1

  const titleSplit = product.title?.toLocaleLowerCase().split(' ').filter(w => w !== '') as string[]

  for (const d of drinks) {
    const nameSplit = d.name?.toLowerCase().split(' ').filter(w => w !== '')
    const isMatching = nameSplit.every(w => titleSplit.includes(w))

    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (isMatching && (nameSplit.length > matching)) {
      matching = nameSplit.length
      selected = d
    }
  }

  return selected
}

const deleteManyDrinks = async (): Promise<void> => {
  try {
    const drinksId = await productService.getDrinkInProducts()
    await DrinkModel.deleteMany({ _id: { $nin: drinksId } })
  } catch (error) {
    console.error('Error deleting drinks')
  }
}

export const drinkService = {
  saveManyDrinksByApi,
  findDrink,
  deleteManyDrinks
}
