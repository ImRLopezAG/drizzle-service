# Contributing to Drizzle Service

Thank you for your interest in contributing to Drizzle Service! We welcome contributions from the community and are excited to see what you'll bring to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## 📜 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please treat all community members with respect and create a welcoming environment for everyone.

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v22 or higher)
- **pnpm** (v10.12.0 or higher) - This project uses pnpm as the package manager
- **Git**
- **Docker** (optional, for database testing)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/drizzle-service.git
   cd drizzle-service
   ```

3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/ImRLopezAG/drizzle-service.git
   ```

## 🛠️ Development Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up the databases for testing:
   ```bash
   # Start PostgreSQL and create test database
   ./start-database.sh
   ```

3. Build the project:
   ```bash
   pnpm build
   ```

4. Run tests to ensure everything is working:
   ```bash
   pnpm test
   ```

## 📁 Project Structure

This is a monorepo managed with Turborepo and pnpm workspaces:

```
drizzle-service/
├── apps/
│   ├── docs/                    # Documentation site (Next.js + Fumadocs)
│   └── drizzle-service/         # Main library package
├── packages/
│   ├── test/                    # Test utilities and test suites
│   └── type-config/             # Shared TypeScript configuration
├── biome.jsonc                  # Code formatting and linting
├── turbo.json                   # Turborepo configuration
└── pnpm-workspace.yaml          # pnpm workspace configuration
```

### Key Directories

- **`apps/drizzle-service/src/`** - Main library source code
- **`packages/test/test/`** - Test suites (postgres/, sqlite/)
- **`apps/docs/content/`** - Documentation in MDX format
- **`apps/drizzle-service/lib/`** - Compiled library output

## 🔄 Development Workflow

### Branch Naming

Use descriptive branch names that follow this pattern:
- `feat/feature-description` - New features
- `fix/bug-description` - Bug fixes
- `docs/documentation-update` - Documentation changes
- `refactor/code-improvement` - Code refactoring
- `test/test-improvement` - Test additions or improvements

### Making Changes

1. Create a new branch from main:
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feat/your-feature-name
   ```

2. Make your changes following the [coding standards](#coding-standards)

3. Add tests for your changes (see [Testing](#testing))

4. Update documentation if needed (see [Documentation](#documentation))

5. Run the development scripts:
   ```bash
   # Run linting and formatting
   pnpm lint
   # Build the project
   pnpm build
   # Run the migrations or push the schema changes
   pnpm db:push 
   # Run tests
   pnpm test
   ```

6. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

## 📝 Coding Standards

This project follows strict coding standards to maintain consistency and quality.

### Code Style

- **Linting & Formatting**: We use [Biome](https://biomejs.dev/) for code formatting and linting
- **TypeScript**: All code must be written in TypeScript with strict type checking
- **Function over Class**: Use functions instead of classes, even for patterns that traditionally use classes (like CQRS with builder pattern)

### Key Principles

1. **Type Safety**: Leverage TypeScript's type system fully
2. **Functional Programming**: Prefer functional approaches over object-oriented
3. **Immutability**: Avoid mutating data when possible
4. **Error Handling**: Use tuple-based error handling `[error, result]` pattern
5. **Documentation**: Code should be self-documenting with clear naming

### File Naming

- Use kebab-case for file names: `user-service.ts`
- Use PascalCase for types and interfaces: `UserService`, `ServiceOptions`
- Use camelCase for functions and variables: `createUser`, `serviceOptions`

### Import Organization

```typescript
// 1. Node.js built-ins
import { readFile } from 'fs/promises'

// 2. External libraries
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'

// 3. Internal modules (absolute imports)
import { type ServiceOptions } from './types'
import { createPagination } from './utils'

// 4. Relative imports
import './styles.css'
```

## 🧪 Testing

We use [Vitest](https://vitest.dev/) for testing with comprehensive test coverage.

### Test Structure

Tests are organized by database provider:
- `packages/test/test/postgres/` - PostgreSQL-specific tests
- `packages/test/test/sqlite/` - SQLite-specific tests

### Writing Tests

1. **Test File Naming**: Use `.test.ts` suffix
2. **Test Organization**: Group related tests using `describe` blocks
3. **Test Coverage**: Aim for high test coverage, especially for core functionality

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific database
pnpm test postgres
pnpm test sqlite

# Run tests in watch mode (during development)
pnpm test --watch
```

### Test Guidelines

1. **Unit Tests**: Test individual functions and methods
2. **Integration Tests**: Test service interactions with databases
3. **Edge Cases**: Test error conditions and boundary cases
4. **Database Tests**: Test with both PostgreSQL and SQLite
5. **Async Testing**: Properly handle async operations
6. **Three uses cases as minimum**: Each method should have at least three test cases:
   - Basic functionality
   - Edge case handling
   - Error handling

Example test structure:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { userService } from './setup'

describe('<DB Provider>: Operations(Mutation,Query, Bulk)', () => {
  it('should <describe basic functionality>', async () => {
    const [error, result] = await service.create({
      name: 'Test User',
      email: 'test@example.com'
    })
    expect(error).toBeNull()
    expect(result).toHaveProperty('id')
  })
  it('should handle <describe edge case>', async () => {
    const [error, result] = await service.create({
      name: '',
      email: 'invalid-email'
    })
    expect(error).toBeInstanceOf(Error)
    expect(result).toBeNull()
  })
  it('should throw error on <describe error condition>', async () => {
    await expect(service.create({ name: 'Test User' })).rejects.toThrow('Email is required')
  })
})
```

## 📚 Documentation

Documentation is crucial for the project's success. We use [Fumadocs](https://fumadocs.dev/) for our documentation site.

### Documentation Structure

- **`apps/docs/content/docs/`** - Main documentation in MDX format
- **Organized by modules**: `queries/`, `mutations/`, `bulk-operations/`
- **Include examples**: Each feature should have practical examples

### Writing Documentation

1. **MDX Format**: Use MDX for rich documentation with interactive examples
2. **Code Examples**: Include practical, runnable code examples
3. **API Reference**: Document all public APIs with parameters and return types
4. **User Guide**: Write from the user's perspective

### Documentation Guidelines

```mdx
---
title: Feature Name
description: Brief description of the feature
---

# Feature Name

Brief introduction to the feature and its purpose.

## Basic Usage

```typescript
// Clear, practical example
const result = await service.someMethod()
```

## Advanced Usage

More complex examples with explanations.

## API Reference

### `methodName(parameters)`

- **Parameters:**
  - `param1` (string): Description
  - `param2` (object, optional): Description
- **Returns:** Description of return value
- **Throws:** Description of possible errors
```

### Running Documentation Locally

```bash
# Start the documentation development server
pnpm dev

# Build documentation
pnpm build
```

## 📤 Submitting Changes

### Pull Request Process

1. **Update Documentation**: Ensure your changes are documented
2. **Add Tests**: Include tests for new functionality
3. **Update Changelog**: Add your changes to the appropriate section
4. **Run Checks**: Ensure all tests pass and code is properly formatted

### Pull Request Template

When creating a pull request, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring

## Testing
- [ ] Tests pass locally
- [ ] Added tests for new functionality
- [ ] Tested with PostgreSQL
- [ ] Tested with SQLite

## Documentation
- [ ] Updated relevant documentation
- [ ] Added code examples
- [ ] Updated API reference
```

### Review Process

1. **Automated Checks**: CI will run tests and linting
2. **Code Review**: Maintainers will review your code
3. **Address Feedback**: Make requested changes
4. **Approval**: Once approved, your PR will be merged

## 🚀 Release Process

The project follows semantic versioning (SemVer):

- **Patch** (1.0.x): Bug fixes and small improvements
- **Minor** (1.x.0): New features that don't break existing APIs
- **Major** (x.0.0): Breaking changes

### Release Workflow

1. **Version Bump**: Update version in `package.json`
2. **Changelog**: Update `CHANGELOG.md` with changes
3. **Build**: Ensure clean build
4. **Tag**: Create git tag for the release
5. **Publish**: Automated publishing via CI/CD

## 🤝 Getting Help

If you need help or have questions:

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Email**: contact@imrlopez.dev for direct contact

## 📄 License

By contributing to Drizzle Service, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Drizzle Service! Your contributions help make this project better for everyone. 🎉
