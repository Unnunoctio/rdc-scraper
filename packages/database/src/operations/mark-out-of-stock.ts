import { Product } from '../models/product.model'

export async function markOutOfStock(syncToken: string): Promise<number> {
    const result = await Product.updateMany(
        { websites: { $elemMatch: { lastUpdate: { $ne: syncToken }, inStock: true } } },
        {
            $set: {
                'websites.$[elem].inStock': false,
                'websites.$[elem].price': 0,
                'websites.$[elem].bestPrice': 0,
            },
        },
        { arrayFilters: [{ 'elem.lastUpdate': { $ne: syncToken }, 'elem.inStock': true }] }
    )
    return result.modifiedCount
}
