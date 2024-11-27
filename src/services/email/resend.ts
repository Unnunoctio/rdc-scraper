import { Resend } from 'resend'
import { RESEND_KEY } from '@/config'
import type { Scraper } from '@/scraping/classes'
import { createExcel } from '@/utils/excel'

export const sendEmail = async (products: Scraper[]): Promise<void> => {
  const beersFile = await createExcel(products.filter((p) => p.category === 'Cervezas'), 'not-found-beers')
  const winesFile = await createExcel(products.filter((p) => p.category === 'Vinos'), 'not-found-wines')
  const spiritsFile = await createExcel(products.filter((p) => p.category === 'Destilados'), 'not-found-spirits')
  
  const resend = new Resend(RESEND_KEY)

  try {
    await resend.emails.send({
      from: 'scraping@resend.dev',
      to: 'rincondelcurao@gmail.com',
      subject: 'Scraping not found results',
      html: `<h1>Products not found</h1>`,
      attachments: [
        beersFile,
        winesFile,
        spiritsFile
      ]
    })
    console.log('Email sent')
  } catch (error) {
    console.log('Error sending email')
  }
}