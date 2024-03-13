import { WebsiteModel } from '../models/index.js'
import { WebsiteDB } from '../types'

export const getAllPathWebsites = async (): Promise<string[]> => {
  try {
    const websites = await WebsiteModel.find<WebsiteDB>()
    return websites.map(w => w.path)
  } catch (error) {
    console.error('Error al obtener los path de los websites', error)
    return []
  }
}
