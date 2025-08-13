import { eq, or, and } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { itemService, schema, salesService } from './repository'
import { populate, setupBeforeAll, setup } from './setup'

setupBeforeAll()

describe('PG Service: Query Operations (Advanced)', () => {
  beforeAll(async () => {
    await populate(10)
  })

  it('should find records with pagination', async () => {
    const page1 = await itemService.find({ page: 1, limit: 5 })
    const page2 = await itemService.find({ page: 2, limit: 5 })

    expect(page1).toHaveLength(5)
    expect(page2).toHaveLength(5)

    // Page 1 and page 2 should contain different records
    const page1Ids = page1.map((item) => item.id)
    const page2Ids = page2.map((item) => item.id)

    // No overlapping IDs between pages
    const overlapping = page1Ids.filter((id) => page2Ids.includes(id))
    expect(overlapping).toHaveLength(0)
  })

  it('should respect the maximum limit', async () => {
    const items = await itemService.find({ limit: 100 })
    expect(items.length).toBe(100)
  })

  it('should order results by a single field ascending', async () => {
    const items = await itemService.find({
      orderBy: { name: 'asc' }
    })

    expect(items).toEqual(
      items.sort((a, b) => a.name.localeCompare(b.name))
    )
  })
  it('should order results by a single field descending', async () => {
    const items = await itemService.find({
      orderBy: { name: 'desc' }
    })

    expect(items).toEqual(
      items.sort((a, b) => b.name.localeCompare(a.name))
    )
  })
  it('should order results by multiple fields', async () => {
    const items = await itemService.find({
      orderBy: {
        description: 'asc',
        name: 'desc'
      }
    })

    expect(items).toEqual(
      items.sort((a, b) => {
        const descriptionComparison = a.description.localeCompare(b.description)
        if (descriptionComparison !== 0) return descriptionComparison
        return b.name.localeCompare(a.name)
      })
    )
  })

  it('should filter and order results correctly', async () => {
    const items = await itemService.findBy({
      status: 'ACTIVE',
    }, {
      orderBy: { name: 'desc' }
    })
    expect(items).toEqual(
      items.sort((a, b) => b.name.localeCompare(a.name))
    )
    expect(items.every((item) => item.status === 'ACTIVE')).toBe(true)
  })

  it('should find records with relations', async () => {
    const sales = await salesService.findBy({},{
      relations: [{
        table: schema.salesLines,
        on: eq(schema.salesLines.documentNo, schema.salesHeaders.id),
        type: 'left'
      }]
    })
    expect(sales).toBeInstanceOf(Array)
    for (const sale of sales) {
      expect(sale).toHaveProperty('sales_headers')
      expect(sale).toHaveProperty('sales_lines')
    }
  })

  it('should parse result of query', async () => {
    const sales = await salesService.find({
      parse(data) {
          return data.map(({documentNo, documentType}) => ({
            documentNo,
            type: documentType,
          }))
      },
    })
    expect(sales).toBeInstanceOf(Array)
    expect(sales.every(sale => sale.documentNo && sale.type)).toBe(true)
  })

    it('should find with custom query', async () => {
      const sales = await salesService.find({
        where: and(
          eq(schema.salesHeaders.storeId, setup.storesId[0] ?? 1),
          or(
            eq(schema.salesHeaders.status, 'COMPLETED'),
            eq(schema.salesHeaders.status, 'DRAFT'),
          ),
        ),
      })
      expect(sales).toBeInstanceOf(Array)
      expect(sales.every((sale) => sale.storeId === setup.storesId[0])).toBe(true)
      expect(
        sales.every((sale) => ['COMPLETED', 'DRAFT'].includes(sale.status)),
      ).toBe(true)
    })

})