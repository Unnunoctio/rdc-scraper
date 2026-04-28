import type { IFetcher, IFetchOptions } from '../types'
import { getUserAgent } from '../utils/user-agent'

export class JsonFetcher implements IFetcher {
    async fetch(url: string, options: IFetchOptions = {}, retry = true): Promise<unknown> {
        const { method = 'GET', headers = {}, body } = options
        try {
            const res = await fetch(url, {
                method,
                headers: { ...headers, 'Content-Type': 'application/json', 'User-Agent': getUserAgent() },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            })
            if (!res.ok) {
                throw new Error(`[JsonFetcher] HTTP ${res.status}: ${url}`)
            }

            return await res.json()
        } catch (e) {
            if (retry) {
                await new Promise((resolve) => setTimeout(resolve, 15000)) // 15 seconds
                return await this.fetch(url, options, false)
            }

            console.error(`[JsonFetcher] Error fetching ${url}: ${JSON.stringify(body)}`, e)
            return null
        }
    }
}
