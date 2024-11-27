import { PRODUCT_TABLE } from "@/config"
import { dynamodb } from "@/services/databases/dynamodb"
import type { ScanCommandInput } from "@aws-sdk/lib-dynamodb"

const getDrinkInProducts = async (): Promise<string[]> => {
  const params: ScanCommandInput = {
    TableName: PRODUCT_TABLE,
    FilterExpression: 'begins_with(PK, :pk) AND SK = :metadata AND entity = :entity',
    ExpressionAttributeValues: {
      ':pk': 'PRODUCT#',
      ':metadata': 'METADATA',
      ':entity': 'PRODUCT'
    },
    ProjectionExpression: 'drink'
  }

  const products: Array<{ drink: string }> | undefined = await dynamodb.scanItems(params)

  if (products === undefined || products.length === 0) return []
  return products.map(p => p.drink)
}

export const productTable = {
  getDrinkInProducts
}