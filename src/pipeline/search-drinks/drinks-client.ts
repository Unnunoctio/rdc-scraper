const CATEGORY_MAP: Record<string, string> = {
    Cervezas: 'beers',
    Destilados: 'spirits',
    Vinos: 'wines',
}

const PACKAGING_MAP: Record<string, string> = {
    Botella: 'Bottle',
    Lata: 'Can',
    Barril: 'Barrel',
    Tetrapack: 'Tetrapack',
    Growler: 'Growler',
}

export type DrinkResult = {
    id: string
    name: string
    brand: string
    abv: number
    packaging: string
    volume: number
    [key: string]: unknown
}

export async function searchDrinks(product: {
    brand: string
    volumeMl: number
    abv: number
    packaging: string
    category: string
}): Promise<DrinkResult[]> {
    const apiCategory = CATEGORY_MAP[product.category]
    if (!apiCategory) return []

    const packaging = PACKAGING_MAP[product.packaging] ?? product.packaging
    const params = new URLSearchParams({
        brand: product.brand,
        minAbv: String(product.abv),
        maxAbv: String(product.abv),
        packaging,
        minVolume: String(product.volumeMl),
        maxVolume: String(product.volumeMl),
    })

    const baseUrl = process.env['DRINKS_API_URL']!.replace(/\/?$/, '/')
    const url = `${baseUrl}${apiCategory}?${params}`
    const response = await fetch(url, {
        headers: { 'X-Internal-Key': process.env['DRINKS_API_KEY']! },
    })

    if (!response.ok) return []
    return response.json() as Promise<DrinkResult[]>
}
