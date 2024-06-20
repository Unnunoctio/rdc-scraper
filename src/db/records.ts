import type { Db, ObjectId } from 'mongodb'
import type { Record } from '../types'

export const saveRecord = async (db: Db, price: number): Promise<ObjectId | undefined> => {
  try {
    const collection = db.collection<Record>('records')
    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)

    const newRecord = await collection.insertOne({ date: currentDate, price })
    return newRecord.insertedId
  } catch (error) {
    console.error('Error saving record')
    return undefined
  }
}

export const saveOrUpdateRecord = async (db: Db, lastRecordId: ObjectId, price: number): Promise<ObjectId | undefined> => {
  try {
    const collection = db.collection<Record>('records')
    const record = await collection.findOne({ _id: lastRecordId })
    if (record === null) return undefined

    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)

    if (currentDate.toISOString().split('T')[0] === record.date.toISOString().split('T')[0]) {
      await collection.findOneAndUpdate({ _id: lastRecordId }, { $set: { price } })
      return undefined
    }

    const newRecord = await collection.insertOne({ date: currentDate, price })
    return newRecord.insertedId
  } catch (error) {
    console.error('Error saving or updating the record')
    return undefined
  }
}
