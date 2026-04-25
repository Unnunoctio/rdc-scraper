const CATEGORY_MAP: Record<string, string> = {
  Cervezas:   'Cerveza',
  Destilados: 'Destilado',
  Vinos:      'Vino',
}

const PACKAGING_MAP_ES: Record<string, string> = {
  Bottle:    'Botella',
  Can:       'Lata',
  Keg:       'Barril',
  Tetrapack: 'Tetrapack',
  Botella:   'Botella',
  Lata:      'Lata',
  Barril:    'Barril',
}

type DrinkData = { name: string; brand: string; abv: number; packaging: string; volume: number }

export function generateProductName(drink: DrinkData, category: string, quantity: number): string {
  const cat = CATEGORY_MAP[category] ?? category
  const pkg = PACKAGING_MAP_ES[drink.packaging] ?? drink.packaging
  const base = `${cat} ${drink.brand} ${drink.name} ${pkg} ${formatAbv(drink.abv)} ${formatVolume(drink.volume)}`
  return quantity > 1 ? `Pack ${quantity} un. ${base}` : base
}

export function formatVolume(volumeMl: number): string {
  if (volumeMl >= 1000 && volumeMl % 1000 === 0) return `${volumeMl / 1000}L`
  return `${volumeMl}ml`
}

export function formatAbv(abv: number): string {
  return `${abv}°`
}

export function generateProductSlug(sku: string, name: string, volumeMl: number): string {
  return `${sku.toLowerCase()}-${slugify(name)}-${volumeMl}`
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
