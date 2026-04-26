import type { IDrink } from '@rdc/database'
import { db } from '@rdc/database'
import type { ScrapedProduct } from '@rdc/spider'
import { uploadImage } from './image-uploader'
import { generateProductName, generateProductSlug } from './utils'

type DrinkResult = IDrink & { [key: string]: unknown }

export const handler = async (event: { matched: Array<{ product: ScrapedProduct; drink: DrinkResult }>; sync_token: string; category: string }) => {
    const { matched, sync_token, category } = event

    await db.connect()

    let added = 0
    let created = 0

    await Promise.all(
        matched.map(async ({ product, drink }) => {
            try {
                const quantity = product.quantity ?? 1
                const infoId = await db.getInfoId(product.source)
                if (!infoId) return

                const existing = await db.findProductByDrink(drink, quantity)

                if (existing) {
                    await db.addWebsite(existing._id, infoId, product, sync_token)
                    added++
                } else {
                    const sku = await db.uniqueSku()
                    const name = generateProductName(drink, category, quantity)
                    const slug = generateProductSlug(sku, name, drink.volume)
                    const imageUrl = product.imageUrl ? await uploadImage(sku, category, product.imageUrl) : null

                    await db.createProduct({
                        sku,
                        name,
                        slug,
                        quantity,
                        category,
                        drink: drink as IDrink,
                        imageUrl,
                        infoId,
                        scraped: product,
                        syncToken: sync_token,
                    })
                    created++
                }
            } catch {
                // continue batch on individual failure
            }
        })
    )

    return { sync_token, added, created }
}
