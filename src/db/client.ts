import { Db, MongoClient } from 'mongodb'
import { DB_URI } from '../config.js'

const client = new MongoClient(DB_URI as string)

export const dbConnect = async (): Promise<Db | undefined> => {
  try {
    await client.connect()
    console.log('Conectado a la Base de Datos')

    const db = client.db()
    return db
  } catch (error) {
    console.log('Error al conectar a la Base de Datos')
    return undefined
  }
}

export const dbDisconnect = async (): Promise<void> => {
  await client.close()
  console.log('Desconectado de la Base de Datos')
}
