import Excel from 'exceljs'
// import nodemailer from 'nodemailer'
import { Scraper } from '../types'
import { Resend } from 'resend'

export const sendEmail = async (notFound: Scraper[]): Promise<void> => {
  // Crear Excel
  const filename = 'Not-Found-Products.xlsx'
  const workbook = new Excel.Workbook()
  const worksheet = workbook.addWorksheet('products')

  worksheet.columns = [
    { header: 'Website', key: 'website' },
    { header: 'Title', key: 'title' },
    { header: 'Brand', key: 'brand' },
    { header: 'Category', key: 'category' },
    { header: 'Url', key: 'url' },
    { header: 'Grade', key: 'alcoholic_grade' },
    { header: 'Content', key: 'content' },
    { header: 'Quantity', key: 'quantity' },
    { header: 'Package', key: 'package' }
  ]
  notFound.forEach(p => {
    worksheet.addRow(p)
  })
  const buffer = await workbook.xlsx.writeBuffer()

  // Crear email
  const resend = new Resend(process.env.RESEND_API_KEY)

  resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'rincondelcurao@gmail.com',
    subject: 'Products Not Found',
    html: 'Products Not Found',
    attachments: [
      {
        filename,
        content: buffer as Buffer
      }
    ]
  })
    .then(() => console.log('Email sent'))
    .catch(err => console.error(err))
}
