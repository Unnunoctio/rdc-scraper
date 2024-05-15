import { Db } from 'mongodb'
import { Website } from '../types'

export const getAllPaths = async (db: Db): Promise<string[]> => {
  try {
    const collection = db.collection<Website>('websites')
    const websites = await collection.find().toArray()

    return websites.map((website) => website.path)
  } catch (error) {
    console.error('Error al obtener los paths de los websites')
    return []
  }
}
