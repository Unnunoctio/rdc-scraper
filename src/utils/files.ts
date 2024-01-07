import { ExcelFile, Scraper } from '../types'
import Excel from 'exceljs'

export const createExcel = async (products: Scraper[], title: string): Promise<ExcelFile> => {
  // Crear Excel
  const filename = `${title}.xlsx`
  const workbook = new Excel.Workbook()

  const productsByBrand = products.reduce((acc, product) => {
    const brand = product.brand.toLowerCase().replaceAll('/', '-')
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (!(acc[brand])) acc[brand] = []
    acc[brand].push(product)
    return acc
  }, {})

  Object.keys(productsByBrand).forEach((brand) => {
    const worksheet = workbook.addWorksheet(brand)
    worksheet.columns = [
      { header: 'Website', key: 'website' },
      { header: 'Title', key: 'title' },
      { header: 'Brand', key: 'brand' },
      { header: 'Url', key: 'url' },
      { header: 'Grade', key: 'alcoholic_grade' },
      { header: 'Content', key: 'content' },
      { header: 'Quantity', key: 'quantity' },
      { header: 'Package', key: 'package' }
    ]

    productsByBrand[brand].forEach(p => {
      worksheet.addRow(p)
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()

  return { filename, content: buffer as Buffer }
}
