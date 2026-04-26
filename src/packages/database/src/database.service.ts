import mongoose from 'mongoose'
import { Info } from './models/info.model'
import type { IInfo } from './types'

export class DatabaseService {
    constructor(
        private readonly uri: string,
        private readonly dbName: string
    ) {}

    async connect(): Promise<void> {
        // @ts-ignore - Argument of type '{ dbName: string; }' is not assignable to parameter of type 'ConnectOptions' (Need all properties)
        await mongoose.connect(this.uri, { dbName: this.dbName })
    }

    async disconnect(): Promise<void> {
        await mongoose.disconnect()
    }

    async insertInfoIfNotExists(info: IInfo): Promise<void> {
        const existing = await Info.findOne({ code: info.code })
        if (existing) {
            console.log(`[DB] Info already exists, skipping: ${info.code}`)
            return
        }
        await Info.create(info)
        console.log(`[DB] Info inserted: ${info.code}`)
    }
}
