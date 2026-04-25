import type { ScrapedProduct } from '@rdc/spider'
import type { Types } from 'mongoose'
import { Info } from '../models/info.model'
import { PriceLog } from '../models/price-log.model'
import type { IDrink } from '../models/product.model'
import { Product } from '../models/product.model'

// Module-level cache — survives Lambda container reuse
const infoCache = new Map<string, Types.ObjectId>()

export async function getInfoId(source: string): Promise<Types.ObjectId | null> {
    if (infoCache.has(source)) return infoCache.get(source)!
    const info = await Info.findOne({ code: source }, { _id: 1 })
    if (!info) return null
    infoCache.set(source, info._id as Types.ObjectId)
    return info._id as Types.ObjectId
}

export async function findProductByDrink(drink: IDrink, quantity: number) {
    return Product.findOne({
        'drink.id': drink.id,
        'drink.volume': drink.volume,
        'drink.packaging': drink.packaging,
        quantity,
    })
}

export async function uniqueSku(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    while (true) {
        const sku = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
        const exists = await Product.exists({ sku })
        if (!exists) return sku
    }
}

export async function addWebsite(productId: Types.ObjectId, infoId: Types.ObjectId, scraped: ScrapedProduct, syncToken: string): Promise<void> {
    await Product.updateOne(
        { _id: productId },
        {
            $push: {
                websites: {
                    info: infoId,
                    path: scraped.url,
                    price: scraped.price,
                    bestPrice: scraped.bestPrice,
                    lastUpdate: syncToken,
                    inStock: true,
                },
            },
        }
    )
    await upsertPriceLogToday(productId, scraped.url, scraped.price, scraped.bestPrice)
}

export async function createProduct(params: {
    sku: string
    name: string
    slug: string
    quantity: number
    category: string
    drink: IDrink
    imageUrl: string | null
    infoId: Types.ObjectId
    scraped: ScrapedProduct
    syncToken: string
}): Promise<void> {
    const { sku, name, slug, quantity, category, drink, imageUrl, infoId, scraped, syncToken } = params
    const product = await Product.create({
        sku,
        slug,
        name,
        quantity,
        category,
        drink,
        images: imageUrl ? [imageUrl] : [],
        websites: [
            {
                info: infoId,
                path: scraped.url,
                price: scraped.price,
                bestPrice: scraped.bestPrice,
                lastUpdate: syncToken,
                inStock: true,
            },
        ],
    })
    await upsertPriceLogToday(product._id as Types.ObjectId, scraped.url, scraped.price, scraped.bestPrice)
}

async function upsertPriceLogToday(productId: Types.ObjectId, websitePath: string, price: number, bestPrice: number) {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    await PriceLog.updateOne({ productId, websitePath, date: today }, { $set: { price, bestPrice } }, { upsert: true })
}
