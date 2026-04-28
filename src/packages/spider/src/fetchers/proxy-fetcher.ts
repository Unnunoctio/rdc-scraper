import type { IFetcher, IFetchOptions } from '../types'
import { getUserAgent } from '../utils/user-agent'

export class ProxyFetcher implements IFetcher {
    constructor(
        private readonly proxyEndpoint: string,
        private readonly apiKey: string
    ) {}

    async fetch(url: string, options: IFetchOptions = {}, retry = true): Promise<unknown> {
        const { method = 'GET', headers = {}, body } = options
        try {
            const res = await fetch(this.proxyEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                },
                body: JSON.stringify({
                    url,
                    method,
                    headers: { ...headers, 'Content-Type': 'application/json', 'User-Agent': getUserAgent() },
                    body,
                }),
            })
            if (!res.ok) {
                throw new Error(`[ProxyFetcher] HTTP ${res.status}: ${url}`)
            }

            const json = (await res.json()) as { data?: unknown }
            return json.data ?? null
        } catch (e) {
            if (retry) {
                await new Promise((resolve) => setTimeout(resolve, 15000)) // 15 seconds
                return await this.fetch(url, options, false)
            }

            console.error(`[ProxyFetcher] Error fetching ${url}:`, e)
            return null
        }
    }
}
