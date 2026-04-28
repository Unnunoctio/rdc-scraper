export interface IS3SpiderRef {
    s3_key: string
    count: number
}

export interface IBatchRef {
    s3_key: string
    category: string
    count: number
}

export interface IMergeResultsEvent {
    s3_keys: IS3SpiderRef[]
    execution_id: string
}

export type IMergeResultsResult = IBatchRef[]
