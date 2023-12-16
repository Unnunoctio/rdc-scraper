import axios from 'axios'
import { Drink } from '../types'

export const getDrinksApi = async (): Promise<Drink[]> => {
  const drinksUrl = process.env.DRINKS_API as string
  const pages = [`${drinksUrl}&category=Cervezas`, `${drinksUrl}&category=Destilados`, `${drinksUrl}&category=Vinos`]

  try {
    const drinks = await Promise.all(pages.map(async (page) => {
      const { data } = await axios.get<Drink[]>(page)
      return data
    }))

    return drinks.flat()
  } catch (error) {
    console.log(error)
    return []
  }
}
