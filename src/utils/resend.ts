import { Resend } from 'resend'
import { RESEND_KEY } from '../config'
import { createExcel } from './excel'
import type { Scraper } from '../classes'

export const sendEmail = async (notFound: Scraper[]): Promise<void> => {
  const beersFile = await createExcel(notFound.filter(p => p.category === 'Cervezas'), 'not-found-beers')
  const winesFile = await createExcel(notFound.filter(p => p.category === 'Vinos'), 'not-found-wines')
  const spiritsFile = await createExcel(notFound.filter(p => p.category === 'Destilados'), 'not-found-spirits')

  // TODO: Create Email
  const resend = new Resend(RESEND_KEY)

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'rincondelcurao@gmail.com',
      subject: 'Scraping not found results',
      html: 'Products not found',
      attachments: [
        beersFile,
        winesFile,
        spiritsFile
      ]
    })
    console.log('Email sent')
  } catch (error) {
    console.error('Error to send email')
  }
}
