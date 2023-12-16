import Excel from 'exceljs'
import nodemailer from 'nodemailer'
import { Scraper } from '../types'

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

  // Crear transporte de correo
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      refreshToken: process.env.OAUTH_REFRESH_TOKEN
    }
  })

  // Crear mail options
  const mailOptions = {
    from: process.env.MAIL_USERNAME,
    to: process.env.MAIL_USERNAME,
    subject: 'Products Not Found',
    attachments: [
      {
        filename,
        content: buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    ]
  }

  transporter.sendMail(mailOptions)
    .then(() => console.log('Email sent'))
    .catch(err => console.error(err))
}
