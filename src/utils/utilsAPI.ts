import axios from 'axios'
import { Drink, ProductUnit } from '../types'
import ProductUnitModel from '../models/ProductUnitModel.js'

export const getNewProductUnits = async (): Promise<void> => {
  const pages = [`${process.env.DRINKS_API as string}&category=Cervezas`, `${process.env.DRINKS_API as string}&category=Destilados`, `${process.env.DRINKS_API as string}&category=Vinos`]
  try {
    const drinks = await Promise.all(pages.map(async page => {
      const { data }: { data: Drink[] } = await axios.get(page)
      return data
    }))

    const allDrinks = drinks.flat()
    const newProducts: Array<ProductUnit | undefined> = await Promise.all(allDrinks.map(async drink => {
      const drinkExists = await ProductUnitModel.findOne({
        name: drink.name,
        brand: drink.brand,
        alcoholic_grade: drink.alcoholic_grade,
        content: drink.content,
        package: drink.package
      })

      if (drinkExists === null) {
        const { _id, ...rest } = drink
        return rest as ProductUnit
      }
    }))

    await ProductUnitModel.insertMany(newProducts.filter(product => product !== undefined))
  } catch (error) {
    console.error(error.message)
  }
}

export const isBrandExist = async (brand: string): Promise<boolean> => {
  try {
    const productsCount = await ProductUnitModel.countDocuments({ brand })
    return productsCount > 0
  } catch (error) {
    console.log(brand)
    console.error(error.message)
    return false
  }
}

export const getDrink = async (title: string, brand: string, content: number, packageData: string, alcoholicGrade: number): Promise<Drink | null> => {
  try {
    const products = await ProductUnitModel.find({
      brand,
      content,
      package: packageData,
      alcoholic_grade: alcoholicGrade
    })
    if (products.length === 0) return null

    let productCorrect: ProductUnit | null = null
    let nameCorrect: string[] = []

    const titleSplit = title.toLowerCase().split(' ')
    products.forEach(product => {
      const nameSplit = product.name.replace(`${brand} `, '').toLowerCase().split(' ')
      const isContains = nameSplit.every((word) => titleSplit.includes(word))
      if (isContains && (nameSplit.length > nameCorrect.length)) {
        nameCorrect = nameSplit
        productCorrect = product
      }
    })

    return productCorrect
  } catch (error) {
    console.error(error.message)
    return null
  }
}
