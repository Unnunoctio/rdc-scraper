import { Schema, model } from 'mongoose'

const infoSchema = new Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    logo: { type: String, required: true },
    url: { type: String, required: true, unique: true },
})

export type IInfo = {
    code: string
    name: string
    logo: string
    url: string
}

export const Info = model('Info', infoSchema, 'infos')
