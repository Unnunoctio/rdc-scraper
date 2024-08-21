import DrinkModel from '../db/drink-model'
import { getDrinksApi } from '../utils/drinks-api'

const saveManyDrinksByApi = async (): Promise<void> => {
  const drinksApi = await getDrinksApi()
  const drinksFormatted = drinksApi.map(d => {
    const drinkId = d._id
    delete d._id
    return {
      drinkId,
      ...d
    }
  })

  const updateOperations = drinksFormatted.map(drink => ({
    updateOne: {
      filter: { drinkId: drink.drinkId },
      update: { $set: drink },
      upsert: true
    }
  }))

  await DrinkModel.bulkWrite(updateOperations)
}

export const drinkService = {
  saveManyDrinksByApi
}
