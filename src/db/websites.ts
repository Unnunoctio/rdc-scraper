import { Db, ObjectId } from 'mongodb'
import { Website, WebsiteDB } from '../types'
import { saveOrUpdateRecord, saveRecord } from './records.js'
import { Updater } from '../classes/Updater'

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
        console.error('Error al actualizar el website ', update.url, error)
      }
    }))
  } catch (error) {
    console.error('Error al obtener la colección de los websites')
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
    console.error('Error al limpiar los websites sin stock')
  }
}
