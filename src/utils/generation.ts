import { customAlphabet } from 'nanoid'

const ALPHABET_HEX = '0123456789abcdef'
const ALPHABET_DEC = '0123456789'

const nanoUuid = customAlphabet(ALPHABET_HEX, 32)
const nanoSku = customAlphabet(ALPHABET_DEC, 7)

export const generateId = (): string => {
  const id = nanoUuid()
  return `${id.substring(0, 8)}-${id.substring(8, 12)}-${id.substring(12, 16)}-${id.substring(16, 20)}-${id.substring(20)}`
}

export const generateSku = (): string => {
  return nanoSku()
}
