import PriceLogModel from '../db/price-log-model'

const savePriceLog = async (price: number): Promise<string | undefined> => {
  try {
    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)

    const newLog = await PriceLogModel.create({ date: currentDate, price })
    return newLog._id
  } catch (error) {
    console.error('Error saving price log:', error)
    return undefined
  }
}

const saveOrUpdatePriceLog = async (lastLogId: string, price: number): Promise<string | undefined> => {
  try {
    const log = await PriceLogModel.findById(lastLogId)
    if (log === null) return undefined

    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)

    if (currentDate.toISOString().split('T')[0] === log.date.toISOString().split('T')[0]) {
      await PriceLogModel.findByIdAndUpdate(lastLogId, { price })
      return undefined
    }

    const newLog = await PriceLogModel.create({ date: currentDate, price })
    return newLog._id
  } catch (error) {
    console.error('Error saving or updating price log:', error)
    return undefined
  }
}

export const priceLogService = {
  savePriceLog,
  saveOrUpdatePriceLog
}
