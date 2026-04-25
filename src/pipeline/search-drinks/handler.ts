import type { ScrapedProduct } from '@rdc/spider'
import { isComplete } from '@rdc/spider'
import type { DrinkResult } from './drinks-client'
import { searchDrinks } from './drinks-client'

function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

function bestMatch(drinks: DrinkResult[], productName: string): DrinkResult | null {
    const normalizedName = normalize(productName)
    const candidates = drinks.filter((drink) =>
        normalize(drink.name)
            .split(/\s+/)
            .every((word) => normalizedName.includes(word))
    )
    if (candidates.length === 0) return null
    return candidates.reduce((best, curr) => (curr.name.length > best.name.length ? curr : best))
}

export const handler = async (event: { remaining: ScrapedProduct[]; sync_token: string; category: string }) => {
    const { remaining, sync_token, category } = event

    const complete: ScrapedProduct[] = []
    const unmatched: ScrapedProduct[] = []
    for (const p of remaining) {
        if (isComplete(p)) complete.push(p)
        else unmatched.push(p)
    }
    const matched: Array<{ product: ScrapedProduct; drink: DrinkResult }> = []

    await Promise.all(
        complete.map(async (product) => {
            const drinks = await searchDrinks({
                brand: product.brand!,
                volumeMl: product.volumeMl!,
                abv: product.abv!,
                packaging: product.packaging!,
                category,
            })
            const drink = bestMatch(drinks, product.name)
            if (drink) {
                matched.push({ product, drink })
            } else {
                unmatched.push(product)
            }
        })
    )

    return { matched, unmatched, sync_token, category }
}
