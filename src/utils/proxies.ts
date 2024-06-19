import { PROXIES_API } from '../config'
import type { Proxy } from '../types'

export const getProxies = async (): Promise<Proxy[]> => {
  const proxiesUrl = PROXIES_API as string
  const res = await fetch(proxiesUrl)
  const data: { proxies: Proxy[] } = await res.json()
  return data.proxies
}
