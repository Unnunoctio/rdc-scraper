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
  await Product.updateOne(
    { _id: product._id, 'websites.path': scraped.url },
    {
      $set: {
        'websites.$.price':      scraped.price,
        'websites.$.bestPrice':  scraped.bestPrice,
        'websites.$.lastUpdate': syncToken,
        'websites.$.inStock':    true,
      },
    },
  )
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
