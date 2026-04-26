export interface ISpiderConfig {
    lambda_name: string
    config: Record<string, unknown>
}

export interface ILoadConfigsResult {
    spiders: ISpiderConfig[]
    error?: string
}
