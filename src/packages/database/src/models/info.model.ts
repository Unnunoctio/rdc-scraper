import { Schema, model } from 'mongoose'
import type { IInfo } from '../types'

const infoSchema = new Schema<IInfo>(
    {
        code: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        logo: { type: String, required: true },
        url: { type: String, required: true },
    },
    {
        versionKey: false,
    }
)

export const Info = model<IInfo>('Info', infoSchema, 'infos')
