import { DrinkModel, ProductModel } from '../models/index.js'

export const deleteManyDrinks = async (): Promise<void> => {
  try {
    const products = await ProductModel.find()
    const drinksId = products.map(p => p.drink)

    await DrinkModel.deleteMany({ _id: { $nin: drinksId } })
  } catch (error) {
    console.log('Error al eliminar los drinks')
  }
}
