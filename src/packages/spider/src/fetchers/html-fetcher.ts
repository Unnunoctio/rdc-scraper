import type { IFetcher, IFetchOptions } from '../types'

export class HtmlFetcher implements IFetcher {
    async fetch(url: string, options: IFetchOptions = {}, retry = true): Promise<unknown> {
        const { headers = {} } = options
        try {
            const res = await fetch(url, { headers })
            if (!res.ok) {
                throw new Error(`[HtmlFetcher] HTTP ${res.status}: ${url}`)
            }

            return await res.text()
        } catch (e) {
            if (retry) {
                await new Promise((resolve) => setTimeout(resolve, 15000)) // 15 seconds
                return await this.fetch(url, options, false)
            }

            console.error(`[HtmlFetcher] Error fetching ${url}:`, e)
            return null
        }
    }
}
