import type { Scraper, Updater } from '../classes'
import WebsiteModel from '../db/website-model'
import { priceLogService } from './price-log-service'

const getAllPaths = async (): Promise<string[]> => {
  try {
    const websites = await WebsiteModel.find().lean().exec()
    return websites.map(website => website.path)
  } catch (error) {
    console.log('Error getting paths:', error)
    return []
  }
}

const saveWebsite = async (product: Scraper, infoId: string, watcher: string): Promise<string | undefined> => {
  try {
    const newWebsite = await WebsiteModel.create({
      info: infoId,
      path: product.url,
      price: product.price,
      bestPrice: product.bestPrice,
      average: product.average,
      lastUpdate: watcher,
      inStock: true,
      priceLogs: []
    })

    const logId = await priceLogService.savePriceLog(newWebsite.bestPrice)
    if (logId !== undefined) {
      await WebsiteModel.findByIdAndUpdate(newWebsite._id, { $push: { priceLogs: logId } })
    }

    return newWebsite._id
  } catch (error) {
    console.error('Error saving website:', error)
    return undefined
  }
}

const updateManyWebsites = async (updates: Updater[], watcher: string): Promise<void> => {
  await Promise.all(updates.map(async (update) => {
    try {
      const website = await WebsiteModel.findOneAndUpdate(
        { path: update.url },
        { $set: { price: update.price, bestPrice: update.bestPrice, average: update.average, lastUpdate: watcher, inStock: true } },
        { upsert: false }
      )
      if (website === null) return

      let logId: string | undefined
      if (website.priceLogs.length === 0) {
        logId = await priceLogService.savePriceLog(update.bestPrice as number)
      } else {
        const lastLogId = website.priceLogs[website.priceLogs.length - 1]
        logId = await priceLogService.saveOrUpdatePriceLog(lastLogId, update.bestPrice as number)
      }

      if (logId !== undefined) await WebsiteModel.findOneAndUpdate({ _id: website._id }, { $push: { priceLogs: logId } })
    } catch (error) {
      console.error('Error updating website:', error)
    }
  }))
}

const updateWebsitesWithoutStock = async (watcher: string): Promise<void> => {
  try {
    await WebsiteModel.updateMany({ lastUpdate: { $ne: watcher } }, { $set: { price: 0, bestPrice: 0, inStock: false } })
  } catch (error) {
    console.log('Error clean websites out of stock')
  }
}

export const websiteService = {
  getAllPaths,
  saveWebsite,
  updateManyWebsites,
  updateWebsitesWithoutStock
}
