import { DRINKS_API } from '@/config'
import type { DrinkApi, DrinksApiResponse } from '@/types'

export const getDrinksApi = async (): Promise<DrinkApi[]> => {
  const drinksUrl = DRINKS_API as string

  try {
    const res = await fetch(drinksUrl)
    const data: DrinksApiResponse = await res.json()
    return data.data
  } catch (error) {
    console.error('Error fetching drinks:', error)
    return []
  }
}
