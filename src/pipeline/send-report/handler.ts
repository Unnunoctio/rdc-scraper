import ExcelJS from 'exceljs'
import { Resend } from 'resend'
import type { ScrapedProduct } from '@rdc/spider'

const resend = new Resend(process.env['RESEND_API_KEY'])

export const handler = async (event: {
  results?: Array<{ unmatched?: ScrapedProduct[] }>
  unmatched?: ScrapedProduct[]
}) => {
  const unmatched: ScrapedProduct[] = event.results
    ? event.results.flatMap(r => r.unmatched ?? [])
    : (event.unmatched ?? [])

  if (unmatched.length === 0) return { sent: false, count: 0 }

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Unmatched Products')

  sheet.columns = [
    { header: 'Name',          key: 'name',      width: 40 },
    { header: 'Brand',         key: 'brand',     width: 20 },
    { header: 'Price',         key: 'price',     width: 12 },
    { header: 'Original Price',key: 'bestPrice', width: 14 },
    { header: 'URL',           key: 'url',       width: 60 },
    { header: 'Source',        key: 'source',    width: 12 },
    { header: 'Category',      key: 'category',  width: 14 },
    { header: 'Volume (ml)',   key: 'volumeMl',  width: 12 },
    { header: 'ABV (%)',       key: 'abv',       width: 10 },
    { header: 'Scraped Date',  key: 'date',      width: 14 },
  ]

  const today = new Date().toISOString().split('T')[0]
  for (const p of unmatched) {
    sheet.addRow({ ...p, date: today })
  }

  const buffer = await workbook.xlsx.writeBuffer()

  await resend.emails.send({
    from: process.env['EMAIL_SENDER']!,
    to:   process.env['EMAIL_RECIPIENT']!,
    subject: `RDC Scraper — ${unmatched.length} productos sin match`,
    html: `<p>${unmatched.length} productos no pudieron ser asociados a una bebida.</p>`,
    attachments: [{
      filename: 'unmatched.xlsx',
      content: Buffer.from(buffer).toString('base64'),
    }],
  })

  return { sent: true, count: unmatched.length }
}
