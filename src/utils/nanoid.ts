import { customAlphabet } from 'nanoid'

const ALPHABET_HEX = '0123456789abcdef'
const ALPHABET_DEC = '0123456789'

const nanoInfoId = customAlphabet(ALPHABET_HEX, 8)
const nanoProductSku = customAlphabet(ALPHABET_DEC, 8)
const nanoWebsiteId = customAlphabet(ALPHABET_HEX, 16)
const nanoWatcher = customAlphabet(ALPHABET_DEC, 16)

export const generateInfoId = (): string => nanoInfoId()

export const generateProductSku = (): string => nanoProductSku()

export const generateWebsiteId = (): string => nanoWebsiteId()

export const generateWatcher = (): string => nanoWatcher()
