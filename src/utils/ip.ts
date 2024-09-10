/* eslint-disable @typescript-eslint/restrict-template-expressions */

export const viewPublicIPInfo = async (): Promise<void> => {
  try {
    const res = await fetch('https://ipapi.co/json/')
    const data = await res.json()

    console.log(`Información de IP pública:
      IP: ${data.ip},
      Ciudad: ${data.city},
      Región: ${data.region},
      País: ${data.country_name},
      Latitud: ${data.latitude},
      Longitud: ${data.longitude},
      Zona Horaria: ${data.timezone},
      ISP: ${data.org}
    `)
  } catch (error) {
    console.error('Error al obtener la información de IP pública:', error)
  }
}
