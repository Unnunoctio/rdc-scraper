import type { Types } from 'mongoose'
import { Product } from '../models/product.model'
import { PriceLog } from '../models/price-log.model'
import type { ScrapedProduct } from '@rdc/spider'

export async function findProductByUrl(url: string) {
  return Product.findOne({ 'websites.path': url })
}

export async function updatePriceIfChanged(
  product: NonNullable<Awaited<ReturnType<typeof findProductByUrl>>>,
  scraped: ScrapedProduct,
  syncToken: string,
): Promise<void> {
  const website = product.websites.find(w => w.path === scraped.url)
  const priceChanged = !website || website.price !== scraped.price || website.bestPrice !== scraped.bestPrice

  const $set: Record<string, unknown> = {
    'websites.$.lastUpdate': syncToken,
    'websites.$.inStock':    true,
  }
  if (priceChanged) {
    $set['websites.$.price']     = scraped.price
    $set['websites.$.bestPrice'] = scraped.bestPrice
  }

  await Product.updateOne({ _id: product._id, 'websites.path': scraped.url }, { $set })
  await upsertPriceLogToday(product._id as Types.ObjectId, scraped.url, scraped.price, scraped.bestPrice)
}

async function upsertPriceLogToday(
  productId: Types.ObjectId,
  websitePath: string,
  price: number,
  bestPrice: number,
) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  await PriceLog.updateOne(
    { productId, websitePath, date: today },
    { $set: { price, bestPrice } },
    { upsert: true },
  )
}
