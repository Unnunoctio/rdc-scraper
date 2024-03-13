import { ObjectId } from 'mongoose'
import { RecordModel, WebsiteModel } from '../models/index.js'
import { RecordDB, UpdateWebsite, WebsiteDB } from '../types'
import { ENVIRONMENT } from '../config.js'

const saveRecord = async (lastRecordId: ObjectId, price: number): Promise<RecordDB | undefined> => {
  try {
    const record = await RecordModel.findById<RecordDB>(lastRecordId)
    if (record === null) throw new Error('Record not found')

    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)

    if (currentDate.toISOString().split('T')[0] === record.date.toISOString().split('T')[0]) {
      await RecordModel.findByIdAndUpdate<RecordDB>(lastRecordId, { price })
      return undefined
    }

    return await RecordModel.create<RecordDB>({ date: currentDate, price })
  } catch (error) {
    console.error(error)
    return undefined
  }
}

export const updateManyWebsites = async (updates: UpdateWebsite[], watcher: number): Promise<void> => {
  await Promise.all(updates.map(async (update) => {
    try {
      const website = await WebsiteModel.findOne<WebsiteDB>({ path: update.url })
      if (website === null) return

      if (ENVIRONMENT === 'DEV') {
        return await WebsiteModel.findByIdAndUpdate<WebsiteDB>(
          website._id,
          { price: update.price, best_price: update.best_price, average: update.average, last_update: watcher, in_stock: true }
        )
      }

      const record = await saveRecord(website.records[website.records.length - 1], update.best_price)
      if (record === undefined) {
        return await WebsiteModel.findByIdAndUpdate<WebsiteDB>(
          website._id,
          { price: update.price, best_price: update.best_price, average: update.average, last_update: watcher, in_stock: true }
        )
      }

      return await WebsiteModel.findByIdAndUpdate<WebsiteDB>(
        website._id,
        { price: update.price, best_price: update.best_price, average: update.average, last_update: watcher, in_stock: true, $push: { records: record._id } }
      )
    } catch (error) {
      console.error('Error in update website', error)
    }
  }))
}

export const updateManyWebsitesWithoutStock = async (watcher: number): Promise<void> => {
  try {
    await WebsiteModel.updateMany<WebsiteDB>({ last_update: { $ne: watcher } }, { price: 0, best_price: 0, in_stock: false })
  } catch (error) {
    console.error('Error la actualizar limpiar los websites sin stock')
  }
}
