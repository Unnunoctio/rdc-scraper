import { Resend } from 'resend'
import { Scraper } from '../types'
import { createExcel } from './files.js'

export const sendEmail = async (notFound: Scraper[]): Promise<void> => {
  const beersFile = await createExcel(notFound.filter(product => product.category === 'Cervezas'), 'Not-Found-Beers')
  const winesFile = await createExcel(notFound.filter(product => product.category === 'Vinos'), 'Not-Found-Wines')
  const spiritsFile = await createExcel(notFound.filter(product => product.category === 'Destilados'), 'Not-Found-Spirits')

  // Crear email
  const resend = new Resend(process.env.RESEND_API_KEY)

  resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'rincondelcurao@gmail.com',
    subject: 'Products Not Found',
    html: 'Products Not Found',
    attachments: [
      beersFile,
      winesFile,
      spiritsFile
    ]
  })
    .then(() => console.log('Email sent'))
    .catch(err => console.error(err))
}
