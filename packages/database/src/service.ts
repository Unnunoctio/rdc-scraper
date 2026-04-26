import mongoose from 'mongoose'
import type { Types } from 'mongoose'
import type { ScrapedProduct } from '@rdc/spider'
import { Info } from './models/info.model'
import { PriceLog } from './models/price-log.model'
import type { IDrink, IProduct } from './models/product.model'
import { Product } from './models/product.model'

export class DatabaseService {
    private connection: typeof mongoose | null = null
    private infoCache: Map<string, Types.ObjectId> = new Map()

    async connect(): Promise<void> {
        if (this.connection && mongoose.connection.readyState === 1) return
        this.connection = await mongoose.connect(process.env['MONGODB_URI']!, {
            dbName: process.env['MONGODB_DB'],
        })
    }

    async upsertInfo(info: { code: string; name: string; logo: string; url: string }): Promise<void> {
        await Info.updateOne({ code: info.code }, { $set: info }, { upsert: true })
    }

    async getInfoId(source: string): Promise<Types.ObjectId | null> {
        if (this.infoCache.has(source)) return this.infoCache.get(source)!
        const info = await Info.findOne({ code: source }, { _id: 1 })
        if (!info) return null
        this.infoCache.set(source, info._id as Types.ObjectId)
        return info._id as Types.ObjectId
    }

    async findProductByUrl(url: string): Promise<IProduct | null> {
        return Product.findOne({ 'websites.path': url })
    }

    async findProductByDrink(drink: IDrink, quantity: number): Promise<IProduct | null> {
        return Product.findOne({
            'drink.id': drink.id,
            'drink.volume': drink.volume,
            'drink.packaging': drink.packaging,
            quantity,
        })
    }

    async updatePriceIfChanged(
        product: IProduct,
        scraped: ScrapedProduct,
        syncToken: string
    ): Promise<void> {
        const website = product.websites.find((w) => w.path === scraped.url)
        const priceChanged = !website || website.price !== scraped.price || website.bestPrice !== scraped.bestPrice

        const $set: Record<string, unknown> = {
            'websites.$.lastUpdate': syncToken,
            'websites.$.inStock': true,
        }
        if (priceChanged) {
            $set['websites.$.price'] = scraped.price
            $set['websites.$.bestPrice'] = scraped.bestPrice
        }

        await Product.updateOne({ _id: product._id, 'websites.path': scraped.url }, { $set })
        await this.upsertPriceLogToday(product._id as Types.ObjectId, scraped.url, scraped.price, scraped.bestPrice)
    }

    async uniqueSku(): Promise<string> {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        while (true) {
            const sku = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
            const exists = await Product.exists({ sku })
            if (!exists) return sku
        }
    }

    async addWebsite(
        productId: Types.ObjectId,
        infoId: Types.ObjectId,
        scraped: ScrapedProduct,
        syncToken: string
    ): Promise<void> {
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
        await this.upsertPriceLogToday(productId, scraped.url, scraped.price, scraped.bestPrice)
    }

    async createProduct(params: {
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
        await this.upsertPriceLogToday(product._id as Types.ObjectId, scraped.url, scraped.price, scraped.bestPrice)
    }

    async markOutOfStock(syncToken: string): Promise<number> {
        const result = await Product.updateMany(
            { websites: { $elemMatch: { lastUpdate: { $ne: syncToken }, inStock: true } } },
            {
                $set: {
                    'websites.$[elem].inStock': false,
                    'websites.$[elem].price': 0,
                    'websites.$[elem].bestPrice': 0,
                },
            },
            { arrayFilters: [{ 'elem.lastUpdate': { $ne: syncToken }, 'elem.inStock': true }] }
        )
        return result.modifiedCount
    }

    private async upsertPriceLogToday(
        productId: Types.ObjectId,
        websitePath: string,
        price: number,
        bestPrice: number
    ): Promise<void> {
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        await PriceLog.updateOne({ productId, websitePath, date: today }, { $set: { price, bestPrice } }, { upsert: true })
    }
}

export const db = new DatabaseService()
