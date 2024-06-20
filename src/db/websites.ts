import type { Db, ObjectId } from 'mongodb'
import type { Website, WebsiteDB } from '../types'
import type { Scraper, Updater } from '../classes'
import { saveOrUpdateRecord, saveRecord } from './records'

export const getAllPaths = async (db: Db): Promise<string[]> => {
  try {
    const collection = db.collection<Website>('websites')
    const websites = await collection.find().toArray()

    return websites.map((website) => website.path)
  } catch (error) {
    console.error('Error when obtaining website paths')
    return []
  }
}

export const saveWebsite = async (db: Db, product: Scraper, infoId: ObjectId, watcher: number): Promise<ObjectId | undefined> => {
  try {
    const collection = db.collection<Website>('websites')
    const newWebsite = await collection.insertOne({
      info: infoId,
      path: product.url as string,
      price: product.price as number,
      best_price: product.bestPrice as number,
      average: product.average,
      last_update: watcher,
      in_stock: true,
      records: []
    })

    const recordId = await saveRecord(db, product.bestPrice as number)
    if (recordId !== undefined) {
      await collection.findOneAndUpdate(
        { _id: newWebsite.insertedId },
        { $push: { records: recordId } }
      )
    }

    return newWebsite.insertedId
  } catch (error) {
    console.error('Error when saving the website:', product.url)
    return undefined
  }
}

export const updateManyWebsites = async (db: Db, updates: Updater[], watcher: number): Promise<void> => {
  try {
    const collection = db.collection<Website>('websites')
    await Promise.all(updates.map(async (update) => {
      try {
        const website = await collection.findOne<WebsiteDB>({ path: update.url })
        if (website === null) return

        await collection.findOneAndUpdate(
          { _id: website._id },
          { $set: { price: update.price, best_price: update.bestPrice, average: update.average, last_update: watcher, in_stock: true } }
        )

        let recordId: ObjectId | undefined
        if (website.records.length === 0) {
          recordId = await saveRecord(db, update.bestPrice as number)
        } else {
          const lastRecordId = website.records[website.records.length - 1]
          recordId = await saveOrUpdateRecord(db, lastRecordId, update.bestPrice as number)
        }

        if (recordId !== undefined) {
          await collection.findOneAndUpdate(
            { _id: website._id },
            { $push: { records: recordId } }
          )
        }
      } catch (error) {
        console.error('Error updating the website', update.url, error)
      }
    }))
  } catch (error) {
    console.error('Error when obtaining the collection from the websites')
  }
}

export const updateWebsitesWithoutStock = async (db: Db, watcher: number): Promise<void> => {
  try {
    const collection = db.collection<Website>('websites')
    await collection.updateMany(
      { last_update: { $ne: watcher } },
      { $set: { price: 0, best_price: 0, in_stock: false } }
    )
  } catch (error) {
    console.error('Error when cleaning websites out of stock')
  }
}

export const deleteWebsite = async (db: Db, websiteId: ObjectId | undefined): Promise<void> => {
  if (websiteId === undefined) return

  try {
    const collection = db.collection<Website>('websites')
    await collection.deleteOne({ _id: websiteId })
  } catch (error) {
    console.error('Error when deleting the website:', websiteId)
  }
}
