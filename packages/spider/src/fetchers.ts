export interface IFetcher {
    get(url: string, options?: RequestInit): Promise<unknown>
}

export class JsonFetcher implements IFetcher {
    constructor(private headers: Record<string, string> = {}) {}

    async get(url: string, options?: RequestInit): Promise<unknown> {
        const response = await fetch(url, {
            ...options,
            headers: { ...this.headers, ...options?.headers },
        })
        if (!response.ok) return null
        return response.json()
    }

    async post(url: string, body: unknown, options?: RequestInit): Promise<unknown> {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...this.headers,
                ...(options?.headers as Record<string, string> | undefined),
            },
        })
        if (!response.ok) return null
        return response.json()
    }
}

export class HtmlFetcher implements IFetcher {
    constructor(private headers: Record<string, string> = {}) {}

    async get(url: string, options?: RequestInit): Promise<unknown> {
        const response = await fetch(url, {
            ...options,
            headers: { ...this.headers, ...options?.headers },
        })
        if (!response.ok) return null
        return response.text()
    }
}
