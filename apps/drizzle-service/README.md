<div align="center">
  <img src="https://raw.githubusercontent.com/drizzle-team/drizzle-orm/ac1dcd9d1c4b8f171479af4a5dd731db1e164f58/misc/readme/logo-github-sq-dark.svg" alt="Drizzle Service Logo" width="200" />
  <img src="https://raw.githubusercontent.com/drizzle-team/drizzle-orm/ac1dcd9d1c4b8f171479af4a5dd731db1e164f58/misc/readme/logo-github-sq-light.svg" alt="Drizzle Service Logo" width="200" />
</div>

<br />

# Drizzle Service

A powerful, type-safe service layer library for [Drizzle ORM](https://orm.drizzle.team/) that provides advanced CRUD operations, pagination, soft deletes, relations, and bulk operations for **PostgreSQL** and **SQLite**.


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- 🛡️ **Type-Safe**: Full TypeScript support with inferred types from your Drizzle schemas
- 🗄️ **Multi-Database**: Supports both PostgreSQL and SQLite with database-specific optimizations
- 📄 **Pagination**: Built-in offset-based and cursor-based pagination
- 🔗 **Relations**: Advanced join operations (left, inner, right joins)
- 🗑️ **Soft Deletes**: Configurable soft delete functionality with custom fields
- ⚡ **Bulk Operations**: Efficient bulk create, update, and delete operations
- 🪝 **Lifecycle Hooks**: Before/after action hooks for all mutation operations
- 🏢 **Multi-Tenant**: Workspace-based filtering for multi-tenant applications
- 🔧 **Extensible**: Override and extend default service methods
- 🎯 **Error Handling**: Consistent error handling with success/error patterns
- 🚀 **Performance**: Optimized queries with caching support

## 📦 Installation

```bash
# npm
npm install drizzle-service

# pnpm
pnpm add drizzle-service

# bun
bun add drizzle-service
```

**Peer Dependencies:**
```bash
npm install drizzle-orm typescript
```

## 🚀 Quick Start

### 1. Define Your Schema

```typescript
// schema.ts
import { pgTable, serial, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const statusEnum = pgEnum('status', ['active', 'inactive', 'deleted'])

export const users = pgTable('users', (t) => ({
  id: t.serial('id').primaryKey(),
  email: t.text('email').notNull().unique(),
  name: t.text('name').notNull(),
  status: statusEnum('status').default('active').notNull(),
  createdAt: t.timestamp('created_at').notNull().$defaultFn(() => new Date()),
  updatedAt: t.timestamp('updated_at').notNull().$defaultFn(() => new Date()),
}))
```

### 2. Setup Database Connection

#### PostgreSQL
```typescript
// db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { drizzleService } from 'drizzle-service/pg'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle({ client, schema })

// Create service factory
const service = drizzleService(db)

// Create user service with configuration
export const userService = service(schema.users, {
  defaultLimit: 50,
  maxLimit: 500,
  soft: { 
    field: 'status', 
    deletedValue: 'deleted',
    notDeletedValue: 'active' 
  }
})
```

#### SQLite
```typescript
// db.ts
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { drizzleService } from 'drizzle-service/sqlite'
import Database from 'better-sqlite3'
import * as schema from './schema'

const sqlite = new Database('sqlite.db')
const db = drizzle({ client: sqlite, schema })

// Create service factory
const service = drizzleService(db)

// Create user service
export const userService = service(schema.users, {
  defaultLimit: 50,
  maxLimit: 500,
})

### 3. Use the Service

// main.ts
import { userService } from './db'

async function main() {
  // Create a user
  const [error, user] = await userService.create({
    email: 'john@example.com',
    name: 'John Doe'
  })
  
  if (error) throw error
  console.log('Created user:', user)

  // Find users with pagination
  const users = await userService.findAll({
    page: 1,
    limit: 10,
    orderBy: { createdAt: 'desc' }
  })

  // Find by criteria
  const activeUsers = await userService.findBy({
    status: 'active'
  }, {
    orderBy: { name: 'asc' },
    limit: 20
  })

  // Bulk operations
  const [bulkError, newUsers] = await userService.bulkCreate([
    { email: 'alice@example.com', name: 'Alice Smith' },
    { email: 'bob@example.com', name: 'Bob Johnson' }
  ])

  if (bulkError) throw bulkError
  console.log('Created users:', newUsers)
}
```

## 📚 API Reference

### Query Operations

#### `findAll(options?)`
Retrieves all records with optional filtering, pagination, and relations.

```typescript
const users = await userService.findAll({
  page: 1,
  limit: 20,
  orderBy: { createdAt: 'desc' },
  where: { status: 'active' }
})
```

#### `findById(id, options?)`
Finds a single record by primary key.

```typescript
const user = await userService.findById(1)
```

#### `findBy(criteria, options?)`
Finds records matching specific criteria.

```typescript
const activeUsers = await userService.findBy(
  { status: 'active' },
  { limit: 10, orderBy: { name: 'asc' } }
)
```

#### `findByField(field, value, options?)`
Finds records by a specific field and its value.

```typescript
const usersByStatus = await userService.findByField('status', 'active', {
  limit: 10,
  orderBy: { name: 'asc' }
})
```

#### `findByMatching(criteria, options?)`
Finds records that exactly match the specified criteria.

```typescript
const exactMatches = await userService.findByMatching(
  { status: 'active', name: 'John Doe' },
  { limit: 5 }
)
```

#### `findWithCursor(options)`
Performs cursor-based pagination for efficient large dataset navigation.

```typescript
const paginatedResult = await userService.findWithCursor({
  limit: 20,
  cursor: new Date('2023-01-01'),
  orderBy: { createdAt: 'desc' }
})

console.log(paginatedResult.items)
console.log(paginatedResult.nextCursor)
console.log(paginatedResult.pagination)
```

#### `count(where?)`
Counts records matching optional criteria.

```typescript
const activeUserCount = await userService.count({ status: 'active' })
```

### Mutation Operations

#### `create(data, hooks?)`
Creates a new entity with optional lifecycle hooks.

```typescript
const [error, user] = await userService.create({
  email: 'user@example.com',
  name: 'New User'
}, {
  beforeAction: async (data) => {
    console.log('Before creating:', data)
  },
  afterAction: async (result) => {
    console.log('User created:', result.id)
  }
})

if (error) {
  console.error('Creation failed:', error)
} else {
  console.log('Created user:', user)
}
```

#### `update(id, data, hooks?)`
Updates an existing entity.

```typescript
const [error, user] = await userService.update(1, {
  name: 'Updated Name'
})

if (error) {
  console.error('Update failed:', error)
} else {
  console.log('Updated user:', user)
}
```

#### `delete(id, hooks?)`
Deletes an entity (soft delete if configured).

```typescript
const result = await userService.delete(1)
console.log('Delete result:', result.success, result.message)
```

#### `hardDelete(id, hooks?)`
Permanently removes an entity from the database.

```typescript
const result = await userService.hardDelete(1)
console.log('Hard delete result:', result.success, result.message)
```

#### `restore(id, hooks?)`
Restores a soft-deleted entity.

```typescript
const result = await userService.restore(1)
console.log('Restore result:', result.success, result.message)
```

### Bulk Operations

#### `bulkCreate(data[], hooks?)`
Creates multiple entities in a single transaction.

```typescript
const [error, users] = await userService.bulkCreate([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' }
])

if (error) {
  console.error('Bulk create failed:', error)
} else {
  console.log('Created users:', users)
}
```

#### `bulkUpdate(updates[], hooks?)`
Updates multiple records with different data for each.

```typescript
const [error, updatedUsers] = await userService.bulkUpdate([
  { id: 1, changes: { name: 'Updated Name 1' } },
  { id: 2, changes: { name: 'Updated Name 2' } }
])
```

#### `bulkDelete(ids[], hooks?)`
Deletes multiple records by their IDs.

```typescript
const result = await userService.bulkDelete([1, 2, 3])
console.log('Bulk delete result:', result.success, result.message)
```

#### `bulkHardDelete(ids[], hooks?)`
Permanently removes multiple records from the database.

```typescript
const result = await userService.bulkHardDelete([1, 2, 3])
console.log('Bulk hard delete result:', result.success, result.message)
```

## ⚙️ Configuration

### Service Options

```typescript
interface ServiceOptions<T extends BaseEntity> {
  defaultLimit?: number      // Default pagination limit (default: 100)
  maxLimit?: number         // Maximum allowed limit (default: 1000)
  id?: keyof T['$inferSelect'] // Custom ID field (default: 'id')
  soft?: {                  // Soft delete configuration
    field: keyof T['$inferSelect']     // Field to mark as deleted
    deletedValue: T['$inferSelect'][keyof T['$inferSelect']]      // Value indicating deleted state
    notDeletedValue?: T['$inferSelect'][keyof T['$inferSelect']]  // Value indicating active state
  }
  caching?: {               // Optional caching configuration
    get?: <K, V>(key: K) => V | null
    set?: <K, V>(key: K, value: V, ttl?: number) => void
    clear?: () => void
    delete?: <K>(key: K) => void
  }
  override?: (baseMethods: ServiceMethods<T>) => Partial<ServiceMethods<T>>
}
```

### Lifecycle Hooks

```typescript
interface ServiceHooks<T extends BaseEntity> {
  beforeAction?: (data: T['$inferSelect']) => Promise<void>
  afterAction?: (data: T['$inferSelect']) => Promise<void>
  onError?: (error: Error) => Promise<void>
}
```

## 🎯 Why Drizzle Service?

While Drizzle ORM is powerful and flexible, it can require significant boilerplate for common operations. Drizzle Service eliminates this repetition while maintaining type safety.

### Before (Plain Drizzle)
```typescript
// Manual pagination and error handling
const page = 1
const limit = 20
const offset = (page - 1) * limit
try {
  const users = await db
    .select()
    .from(userTable)
    .where(ne(userTable.status, 'deleted'))
    .limit(limit)
    .offset(offset)
    .orderBy(desc(userTable.createdAt))
    
  const total = await db
    .select({ count: count() })
    .from(userTable)
    .where(ne(userTable.status, 'deleted'))
    
  // Manual result formatting and error handling...
} catch (error) {
  // Manual error handling...
}
```

### After (Drizzle Service)
```typescript
// Clean, declarative API with built-in pagination and error handling
const users = await userService.findAll({
  page: 1,
  limit: 20,
  orderBy: { createdAt: 'desc' }
})
// Soft-deleted records are automatically excluded
// Error handling is built into the service layer
```

## 📖 Documentation

For complete documentation, examples, and advanced usage, visit: [Drizzle Service Documentation](https://drizzle-service-docs.vercel.app/)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on top of the excellent [Drizzle ORM](https://orm.drizzle.team/)
- Inspired by [Saas-Js](https://github.com/saas-js/saas-js) and the need for a consistent, type-safe service layer
- Thanks to all contributors and the TypeScript community

## 📞 Support

- 📧 Email: contact@imrlopez.dev
- 🐛 Issues: [GitHub Issues](https://github.com/ImRLopezAG/drizzle-service/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/ImRLopezAG/drizzle-service/discussions)

---

Made with ❤️ by [Angel Lopez](https://github.com/ImRLopezAG)