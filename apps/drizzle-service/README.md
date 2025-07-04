# Drizzle Service

**drizzle-service** is a lightweight, powerful library for creating data repositories using [Drizzle ORM](https://orm.drizzle.team/). It provides a flexible and extensible way to manage your database interactions for **PostgreSQL** and **SQLite**, with built-in support for common operations like pagination, soft deletes, and more.

## Features

-   **Database Agnostic:** Works seamlessly with both PostgreSQL and SQLite.
-   **Extensible:** Easily extend repositories with custom methods.
-   **Pagination:** Built-in support for paginated queries.
-   **Soft Deletes:** Optional soft delete functionality for your entities.
-   **Error Handling:** Robust error handling for database operations.
-   **Bulk Operations:** Efficiently perform bulk create, update, and delete operations.
-   **Customizable:** Override default repository methods to fit your needs.

## Installation

```bash
npm install drizzle-service
```

## Usage

First, you need to create a Drizzle ORM instance and define your schema. Then, you can use `drizzleRepository` to create a repository for your entities.

### 1. Define your schema

Create your Drizzle schema as you normally would. Your entities should extend the `BaseEntity` interface.

```typescript
// src/schema.ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { BaseEntity } from 'drizzle-service';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export interface User extends BaseEntity {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Create a repository

Create a repository for your entity using `drizzleRepository`.

```typescript
// src/repository.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { drizzleRepository } from 'drizzle-service';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres('...');
const db = drizzle(client, { schema });

export const userRepository = drizzleRepository.pg(db, schema.users);
```

### 3. Use the repository

Now you can use the repository to perform CRUD operations on your database.

```typescript
// src/index.ts
import { userRepository } from './repository';

async function main() {
  // Create a new user
  const [error, newUser] = await userRepository.create({
    name: 'John Doe',
    email: 'john.doe@example.com',
  });

  if (error) {
    console.error(error);
    return;
  }

  console.log('Created user:', newUser);

  // Find all users
  const users = await userRepository.findAll();
  console.log('All users:', users);

  // Find a user by ID
  const user = await userRepository.findById(newUser.id);
  console.log('User by ID:', user);

  // Update a user
  const [updateError, updatedUser] = await userRepository.update(newUser.id, {
    name: 'John Doe Jr.',
  });

    if (updateError) {
    console.error(updateError);
    return;
    }

  console.log('Updated user:', updatedUser);

  // Delete a user
  const { success, message } = await userRepository.delete(newUser.id);
  console.log(message);
}

main();
```

## API

### `drizzleRepository`

The main export of the library. It has two properties: `pg` and `sqlite`.

-   `drizzleRepository.pg(db, table, options)`: Creates a repository for a PostgreSQL database.
-   `drizzleRepository.sqlite(db, table, options)`: Creates a repository for a SQLite database.

### Repository Methods

Each repository comes with a set of built-in methods for common database operations.

#### Query Operations

-   `findAll(options)`: Finds all entities.
-   `findById(id)`: Finds an entity by its ID.
-   `findBy(criteria, options)`: Finds entities that match the given criteria.
-   `findByMatching(criteria, options)`: Finds entities that match any of the given criteria.
-   `findByField(field, value, options)`: Finds entities by a specific field and value.
-   `findWithCursor(options)`: Finds entities with cursor-based pagination.
-   `count(criteria, options)`: Counts the number of entities that match the given criteria.

#### Mutation Operations

-   `create(data, hooks)`: Creates a new entity.
-   `update(id, data, hooks)`: Updates an entity by its ID.
-   `delete(id, hooks)`: Soft deletes an entity by its ID.
-   `hardDelete(id, hooks)`: Permanently deletes an entity by its ID.

#### Bulk Operations

-   `bulkCreate(data, hooks)`: Creates multiple entities at once.
-   `bulkUpdate(data, hooks)`: Updates multiple entities at once.
-   `bulkDelete(ids, hooks)`: Soft deletes multiple entities at once.
-   `bulkHardDelete(ids, hooks)`: Permanently deletes multiple entities at once.

### Options

You can customize the behavior of the repository by passing an options object to the `drizzleRepository` function.

-   `defaultLimit`: The default number of items to return in a paginated query.
-   `maxLimit`: The maximum number of items to return in a paginated query.
-   `soft`: An object with a `field` and `deletedValue` to enable soft deletes.
-   `caching`: An object with `get`, `set`, `clear`, and `delete` methods for caching.
-   `override`: A function that allows you to override the default repository methods.
-   `id`: The name of the ID field if it's not `id`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on the [GitHub repository](https://github.com/your-username/drizzle-service).

## License

This project is licensed under the MIT License.