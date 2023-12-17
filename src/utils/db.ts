import { ObjectId } from 'mongoose'
import { Drink, DrinkDB, Info, InfoDB, ProductDB, RecordDB, Scraper, WebsiteDB } from '../types'
import { DrinkModel, ImageModel, InfoModel, ProductModel, RecordModel, WebsiteModel } from '../models/index.js'

const getWebsiteInfo = async (info: Info): Promise<InfoDB | null> => {
  try {
    const websiteInfo = await InfoModel.findOne<InfoDB>({ url: info.url })
    if (websiteInfo !== null) return websiteInfo
    return await InfoModel.create<InfoDB>(info)
  } catch (error) {
    console.log(`Error al obtener/crear la info: ${info.name}`)
    return null
  }
}

const getDrink = (product: Scraper, drinksApi: Drink[]): Drink | null => {
  try {
    const options = drinksApi.filter(d => d.brand === product.brand && d.content === product.content && d.package === product.package && d.alcoholic_grade === product.alcoholic_grade)
    if (options.length === 0) return null

    let selectedDrink: Drink | null = null
    let matchingWords: string[] = []

    const titleSplit = product.title.toLowerCase().split(' ')

    options.forEach(option => {
      const nameSplit = option.name.replace(`${product.brand} `, '').toLowerCase().split(' ')
      const isMatching = nameSplit.every(word => titleSplit.includes(word))

      if (isMatching && (nameSplit.length > matchingWords.length)) {
        matchingWords = nameSplit
        selectedDrink = option
      }
    })

    return selectedDrink
  } catch (error) {
    console.log(`Error al obtener el drink: ${product.title}`)
    return null
  }
}

const findAndUpdateWebsite = async (product: Scraper, watcher: number): Promise<WebsiteDB | null> => {
  try {
    const website = await WebsiteModel.findOne<WebsiteDB>({ path: product.url })
    if (website === null) return null

    // Actualizar el website con la nueva informacion
    const websiteUpdated = await WebsiteModel.findByIdAndUpdate<WebsiteDB>(
      website._id,
      { price: product.price, best_price: product.best_price, average: product.average, last_update: watcher, in_stock: true },
      { new: true }
    )
    if (websiteUpdated === null) return null

    const record = await RecordModel.findById<RecordDB>(websiteUpdated.records[websiteUpdated.records.length - 1])
    // comparar fecha del record con la fecha actual
    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)
    if (currentDate.getTime() === record?.date.getTime()) return websiteUpdated

    // crear new record y agregarlo a el website
    const newRecord = await RecordModel.create<RecordDB>({ date: currentDate, price: websiteUpdated.best_price })
    return await WebsiteModel.findByIdAndUpdate<WebsiteDB>(websiteUpdated._id, { records: [...websiteUpdated.records, newRecord._id] }, { new: true })
  } catch (error) {
    console.log('Error al actualizar el website')
    return null
  }
}

const addWebsite = async (product: Scraper, infoId: ObjectId, watcher: number): Promise<WebsiteDB | null> => {
  try {
    // Crear record
    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)
    const newRecord = await RecordModel.create<RecordDB>({ date: currentDate, price: product.best_price })
    // Crear website
    return await WebsiteModel.create({
      info: infoId,
      path: product.url,
      price: product.price,
      best_price: product.best_price,
      average: product.average,
      last_update: watcher,
      in_stock: true,
      records: [newRecord._id]
    })
  } catch (error) {
    console.log(`Error al agregar el website: ${product.title}`)
    return null
  }
}

const generateSku = async (): Promise<number> => {
  while (true) {
    const sku = parseInt((Math.round(Math.random() * 321123) * new Date().getTime()).toString().slice(0, 6))
    const product = await ProductModel.findOne<ProductDB>({ sku })
    if (product === null) return sku
  }
}

export const saveProducts = async (products: Scraper[], drinksApi: Drink[], info: Info): Promise<Scraper[]> => {
  const watcher = new Date().getTime()

  const websiteInfo = await getWebsiteInfo(info)
  if (websiteInfo === null) return []

  const notFound = await Promise.all(products.map(async (p) => {
    const websiteUpdated = await findAndUpdateWebsite(p, watcher)
    if (websiteUpdated !== null) return undefined

    const drinkApi = getDrink(p, drinksApi)
    if (drinkApi === null) return p

    try {
      const drink = await DrinkModel.findOneAndUpdate<DrinkDB>({ name: drinkApi.name, brand: drinkApi.brand, content: drinkApi.content, package: drinkApi.package, alcoholic_grade: drinkApi.alcoholic_grade }, drinkApi, { upsert: true, new: true })

      const product = await ProductModel.findOne<ProductDB>({ drink: drink._id, quantity: p.quantity })
      if (product !== null) {
        const newWebsite = await addWebsite(p, websiteInfo._id, watcher)
        if (newWebsite !== null) {
          await ProductModel.findByIdAndUpdate(product._id, { websites: [...product.websites, newWebsite._id] })
          return undefined
        }
      } else {
        const newProduct = await ProductModel.create({ sku: await generateSku(), quantity: p.quantity, drink: drink._id, websites: [] })
        if (newProduct !== null) {
          const newWebsite = await addWebsite(p, websiteInfo._id, watcher)
          const newImages = await ImageModel.create({ small: p.images?.small, large: p.images?.large })
          if (newWebsite !== null && newImages !== null) {
            await ProductModel.findByIdAndUpdate(newProduct._id, { websites: [newWebsite._id], images: newImages._id })
            return undefined
          }
        }
      }

      return p
    } catch (error) {
      console.log(`Error al guardar el producto: ${p.title}`)
      return p
    }
  }))

  // update websites sin stock
  try {
    await WebsiteModel.updateMany<WebsiteDB>({ last_update: { $ne: watcher }, info: websiteInfo._id }, { price: 0, best_price: 0, in_stock: false })
  } catch (error) {
    console.log('Error al actualizar el stock de los websites')
  }

  return notFound.filter(p => p !== undefined) as Scraper[]
}

export const deleteAll = async (): Promise<void> => {
  await WebsiteModel.deleteMany()
  await ProductModel.deleteMany()
  await DrinkModel.deleteMany()
  await InfoModel.deleteMany()
  await RecordModel.deleteMany()
  await ImageModel.deleteMany()
}
