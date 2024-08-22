import InfoModel from '../db/info-model'
import type { Info } from '../types'

const findInfo = async (info: Info): Promise<String | undefined> => {
  try {
    const infoDB = await InfoModel.findOne({ name: info.name }).lean().exec()
    if (infoDB !== null) return infoDB._id

    const newInfo = await InfoModel.create(info)
    return newInfo._id
  } catch (error) {
    console.error('Error getting/creating info:', error)
    return undefined
  }
}

export const infoService = {
  findInfo
}
