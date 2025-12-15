# Contributing Guide

Thanks for helping improve KB Labs Commit Plugin!

---

## 🧰 Local development

### Setup

```bash
# Clone the repository (if working standalone)
cd kb-labs-commit-plugin
pnpm install

# Or work from KB Labs monorepo root
cd kb-labs
pnpm install
```

### Building

```bash
# Build commit-core package
pnpm --filter @kb-labs/commit-core run build

# Build contracts package
pnpm --filter @kb-labs/commit-contracts run build

# Build all packages
pnpm --filter "@kb-labs/commit-*" run build
```

### Testing

```bash
# Run tests for commit-core
pnpm --filter @kb-labs/commit-core test

# Run with coverage
pnpm --filter @kb-labs/commit-core test -- --coverage

# Watch mode during development
pnpm --filter @kb-labs/commit-core test:watch
```

### Manual testing

```bash
# From KB Labs workspace root
cd /path/to/kb-labs

# Generate commits for test changes
pnpm kb commit:generate --scope "@kb-labs/commit-plugin"

# Review the plan
pnpm kb commit:open

# Apply if looks good
pnpm kb commit:apply
```

## 📐 Engineering guidelines

### Architecture (KB Labs Standard Structure)

```
packages/commit-core/src/
├── cli/              # CLI commands (defineCommand pattern)
│   └── commands/     # commit:generate, commit:apply, etc.
├── generator/        # Commit plan generation
│   ├── commit-plan.ts      # Main orchestration
│   ├── llm-prompt.ts       # LLM prompts and parsing
│   └── heuristics.ts       # Fallback grouping logic
├── analyzer/         # Git analysis and scope resolution
│   ├── git-status.ts       # Git status + nested repo detection
│   └── scope-resolver.ts   # Package scope resolution
├── executor/         # Commit execution
│   └── commit-executor.ts  # Git commit operations
└── utils/            # Shared utilities
    ├── errors.ts           # Custom error classes
    └── constants.ts        # Shared constants
```

### Code organization

- **cli/** - Keep commands thin, delegate to generator/executor
- **generator/** - Pure functions for commit plan generation
- **analyzer/** - Pure functions for git analysis and scope resolution
- **executor/** - Git operations (staging, committing)
- **utils/** - Shared utilities, no business logic

### Code quality

- Follow ESLint + Prettier (run `pnpm lint`)
- TypeScript strict mode enabled
- Explicit types at module boundaries
- Cover behavior with Vitest tests
- Use `ctx.logger` for logging (never `console.log`)
- Use `ctx.output` for user-facing output

### Conventional commits

We use Conventional Commits specification (and we eat our own dog food!):

```
feat(generator): add support for breaking change detection
fix(analyzer): resolve nested repo detection for Windows paths
refactor(executor): extract commit message formatting
docs(readme): add CI/CD integration examples
test(generator): add tests for heuristic fallback
chore(deps): update @kb-labs/cli-core to v0.2.0
```

**Commit types:**
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring (no behavior change)
- `docs:` - Documentation updates
- `test:` - Test additions/updates
- `chore:` - Maintenance (deps, configs, etc.)
- `perf:` - Performance improvements

**Scopes:**
- `generator` - Commit plan generation logic
- `analyzer` - Git analysis and scope resolution
- `executor` - Commit execution
- `cli` - CLI commands
- `heuristics` - Fallback grouping logic
- `llm` - LLM integration and prompts
- `deps` - Dependency updates
- `readme` - README updates

### Testing guidelines

**What to test:**
- ✅ Commit plan generation (LLM and heuristics)
- ✅ Git status analysis and nested repo detection
- ✅ Scope resolution (package names → paths)
- ✅ Conventional commit message formatting
- ✅ Error handling and retry logic
- ✅ CLI command execution (mocked context)

**Test structure:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('generateCommitPlan', () => {
  it('should group related files into logical commits', async () => {
    // Arrange
    const files = [/* ... */];

    // Act
    const plan = await generateCommitPlan(files);

    // Assert
    expect(plan.commits).toHaveLength(4);
    expect(plan.commits[0].message).toMatch(/^feat\(/);
  });

  it('should fall back to heuristics when LLM fails', async () => {
    // Test fallback behavior
  });
});
```

### Manifest checklist

When adding new features:

1. ✅ Register commands in `src/cli/index.ts`
2. ✅ Update `src/manifest.v2.ts` with new capabilities
3. ✅ Add tests for new functionality
4. ✅ Update README with usage examples
5. ✅ Add ADR for significant architectural decisions

---

## 🔄 Pull request workflow

### Before opening a PR

1. **Branch off `main`**
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Implement the change**
   - Follow KB Labs standard structure
   - Keep functions pure where possible
   - Use `ctx.logger` and `ctx.output`

3. **Run quality checks**
   ```bash
   pnpm --filter @kb-labs/commit-core run build
   pnpm --filter @kb-labs/commit-core run test
   pnpm --filter @kb-labs/commit-core run lint
   pnpm --filter @kb-labs/commit-core run type-check
   ```

4. **Update documentation**
   - Update README if adding features
   - Add/update tests
   - Create ADR for architectural decisions

5. **Test manually**
   ```bash
   # From KB Labs root
   pnpm kb commit:generate --scope "@kb-labs/commit-plugin"
   pnpm kb commit:open
   # Verify plan looks correct
   ```

6. **Create commits using the plugin itself!**
   ```bash
   # Use commit-plugin to create your PR commits
   pnpm kb commit
   ```

### PR requirements

- ✅ **Tests included** - Prove behavior works
- ✅ **CI passing** - All checks green
- ✅ **Documentation updated** - README, guides, ADRs
- ✅ **Conventional commits** - Follow commit spec
- ✅ **Reference issues** - Link related issues/ADRs
- ✅ **Manual testing** - Test the actual CLI commands

### PR template

```markdown
## What does this PR do?

Brief description of the change.

## Why?

Explain the motivation (bug fix, feature request, improvement).

## How?

Explain the implementation approach.

## Testing

- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Used commit-plugin to create commits for this PR

## Checklist

- [ ] Code follows KB Labs standard structure
- [ ] Tests pass (`pnpm test`)
- [ ] Builds successfully (`pnpm build`)
- [ ] Documentation updated (README, guides)
- [ ] Conventional commits used
- [ ] ADR created (if architectural change)
```

---

## 🐛 Bug reports

When reporting bugs, include:

1. **Environment**
   - KB Labs version
   - Node.js version
   - OS (macOS, Linux, Windows)

2. **Steps to reproduce**
   ```bash
   cd kb-labs
   pnpm kb commit:generate --scope "@kb-labs/my-package"
   # Error occurs
   ```

3. **Expected behavior**
   - What should happen

4. **Actual behavior**
   - What actually happened
   - Error messages (full stack trace)

5. **Workaround** (if any)
   - How you worked around the issue

---

## 💡 Feature requests

When requesting features, explain:

1. **Use case** - What problem does this solve?
2. **Proposed solution** - How should it work?
3. **Alternatives** - What other approaches did you consider?
4. **Examples** - Show example usage

```bash
# Example: Support for custom commit types
pnpm kb commit:generate --types "feat,fix,custom"
```

---

## 📝 ADR (Architecture Decision Records)

For significant changes, create an ADR:

1. **Copy template**
   ```bash
   cp docs/adr/0000-template.md docs/adr/NNNN-my-decision.md
   ```

2. **Fill in sections**
   - Status (Proposed/Accepted/Deprecated)
   - Context (What problem are we solving?)
   - Decision (What did we decide?)
   - Consequences (What are the trade-offs?)

3. **Example ADRs**
   - `0001-llm-retry-mechanism.md` - Why we retry LLM calls
   - `0002-heuristic-fallback.md` - Why we have fallback logic
   - `0003-nested-repo-detection.md` - How we detect submodules

---

## 🎯 Development workflow

### Typical workflow

```bash
# 1. Create feature branch
git checkout -b feat/add-breaking-change-detection

# 2. Make changes
# Edit src/generator/commit-plan.ts

# 3. Build and test
pnpm --filter @kb-labs/commit-core run build
pnpm --filter @kb-labs/commit-core test

# 4. Manual test
cd kb-labs
pnpm kb commit:generate --scope "@kb-labs/commit-plugin"
pnpm kb commit:open

# 5. Create commits using commit-plugin
pnpm kb commit

# 6. Push and create PR
git push origin feat/add-breaking-change-detection
```

### Debugging

```bash
# Enable debug logging
DEBUG=kb:commit:* pnpm kb commit:generate

# Or use --verbose flag
pnpm kb commit:generate --verbose

# Check generated plan
cat .kb/commit/current/plan.json | jq

# Inspect git status output
git status --porcelain
```

### Working with LLM prompts

When updating prompts in `src/generator/llm-prompt.ts`:

1. **Test with different file counts**
   - Small (<10 files)
   - Medium (20-50 files)
   - Large (100+ files)

2. **Verify JSON parsing**
   - Check that response parses correctly
   - Test retry mechanism

3. **Check commit quality**
   - Are messages descriptive?
   - Are files grouped logically?
   - Do commit types match changes?

---

## 🤝 Code review

When reviewing PRs:

- ✅ **Architecture** - Follows KB Labs standard structure?
- ✅ **Code quality** - Clean, readable, maintainable?
- ✅ **Tests** - Adequate coverage, meaningful assertions?
- ✅ **Documentation** - README/guides updated?
- ✅ **Commits** - Follow Conventional Commits spec?
- ✅ **Manual testing** - Did you test the CLI commands?

---

## 📚 Resources

- [KB Labs Platform](https://github.com/kb-labs/kb-labs)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [KB Labs DevKit](https://github.com/kb-labs/kb-labs-devkit)
- [Architecture Docs](./docs/architecture.md)
- [ADR Template](./docs/adr/0000-template.md)

---

**Questions?** Open a [discussion](https://github.com/kb-labs/kb-labs/discussions) or ask in the PR!

**Last updated:** 2025-12-15
