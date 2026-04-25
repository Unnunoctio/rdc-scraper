import { getConnection, findProductByDrink, getInfoId, uniqueSku, addWebsite, createProduct } from '@rdc/database'
import type { IDrink } from '@rdc/database'
import type { ScrapedProduct } from '@rdc/spider'
import { generateProductName, generateProductSlug } from './utils'
import { uploadImage } from './image-uploader'

type DrinkResult = IDrink & { [key: string]: unknown }

export const handler = async (event: {
  matched: Array<{ product: ScrapedProduct; drink: DrinkResult }>
  sync_token: string
  category: string
}) => {
  const { matched, sync_token, category } = event

  await getConnection()

  let added = 0
  let created = 0

  await Promise.all(matched.map(async ({ product, drink }) => {
    try {
      const quantity = product.quantity ?? 1
      const infoId = await getInfoId(product.source)
      if (!infoId) return

      const existing = await findProductByDrink(drink, quantity)

      if (existing) {
        await addWebsite(existing._id, infoId, product, sync_token)
        added++
      } else {
        const sku = await uniqueSku()
        const name = generateProductName(drink, category, quantity)
        const slug = generateProductSlug(sku, name, drink.volume)
        const imageUrl = product.imageUrl ? await uploadImage(sku, category, product.imageUrl) : null

        await createProduct({
          sku, name, slug, quantity, category,
          drink: drink as IDrink,
          imageUrl, infoId, scraped: product, syncToken: sync_token,
        })
        created++
      }
    } catch {
      // continue batch on individual failure
    }
  }))

  return { sync_token, added, created }
}
