import type { Db, ObjectId } from 'mongodb'
import type { DrinkDB, Info, Product } from '../types'
import type { Scraper } from '../classes'
import { getInfo } from './infos'
import { getDrink } from './drinks'
import { deleteImage, saveImage } from './images'
import { deleteWebsite, saveWebsite } from './websites'

export const getDrinkInProducts = async (db: Db): Promise<ObjectId[]> => {
  try {
    const collection = db.collection<Product>('products')
    const products = await collection.find().toArray()

    return products.map(product => product.drink)
  } catch (error) {
    console.error('Error when obtaining drinks ids in products')
    return []
  }
}

const generateSku = async (db: Db): Promise<number> => {
  const collection = db.collection<Product>('products')
  while (true) {
    const sku = parseInt((Math.round(Math.random() * 321123) * new Date().getTime()).toString().slice(0, 6))
    const product = await collection.findOne({ sku })
    if (product === null) return sku
  }
}

export const saveManyProducts = async (db: Db, products: Scraper[], drinks: DrinkDB[], info: Info, watcher: number): Promise<Scraper[]> => {
  const infoId = await getInfo(db, info)
  if (infoId === undefined) return []

  const notFoundProducts = await Promise.all(products.map(async (p) => {
    const drinkDB = getDrink(p, drinks)
    if (drinkDB === undefined) return p

    try {
      const collection = db.collection<Product>('products')
      const productDB = await collection.findOne({ drink: drinkDB._id, quantity: p.quantity })
      if (productDB !== null) {
        const newWebsiteId = await saveWebsite(db, p, infoId, watcher)
        if (newWebsiteId !== undefined) {
          await collection.findOneAndUpdate({ _id: productDB._id }, { $push: { websites: newWebsiteId } })
          return undefined
        }
      } else {
        const newSku = await generateSku(db)
        const newWebsiteId = await saveWebsite(db, p, infoId, watcher)
        const newImageId = await saveImage(db, p.image as string, p.category as string, p.brand as string, newSku)

        if (newWebsiteId !== undefined && newImageId !== undefined) {
          await collection.insertOne({
            sku: newSku,
            quantity: p.quantity as number,
            images: newImageId,
            drink: drinkDB._id,
            websites: [newWebsiteId]
          })
          return undefined
        } else {
          await deleteWebsite(db, newWebsiteId)
          await deleteImage(db, newImageId)
        }
      }

      return p
    } catch (error) {
      console.error('Error saving product:', p.title, error)
      return p
    }
  }))

  return notFoundProducts.filter(product => product !== undefined) as Scraper[]
}
