import { PROXIES_API } from '../config'
import type { Proxy } from '../types'

export const getProxies = async (): Promise<Proxy[]> => {
  const proxiesUrl = PROXIES_API as string
  const res = await fetch(proxiesUrl)
  const data: { proxies: Proxy[] } = await res.json()
  // console.log(data.proxies)
  return data.proxies.filter(p => p.protocol === 'http')
}

export const getProxy = (proxies: Proxy[]): Proxy | undefined => {
  if (proxies.length === 0) return undefined
  const proxy = proxies[Math.floor(Math.random() * proxies.length)]
  return proxy
}
