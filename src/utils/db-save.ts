import { ObjectId } from 'mongoose'
import { DrinkModel, ImageModel, InfoModel, ProductModel, RecordModel, WebsiteModel } from '../models/index.js'
import { Drink, DrinkDB, ImageDB, Info, InfoDB, ProductDB, RecordDB, WebsiteDB } from '../types'
import { ENVIRONMENT } from '../config.js'
import { uploadImages } from './images.js'
import { ScraperClass } from '../classes/ScraperClass.js'

const getInfo = async (info: Info): Promise<InfoDB | undefined> => {
  try {
    const infoDB = await InfoModel.findOne<InfoDB>({ name: info.name })
    if (infoDB !== null) return infoDB

    return await InfoModel.create<InfoDB>(info)
  } catch (error) {
    console.error('Error al obtener/crear la info', info.name, error)
    return undefined
  }
}

const getDrink = (product: ScraperClass, drinks: DrinkDB[]): DrinkDB | undefined => {
  try {
    const drinkOptions = drinks.filter(d => d.brand === product.brand && d.content === product.content && d.package === product.package && d.alcoholic_grade === product.alcoholic_grade)
    if (drinkOptions.length === 0) return undefined

    let selectedDrink: DrinkDB | undefined
    let matchingWords: number = -1

    const titleSplit = product.title?.toLowerCase().split(' ').filter(word => word !== '') as string[]

    drinkOptions.forEach(option => {
      const nameSplit = option.name.toLowerCase().replace(`${option.brand.toLowerCase()}`, '').split(' ').filter(word => word !== '')
      const isMatching = nameSplit.every(word => titleSplit.includes(word))

      if (isMatching && (nameSplit.length > matchingWords)) {
        matchingWords = nameSplit.length
        selectedDrink = option
      }
    })

    return selectedDrink
  } catch (error) {
    console.error('Error al obtener el drink', product.title)
    return undefined
  }
}

const saveDrink = async (drink: Drink): Promise<void> => {
  try {
    const drinkDB = await DrinkModel.findOne<DrinkDB>({ name: drink.name, brand: drink.brand, content: drink.content, package: drink.package, alcoholic_grade: drink.alcoholic_grade })
    if (drinkDB !== null) return

    await DrinkModel.create<DrinkDB>(drink)
  } catch (error) {
    console.error('Error al guardar el drink', drink.name)
  }
}

const saveWebsite = async (product: ScraperClass, infoId: ObjectId, watcher: number): Promise<WebsiteDB | undefined> => {
  try {
    const websiteDB = await WebsiteModel.create({
      info: infoId,
      path: product.url,
      price: product.price,
      best_price: product.best_price,
      average: product.average,
      last_update: watcher,
      in_stock: true,
      records: []
    })

    if (ENVIRONMENT === 'DEV') return websiteDB

    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)
    const newRecord = await RecordModel.create<RecordDB>({ date: currentDate, price: product.best_price as number })

    const updated = await WebsiteModel.findByIdAndUpdate<WebsiteDB>(websiteDB._id, { $push: { records: newRecord._id } })
    if (updated === null) return undefined

    return updated
  } catch (error) {
    console.error('Error al guardar el website', product.url, error)
    return undefined
  }
}

const saveImage = async (image: string, category: string, brand: string, sku: number): Promise<ImageDB | undefined> => {
  try {
    const cloudImages = await uploadImages(image, category, brand, sku)
    return await ImageModel.create<ImageDB>({ small: cloudImages.small, large: cloudImages.large })
  } catch (error) {
    console.error('Error al guardar las imagenes', error)
    return undefined
  }
}

const generateSku = async (): Promise<number> => {
  while (true) {
    const sku = parseInt((Math.round(Math.random() * 321123) * new Date().getTime()).toString().slice(0, 6))
    const product = await ProductModel.findOne<ProductDB>({ sku })
    if (product === null) return sku
  }
}

export const saveManyProducts = async (products: ScraperClass[], drinks: DrinkDB[], info: Info, watcher: number): Promise<ScraperClass[]> => {
  const infoDB = await getInfo(info)
  if (infoDB === undefined) return []

  const notFound = await Promise.all(products.map(async (p) => {
    const drink = getDrink(p, drinks)
    if (drink === undefined) return p

    try {
      const product = await ProductModel.findOne<ProductDB>({ drink: drink._id, quantity: p.quantity })
      if (product !== null) {
        const newWebsite = await saveWebsite(p, infoDB._id, watcher)
        if (newWebsite !== undefined) {
          await ProductModel.findByIdAndUpdate(product._id, { $push: { websites: newWebsite._id } })
          return undefined
        }
      } else {
        const newProduct = await ProductModel.create({ sku: await generateSku(), quantity: p.quantity, drink: drink._id, websites: [] })
        if (newProduct !== null) {
          const newWebsite = await saveWebsite(p, infoDB._id, watcher)
          // if (ENVIRONMENT === 'DEV') {
          //   if (newWebsite !== undefined) {
          //     await ProductModel.findByIdAndUpdate(newProduct._id, { $push: { websites: newWebsite._id } })
          //     return undefined
          //   }
          // }

          const newImages = await saveImage(p.image as string, p.category as string, p.brand as string, newProduct.sku)

          if (newWebsite !== undefined && newImages !== undefined) {
            await ProductModel.findByIdAndUpdate(newProduct._id, { images: newImages._id, $push: { websites: newWebsite._id } })
            return undefined
          } else {
            await ProductModel.findByIdAndDelete(newProduct._id)
            await WebsiteModel.findByIdAndDelete(newWebsite?._id)
            await ImageModel.findByIdAndDelete(newImages?._id)
          }
        }
      }

      return p
    } catch (error) {
      console.error('Error al guardar el producto', p.title, error)
      return p
    }
  }))

  return notFound.filter(p => p !== undefined) as ScraperClass[]
}

export const saveManyDrinks = async (drinks: Drink[]): Promise<DrinkDB[]> => {
  await Promise.all(drinks.map(async (d) => {
    await saveDrink(d)
  }))

  try {
    return await DrinkModel.find<DrinkDB>()
  } catch (error) {
    console.error('Error al obtener los drinks guardados')
    return []
  }
}
