import { Db, ObjectId } from 'mongodb'
import { Product } from '../types'

export const getDrinkInProducts = async (db: Db): Promise<ObjectId[]> => {
  try {
    const collection = db.collection<Product>('products')
    const products = await collection.find().toArray()

    return products.map(product => product.drink)
  } catch (error) {
    console.error('Error al obtener los drinks ids in products')
    return []
  }
}
