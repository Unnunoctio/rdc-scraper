import mongoose from 'mongoose'

let connection: typeof mongoose | null = null

export async function getConnection(): Promise<typeof mongoose> {
    if (connection && mongoose.connection.readyState === 1) return connection
    connection = await mongoose.connect(process.env['MONGODB_URI']!, {
        dbName: process.env['MONGODB_DB'],
    })
    return connection
}
