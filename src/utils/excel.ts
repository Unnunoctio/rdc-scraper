import * as XLSX from 'xlsx'
import type { Scraper } from '@/scraping/classes'
import type { ExcelFile } from '@/types'

export const createExcel = async (products: Scraper[], title: string): Promise<ExcelFile> => {
  const filename = `${title}.xlsx`
  const workbook = XLSX.utils.book_new()

  // TODO: TEMPLATE
  const worksheetTemplate = XLSX.utils.aoa_to_sheet([['website', 'title', 'brand', 'quantity', 'abv', 'volume', 'packaging', 'url']])
  XLSX.utils.book_append_sheet(workbook, worksheetTemplate, 'Template')

  // TODO: BRANDS
  const productsByBrand = Object.groupBy(products, ({ brand }) => brand?.toLowerCase().replaceAll('/', '-') as string)
  Object.keys(productsByBrand).forEach((brand) => {
    const products = productsByBrand[brand]
    if (products === undefined) return

    const worksheet = XLSX.utils.json_to_sheet(products.map((p) => { return { website: p.website, title: p.title, brand: p.brand, quantity: p.quantity, abv: p.alcoholicGrade, volume: p.content, packaging: p.package, url: p.url } }))
    XLSX.utils.book_append_sheet(workbook, worksheet, brand)
  })

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return { filename, content: buffer }
}