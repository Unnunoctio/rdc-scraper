import type { PutCommandInput, ScanCommandInput } from '@aws-sdk/lib-dynamodb'
import { DRINK_TABLE } from '../../config'
import type { Scraper } from '../../scraping/classes'
import type { DrinkApi } from '../../types'
import { getDrinksApi } from '../../utils/drinks-api'
import { dynamodb } from './dynamodb'

const saveDrink = async (drink: DrinkApi): Promise<void> => {
  const params: PutCommandInput = {
    TableName: DRINK_TABLE,
    Item: {
      PK: `DRINK#${drink._id}`,
      SK: 'METADATA',
      entity: 'DRINK',
      name: drink.name,
      brand: drink.brand,
      abv: drink.abv,
      volume: drink.volume,
      packaging: drink.packaging,
      category: drink.category,
      subCategory: drink.subCategory,
      origin: drink.origin
    }
  }

  const isSaved = await dynamodb.PutItem(params)

  if (isSaved) await saveDrinkExtra(drink)
}

const saveDrinkExtra = async (drink: DrinkApi): Promise<void> => {
  const params: PutCommandInput = {
    TableName: DRINK_TABLE,
    Item: {
      PK: `DRINK#${drink._id}`,
      SK: 'EXTRA',
      entity: 'DRINK_EXTRA'
    }
  }
  // CERVEZAS
  if (drink.variety !== undefined && params.Item !== undefined) params.Item.variety = drink.variety
  if (drink.ibu !== undefined && params.Item !== undefined) params.Item.ibu = drink.ibu
  if (drink.servingTemp !== undefined && params.Item !== undefined) params.Item.servingTemp = drink.servingTemp
  // VINOS
  if (drink.strain !== undefined && params.Item !== undefined) params.Item.strain = drink.strain
  if (drink.vineyard !== undefined && params.Item !== undefined) params.Item.vineyard = drink.vineyard

  await dynamodb.PutItem(params)
}

const saveDrinksByApi = async (): Promise<void> => {
  const allDrinks = await getDrinksApi()

  await Promise.all(allDrinks.map(async drink => await saveDrink(drink)))
}

const matchDrink = (productTitle: string, drinks: Array<{ PK: string, name: string }>): { PK: string, name: string } => {
  let selected: any | undefined
  let matching = -1

  const titleSplit = productTitle.toLowerCase().split(' ').filter(w => w !== '')
  for (const drink of drinks) {
    const nameSplit = drink.name.toLowerCase().split(' ').filter(w => w !== '')
    const isMatching = nameSplit.every(w => titleSplit.includes(w))

    if (isMatching && (nameSplit.length > matching)) {
      matching = nameSplit.length
      selected = drink
    }
  }

  return selected
}

const findDrink = async (product: Scraper): Promise<{ PK: string, name: string } | undefined> => {
  const params: ScanCommandInput = {
    TableName: DRINK_TABLE,
    FilterExpression: 'begins_with(PK, :pk) AND SK = :metadata AND entity = :entity AND brand = :brand AND abv = :abv AND volume = :volume AND packaging = :packaging',
    ExpressionAttributeValues: {
      ':pk': 'DRINK#',
      ':metadata': 'METADATA',
      ':entity': 'DRINK',
      ':brand': product.brand,
      ':abv': product.alcoholicGrade,
      ':volume': product.content,
      ':packaging': product.package
    },
    ProjectionExpression: 'PK, #name',
    ExpressionAttributeNames: {
      '#name': 'name'
    }
  }

  const drinks: Array<{ PK: string, name: string }> | undefined = await dynamodb.scanItems(params)

  if (drinks === undefined || drinks.length === 0) return undefined
  return matchDrink(product.title ?? '', drinks)
}

export const drinkTable = {
  saveDrinksByApi,
  findDrink
}
