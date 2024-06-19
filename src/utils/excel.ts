import { Workbook } from 'exceljs'
import type { Scraper } from '../classes'
import type { ExcelFile } from '../types'

export const createExcel = async (products: Scraper[], title: string): Promise<ExcelFile> => {
  // TODO: Create Excel
  const filename = `${title}.xlsx`
  const workbook = new Workbook()

  const productsByBrand = Object.groupBy(products, ({ brand }) => brand?.toLowerCase().replaceAll('/', '-') as string)

  Object.keys(productsByBrand).forEach((brand) => {
    const worksheet = workbook.addWorksheet(brand)
    worksheet.columns = [
      { header: 'Website', key: 'website' },
      { header: 'Title', key: 'title' },
      { header: 'Brand', key: 'brand' },
      { header: 'Grade', key: 'alcoholicGrade' },
      { header: 'Content', key: 'content' },
      { header: 'Quantity', key: 'quantity' },
      { header: 'Package', key: 'package' },
      { header: 'Url', key: 'url' }
    ]

    productsByBrand[brand]?.forEach(p => {
      worksheet.addRow(p)
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return { filename, content: buffer as unknown as Buffer }
}
