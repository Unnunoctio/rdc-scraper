import { Db, MongoClient } from 'mongodb'
import { DB_URI } from '../config'

const client = new MongoClient(DB_URI as string)

export const dbConnect = async (): Promise<Db | undefined> => {
  try {
    await client.connect()
    console.log('Connected to the Database')

    const db = client.db()
    return db
  } catch (error) {
    console.log('Error connecting to the Database')
    return undefined
  }
}

export const dbDisconnect = async (): Promise<void> => {
  await client.close()
  console.log('Disconnected from the Database')
}
