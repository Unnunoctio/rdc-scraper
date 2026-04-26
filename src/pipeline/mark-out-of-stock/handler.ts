import { db } from '@rdc/database'

export const handler = async (event: { sync_token: string }) => {
    await db.connect()
    const count = await db.markOutOfStock(event.sync_token)
    return { marked_out_of_stock: count }
}
