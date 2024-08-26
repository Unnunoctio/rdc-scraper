import type { Scraper } from '../classes'
import ProductModel from '../db/product-model'
import type { Info } from '../types'
import { drinkService } from './drink-service'
import { imageService } from './image-service'
import { infoService } from './info-service'
import { websiteService } from './website-service'

const getDrinkInProducts = async (): Promise<string[]> => {
  try {
    const products = await ProductModel.find().lean().exec()
    return products.map(p => p.drink)
  } catch (error) {
    console.error('Error getting drinks ids')
    return []
  }
}

const saveManyProducts = async (products: Scraper[], info: Info, watcher: string): Promise<Scraper[]> => {
  const infoId = await infoService.findInfo(info)
  if (infoId === undefined) return []

  const notFound = await Promise.all(products.map(async (p) => {
    const drink = await drinkService.findDrink(p)
    if (drink === undefined) return p

    try {
      const product = await ProductModel.findOne({ drink: drink._id, quantity: p.quantity })
      if (product !== null) {
        const newWebsiteId = await websiteService.saveWebsite(p, infoId, watcher)
        if (newWebsiteId !== undefined) {
          await ProductModel.findByIdAndUpdate(product._id, { $push: { websites: newWebsiteId } })
          return undefined
        }
      } else {
        const newProduct = await ProductModel.create({ quantity: p.quantity, drink: drink._id, websites: [] })
        const newWebsiteId = await websiteService.saveWebsite(p, infoId, watcher)
        const newImageId = await imageService.saveImage(p.image as string, p.category as string, p.brand as string, newProduct.sku)

        await ProductModel.findByIdAndUpdate(newProduct._id, { $set: { images: newImageId }, $push: { websites: newWebsiteId } })
        return undefined
      }
      return p
    } catch (error) {
      console.error('Error saving product', error)
      return p
    }
  }))

  return notFound.filter(p => p !== undefined) as Scraper[]
}

export const productService = {
  getDrinkInProducts,
  saveManyProducts
}
