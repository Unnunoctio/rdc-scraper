import { Drink } from '../types'
import { DRINKS_API } from '../config.js'

export const getDrinksApi = async (): Promise<Drink[]> => {
  const drinksUrl = DRINKS_API as string
  const pages = [
    `${drinksUrl}&category=Cervezas`,
    `${drinksUrl}&category=Destilados`,
    `${drinksUrl}&category=Vinos`
  ]

  try {
    const drinks = await Promise.all(pages.map(async (page) => {
      const res = await fetch(page)
      const data: Drink[] = await res.json()
      return data
    }))

    return drinks.flat()
  } catch (error) {
    console.error('Error al obtener los drinks desde la api')
    return []
  }
}
