import { Resend } from 'resend'
import { RESEND_KEY } from '../config.js'
import { createExcel } from './excel.js'
import { Scraper } from '../classes/Scraper.js'

export const sendEmail = async (notFoundProducts: Scraper[]): Promise<void> => {
  const beersFile = await createExcel(notFoundProducts.filter(product => product.category === 'Cervezas'), 'Not-Found-Beers')
  const winesFile = await createExcel(notFoundProducts.filter(product => product.category === 'Vinos'), 'Not-Found-Wines')
  const spiritsFile = await createExcel(notFoundProducts.filter(product => product.category === 'Destilados'), 'Not-Found-Spirits')

  // Crear email
  const resend = new Resend(RESEND_KEY)

  try {
    await resend.emails.send({
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
    console.log('Email enviado correctamente')
  } catch (error) {
    console.error('Error al enviar el Email')
  }
}
