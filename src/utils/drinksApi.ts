import { Drink, DrinksApi } from '../types'
import { DRINKS_API } from '../config.js'

export const getDrinksApi = async (): Promise<Drink[]> => {
  const drinksUrl = DRINKS_API as string
  const pages = [
    `${drinksUrl}/cervezas?limit=0`,
    `${drinksUrl}/destilados?limit=0`,
    `${drinksUrl}/vinos?limit=0`
  ]

  try {
    const drinks = await Promise.all(pages.map(async (page) => {
      const res = await fetch(page)
      const data: DrinksApi = await res.json()
      return data.drinks
    }))

    return drinks.flat()
  } catch (error) {
    console.error('Error al obtener los drinks desde la api')
    return []
  }
}
