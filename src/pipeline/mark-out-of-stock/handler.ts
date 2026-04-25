import { getConnection, markOutOfStock } from '@rdc/database'

export const handler = async (event: { sync_token: string }) => {
    await getConnection()
    const count = await markOutOfStock(event.sync_token)
    return { marked_out_of_stock: count }
}
