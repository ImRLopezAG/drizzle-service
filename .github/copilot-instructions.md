---
applyTo: '**/*.ts,**/*.tsx,**/*.mdx'
---

# General Instructions for Copilot

- Use `function` instead of `class` for the implementation even  if if it demands a class like `cqrs` with `builder` patter to keep the logic simple and easy to understand.

- for documentation we use `mdx` files in `packages/apps/docs/content`, these files should be organized by module and should include examples and usage guidelines for the components. and they should be written in a way that is easy to understand and follow that uses [fumadocs](https://fumadocs.dev/llms.txt). use the native components [Components](https://fumadocs.dev/docs/ui/components), enhance the codeblocks with the [CodeBlock](https://fumadocs.dev/docs/ui/markdown#codeblock), and the structure the documentation is:
  - operation
    - index
    - api-reference
    - examples
- for indexing the operation documentation we will use the `index` file to provide a summary of the operation and should have something like this:
```mdx
---
title: <operation>
index: true
description: <description>    
---
```


- for the icons we will use the `lucide` icon library, you can find the icons [here](https://lucide.dev/icons).

- For the test each method should have a test that covers the basic functionality and edge cases. The tests should be written in a way that is easy to understand and follow. the tests should be written in `vitest` and should be placed in the `packages/test/tests/<dbprovider>/repository.<operation>.test.ts` folder. The tests should be organized by operation and should include examples of how to use the methods.

