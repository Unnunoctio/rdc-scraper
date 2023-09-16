import { ProductScraper, UpdateWebsite, Website } from '../types'
import ProductModel from '../models/ProductModel.js'
import { getDrink } from './utilsAPI.js'

const getProductTitle = (name: string, packageData: string, content: number, quantity: number): string => {
  let title = ''
  if (quantity > 1) title += `Pack ${quantity} un. `

  title += `${name} ${packageData} `

  if (content >= 1000) {
    title += `${content / 1000}L`
  } else {
    title += `${content}cc`
  }

  return title
}

export const isProductExist = async (urlWebsite: string): Promise<boolean> => {
  try {
    const product = await ProductModel.findOne({ 'websites.url': urlWebsite })
    if (product === null) return false
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

export const addProduct = async (website: Website, product: ProductScraper): Promise<boolean> => {
  try {
    const drinkAPI = await getDrink(product.title, product.brand, product.content as number, product.package as string, product.alcoholicGrade as number)
    if (drinkAPI === null) return false

    const productDB = await ProductModel.findOne({ 'product._id': drinkAPI._id, quantity: product.quantity })
    if (productDB !== null) {
      productDB.websites.push(website)
      await productDB.save()
      return true
    } else {
      const title = getProductTitle(drinkAPI.name, drinkAPI.package, drinkAPI.content, product.quantity as number)
      const newProduct = new ProductModel({ title, product: drinkAPI, quantity: product.quantity, websites: [website], images: product.images })
      await newProduct.save()
      return true
    }
  } catch (error) {
    console.error(error)
    return false
  }
}

export const updateWebsite = async (updateWebsite: UpdateWebsite): Promise<boolean> => {
  try {
    const product = await ProductModel.findOneAndUpdate(
      {
        'websites.url': updateWebsite.url
      },
      {
        $set: {
          'websites.$.price': updateWebsite.price,
          'websites.$.best_price': updateWebsite.best_price,
          'websites.$.average': updateWebsite.average,
          'websites.$.watch': updateWebsite.watch
        }
      }
    )

    if (product == null) return false
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

export const deleteWithoutStock = async (websiteName: string, websiteWatch: number): Promise<boolean> => {
  try {
    const products = await ProductModel.find()

    for (const product of products) {
      for (const website of product.websites) {
        if (website.name === websiteName && website.watch !== websiteWatch) {
          await ProductModel.findOneAndUpdate(
            { 'websites.url': website.url },
            { $pull: { websites: { url: website.url } } },
            { new: true }
          )
        }
      }
    }

    // ? Elimina los productos que no tienen ningun website
    await ProductModel.deleteMany(
      { websites: { $exists: true, $size: 0 } }
    )
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}
