import { Db, ObjectId } from 'mongodb'
import { Info } from '../types'

export const getInfo = async (db: Db, info: Info): Promise<ObjectId | undefined> => {
  try {
    const collection = db.collection<Info>('infos')
    const infoDB = await collection.findOne({ name: info.name })
    if (infoDB !== null) return infoDB._id

    const newInfo = await collection.insertOne(info)
    return newInfo.insertedId
  } catch (error) {
    console.error('Error al obtener/crear en info', info.name)
    return undefined
  }
}
