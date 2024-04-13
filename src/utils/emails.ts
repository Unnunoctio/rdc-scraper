import { Resend } from 'resend'
import { createExcel } from './files.js'
import { RESEND_KEY } from '../config.js'
import { ScraperClass } from '../classes/ScraperClass.js'

export const sendEmail = async (notFound: ScraperClass[]): Promise<void> => {
  const beersFile = await createExcel(notFound.filter(product => product.category === 'Cervezas'), 'Not-Found-Beers')
  const winesFile = await createExcel(notFound.filter(product => product.category === 'Vinos'), 'Not-Found-Wines')
  const spiritsFile = await createExcel(notFound.filter(product => product.category === 'Destilados'), 'Not-Found-Spirits')

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
    console.log('Email sent')
  } catch (error) {
    console.error('Error al enviar el Email')
  }
}
