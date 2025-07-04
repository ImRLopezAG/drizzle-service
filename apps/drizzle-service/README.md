# Drizzle Service

A powerful, type-safe repository pattern library for [Drizzle ORM](https://orm.drizzle.team/) that provides advanced CRUD operations, pagination, soft deletes, relations, and bulk operations for **PostgreSQL** and **SQLite**.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=flat&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)

## ✨ Features

- 🛡️ **Type-Safe**: Full TypeScript support with inferred types from your Drizzle schemas
- 🗄️ **Multi-Database**: Supports both PostgreSQL and SQLite with database-specific optimizations
- 📄 **Pagination**: Built-in offset-based and cursor-based pagination
- 🔗 **Relations**: Advanced join operations (left, inner, right joins)
- 🗑️ **Soft Deletes**: Configurable soft delete functionality with custom fields
- ⚡ **Bulk Operations**: Efficient bulk create, update, and delete operations
- 🪝 **Lifecycle Hooks**: Before/after action hooks for all mutation operations
- 🏢 **Multi-Tenant**: Workspace-based filtering for multi-tenant applications
- 🔧 **Extensible**: Override and extend default repository methods
- 🎯 **Error Handling**: Consistent error handling with success/error patterns
- 🚀 **Performance**: Optimized queries with caching support

## 📦 Installation

```bash
npm install drizzle-service
# or
pnpm add drizzle-service
# or
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

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  status: statusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  userId: integer('user_id').references(() => users.id),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### 2. Setup Database Connection

```typescript
// db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { drizzleRepository } from 'drizzle-service/pg'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client, { schema })

// Create repository instance
const repository = drizzleRepository(db)
// Create repositories
export const userRepository = repository(schema.users, {
  defaultLimit: 50,
  maxLimit: 500,
  soft: { field: 'status', deletedValue: 'deleted' }
})

export const postRepository = repository(schema.posts, {
  soft: { field: 'isDeleted', deletedValue: true }
})
```

### 3. Use the Repository

```typescript
// main.ts
import { eq } from 'drizzle-orm'
import { userRepository, postRepository } from './db'
import { users, posts } from './schema'

async function main() {
  // Create a user
  const [error, user] = await userRepository.create({
    email: 'john@example.com',
    name: 'John Doe'
  })
  
  if (error) throw error
  console.log('Created user:', user)

  // Find users with pagination and relations
  const usersWithPosts = await userRepository.findAll({
    relations: [{
      table: posts,
      type: 'left',
      sql: eq(users.id, posts.userId)
    }],
    page: 1,
    limit: 10,
    orderBy: { createdAt: 'desc' }
  })

  // Bulk operations
  const [bulkError, newUsers] = await userRepository.bulkCreate([
    { email: 'alice@example.com', name: 'Alice Smith' },
    { email: 'bob@example.com', name: 'Bob Johnson' }
  ])

  // Query with complex criteria
  const activeUsers = await userRepository.findBy({
    status: 'active'
  }, {
    orderBy: { name: 'asc' },
    limit: 20
  })
}
```

## 📚 Complete API Reference

### Repository Creation

#### PostgreSQL
```typescript
import { drizzleRepository } from 'drizzle-service/pg'

const repository = drizzleRepository(db, table, options?)
```

#### SQLite
```typescript
import { drizzleRepository } from 'drizzle-service/sqlite'

const repository = drizzleRepository(db, table, options?)
```

### Repository Options

```typescript
interface RepositoryOptions<T> {
  id?: keyof T['$inferSelect']           // Custom ID field (default: 'id')
  defaultLimit?: number                  // Default pagination limit (default: 100)
  maxLimit?: number                     // Maximum pagination limit (default: 1000)
  soft?: {                              // Soft delete configuration
    field: keyof T['$inferSelect']
    deletedValue: any
  }
  caching?: {                           // Caching configuration
    get?: <K, V>(key: K) => V | null
    set?: <K, V>(key: K, value: V, ttl?: number) => void
    clear?: () => void
    delete?: <K>(key: K) => void
  }
  override?: (baseMethods) => Partial<RepositoryMethods<T>>  // Method overrides
}
```

## 🔍 Query Operations

### Basic Queries

#### Find All Records
```typescript
const users = await userRepository.findAll()

// With options
const paginatedUsers = await userRepository.findAll({
  page: 2,
  limit: 25,
  orderBy: { createdAt: 'desc', name: 'asc' },
  withDeleted: false
})
```

#### Find by ID
```typescript
const user = await userRepository.findById(123)
// Returns: User | null
```

#### Find by Criteria (AND condition)
```typescript
const users = await userRepository.findBy({
  status: 'active',
  name: 'John'
})
```

#### Find by Matching (OR condition)
```typescript
const users = await userRepository.findByMatching({
  status: 'active',
  name: 'John'
})
// Finds users where status='active' OR name='John'
```

#### Find by Field
```typescript
const users = await userRepository.findByField('email', 'john@example.com')
```

### Advanced Queries

#### Relations and Joins
```typescript
const usersWithPosts = await userRepository.findAll({
  relations: [{
    table: posts,
    type: 'left',
    sql: eq(users.id, posts.userId)
  }],
  parse: (data) => data.map(row => ({
    ...row.users,
    posts: row.posts ? [row.posts] : []
  }))
})
```

#### Cursor-based Pagination
```typescript
const result = await userRepository.findWithCursor({
  limit: 20,
  cursor: new Date('2024-01-01'),
  orderBy: { createdAt: 'desc' }
})

console.log(result.items)
console.log(result.nextCursor)
console.log(result.pagination)
```

#### Custom SQL Conditions
```typescript
import { and, or, gt, like } from 'drizzle-orm'

const users = await userRepository.findAll({
  custom: and(
    gt(users.createdAt, new Date('2024-01-01')),
    or(
      like(users.name, '%John%'),
      like(users.email, '%@company.com')
    )
  )
})
```

#### Multi-tenant Workspace Filtering
```typescript
const tenantUsers = await userRepository.findAll({
  workspace: {
    field: 'tenantId',
    value: 'tenant-123'
  }
})
```

#### Count Records
```typescript
const totalUsers = await userRepository.count()
const activeUsers = await userRepository.count({ status: 'active' })
```

## ✏️ Mutation Operations

### Create Operations

#### Single Create
```typescript
const [error, user] = await userRepository.create({
  email: 'new@example.com',
  name: 'New User'
})

if (error) {
  console.error('Create failed:', error.message)
} else {
  console.log('Created:', user)
}
```

#### Create with Hooks
```typescript
const [error, user] = await userRepository.create(
  { email: 'test@example.com', name: 'Test User' },
  {
    beforeAction: async (data) => {
      console.log('About to create:', data)
      // Validation, logging, etc.
    },
    afterAction: async (user) => {
      console.log('Created user with ID:', user.id)
      // Send welcome email, create related records, etc.
    },
    onError: async (error) => {
      console.error('Creation failed:', error)
      // Error reporting, cleanup, etc.
    }
  }
)
```

### Update Operations

#### Update by ID
```typescript
const [error, updatedUser] = await userRepository.update(123, {
  name: 'Updated Name',
  status: 'inactive'
})
```

#### Update with Validation
```typescript
const [error, user] = await userRepository.update(
  123,
  { email: 'new-email@example.com' },
  undefined, // hooks
  (data) => {
    if (!data.email?.includes('@')) {
      throw new Error('Invalid email format')
    }
  }
)
```

### Delete Operations

#### Soft Delete
```typescript
const result = await userRepository.delete(123)
console.log(result.success) // true
console.log(result.message) // "Record soft deleted successfully"
```

#### Hard Delete
```typescript
const result = await userRepository.hardDelete(123)
console.log(result.success) // true
```

## ⚡ Bulk Operations

### Bulk Create
```typescript
const [error, users] = await userRepository.bulkCreate([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' },
  { email: 'user3@example.com', name: 'User 3' }
])

if (error) {
  console.error('Bulk create failed:', error)
} else {
  console.log(`Created ${users.length} users`)
}
```

### Bulk Update
```typescript
const [error, users] = await userRepository.bulkUpdate([
  { id: 1, data: { name: 'Updated User 1' } },
  { id: 2, data: { name: 'Updated User 2' } },
  { id: 3, data: { status: 'inactive' } }
])
```

### Bulk Delete
```typescript
// Soft delete multiple records
const result = await userRepository.bulkDelete([1, 2, 3])

// Hard delete multiple records
const result = await userRepository.bulkHardDelete([1, 2, 3])
```

## 🗄️ Database-Specific Features

### PostgreSQL Features
```typescript
import { drizzleRepository } from 'drizzle-service/pg'

// PostgreSQL-specific optimizations
const pgRepository = drizzleRepository(pgDb, pgTable, {
  // PostgreSQL supports advanced indexing strategies
  defaultLimit: 100,
  // Optimized for PostgreSQL connection pooling
})
```

### SQLite Features
```typescript
import { drizzleRepository } from 'drizzle-service/sqlite'

// SQLite-specific optimizations  
const sqliteRepository = drizzleRepository(sqliteDb, sqliteTable, {
  // SQLite optimized defaults
  defaultLimit: 50,
  // Optimized for SQLite file operations
})
```

## 🏗️ Advanced Usage

### Custom Repository Extensions

```typescript
const userRepository = drizzleRepository(db, users, {
  override: (baseMethods) => ({
    // Add custom methods
    findByEmail: async (email: string) => {
      return baseMethods.findByField('email', email)
    },
    
    findActiveUsers: async () => {
      return baseMethods.findBy({ status: 'active' })
    },
    
    // Override existing methods
    findAll: async (options?) => {
      // Add default filtering for deleted users
      const enhancedOptions = {
        ...options,
        withDeleted: false
      }
      return baseMethods.findAll(enhancedOptions)
    }
  })
})

// Usage
const user = await userRepository.findByEmail('john@example.com')
const activeUsers = await userRepository.findActiveUsers()
```

### Caching Integration

```typescript
const cache = new Map()

const userRepository = drizzleRepository(db, users, {
  caching: {
    get: (key) => cache.get(key),
    set: (key, value, ttl) => {
      cache.set(key, value)
      if (ttl) {
        setTimeout(() => cache.delete(key), ttl * 1000)
      }
    },
    delete: (key) => cache.delete(key),
    clear: () => cache.clear()
  }
})
```

### Complex Relations Example

```typescript
// Multi-level relations
const usersWithPostsAndComments = await userRepository.findAll({
  relations: [
    {
      table: posts,
      type: 'left',
      sql: eq(users.id, posts.userId)
    },
    {
      table: comments,
      type: 'left', 
      sql: eq(posts.id, comments.postId)
    }
  ],
  parse: (data) => {
    // Group and structure the joined data
    const userMap = new Map()
    
    data.forEach(row => {
      const userId = row.users.id
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          ...row.users,
          posts: []
        })
      }
      
      const user = userMap.get(userId)
      if (row.posts) {
        const existingPost = user.posts.find(p => p.id === row.posts.id)
        if (!existingPost) {
          user.posts.push({
            ...row.posts,
            comments: row.comments ? [row.comments] : []
          })
        } else if (row.comments) {
          existingPost.comments.push(row.comments)
        }
      }
    })
    
    return Array.from(userMap.values())
  }
})
```

## 📝 Types and Interfaces

### Core Types

```typescript
// Handler for error handling
type Handler<T> = Promise<[Error, null] | [null, T]>

// Pagination result
interface PaginationResult<T> {
  readonly items: readonly T[]
  readonly nextCursor: Date | null
  readonly pagination: {
    readonly page: number
    readonly pageSize: number 
    readonly total: number
    readonly hasNext: boolean
    readonly hasPrev: boolean
  }
}

// Repository hooks
interface RepositoryHooks<T> {
  beforeAction?: (data: T['$inferSelect']) => Promise<void>
  afterAction?: (data: T['$inferSelect']) => Promise<void>
  onError?: (error: Error) => Promise<void>
}

// Relation definition
interface WithRelations {
  type: 'left' | 'inner' | 'right'
  table: BaseEntity
  sql: SQL
}
```

### Query Options

```typescript
interface QueryOpts<T, TResult = T['$inferSelect'][], TRels extends WithRelations[] = []> {
  page?: number
  limit?: number
  orderBy?: {
    [P in keyof T['$inferSelect']]?: 'asc' | 'desc'
  }
  withDeleted?: boolean
  cursor?: Date | null
  relations?: TRels
  workspace?: {
    field: keyof T['$inferSelect']
    value: T['$inferSelect'][keyof T['$inferSelect']]
  }
  custom?: SQL
  parse?: (data: any[]) => TResult
}
```

## 🧪 Testing Examples

The library includes comprehensive test suites demonstrating real-world usage patterns. Check the `packages/test` directory for complete examples:

- **PostgreSQL Tests**: `packages/test/test/postgres/`
- **SQLite Tests**: `packages/test/test/sqlite/`
- **Type Tests**: `packages/test/test/*/types.test.ts`

### Running Tests
```bash
# Run all tests
pnpm test

# Run PostgreSQL tests
pnpm db:push:pg && pnpm test packages/test/test/postgres

# Run SQLite tests  
pnpm test packages/test/test/sqlite
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Drizzle ORM](https://orm.drizzle.team/) - The amazing ORM that powers this library
- All contributors who have helped shape this project

---

*Built with ❤️ for the TypeScript and Drizzle ORM community*

### 🛠️ Tools


[![Typescript](https://img.shields.io/badge/Typescript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0A0A0A?logo=drizzle&logoColor=white)](https://orm.drizzle.team/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)


## Authors

[![ImRLopezAG](https://img.shields.io/badge/ImRLopezAG-000000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ImRLopezAG)

## 🔗 Links

[![portfolio](https://img.shields.io/badge/my_portfolio-000?style=for-the-badge&logo=ko-fi&logoColor=white)](https://imrlopez.dev)
[![linkedin](https://img.shields.io/badge/linkedin-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/angel-gabriel-lopez/)
[![twitter](https://img.shields.io/badge/twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/imr_lopez)