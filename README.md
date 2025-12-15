# KB Labs Commit Plugin

> **AI-powered commit generation for modern development workflows.** Transform your git changes into meaningful, atomic commits with professional commit messages automatically.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18.18.0+-green.svg)](https://nodejs.org/)
[![KB Labs Platform](https://img.shields.io/badge/KB_Labs-Platform-blue.svg)](https://github.com/kb-labs)

## Overview

KB Labs Commit Plugin is an intelligent commit generator that analyzes your code changes and creates atomic, well-structured commits with professional commit messages following Conventional Commits specification. It's designed for developers who want to maintain clean git history without manual commit crafting.

**Key benefits:**
- ✅ **AI-powered commit generation** - Analyzes diffs and creates logical commit groupings
- ✅ **Conventional Commits** - Professional messages with proper types and scopes
- ✅ **Atomic commits** - Groups related changes into focused commits
- ✅ **Heuristic fallback** - Works even when LLM is unavailable
- ✅ **Monorepo support** - Handles complex nested repository structures

## Quick Start

### Installation

Commit Plugin is part of the KB Labs platform and runs in the KB Labs environment:

```bash
# Commit Plugin is integrated into KB Labs
# No separate installation needed - available via kb CLI

# Make sure you're in a KB Labs workspace
cd /path/to/kb-labs

# Plugin commands available immediately
pnpm kb commit --help
```

### Setup

Initialize the commit workspace in your project:

```bash
# Create .kb/commit/ directory structure
pnpm kb plugins setup @kb-labs/commit
```

This creates:
- `.kb/commit/current/` - Current commit plan and artifacts
- `.kb/commit/history/` - Historical commit plans
- `.kb/commit/.gitignore` - Prevents accidental commits
- `.kb/commit/README.md` - Workspace documentation

### First Commit

```bash
# 1. Generate commit plan from your changes
pnpm kb commit:generate

# 2. Review the generated plan
pnpm kb commit:open

# 3. Apply the commits
pnpm kb commit:apply
```

Or use the all-in-one command:

```bash
# Generate + review + apply in one step
pnpm kb commit
```

That's it! Commit Plugin will:
1. Analyze your git changes
2. Group related files into logical commits
3. Generate professional commit messages
4. Create atomic commits with proper structure

## Why Commit Plugin?

### Before Commit Plugin ❌
```bash
# Manual, time-consuming process
git status
# ... look at 50+ changed files
git add file1.ts file2.ts
# ... try to remember what changes belong together
git commit -m "update stuff"
# ... repeat for each logical change
# ... end up with vague commit messages
```

**Problems:**
- 🔴 Hard to group related changes
- 🔴 Writing commit messages takes time
- 🔴 Easy to create unfocused commits
- 🔴 Inconsistent commit message format
- 🔴 Difficult to maintain clean history

### With Commit Plugin ✅
```bash
pnpm kb commit
```

**Benefits:**
- ✅ Automatic change grouping
- ✅ Professional commit messages
- ✅ Atomic, focused commits
- ✅ Conventional Commits compliance
- ✅ Clean, reviewable git history

## Features

### 🎯 Intelligent Commit Generation

**AI-powered analysis:**
- Analyzes file diffs to understand changes
- Groups related changes into logical commits
- Generates descriptive, professional commit messages
- Follows Conventional Commits specification

**Two-phase generation:**
- **Phase 1** - Quick analysis with file summaries
- **Phase 2** - Deep analysis with full diffs (if needed)
- **Heuristic fallback** - Groups by file type when LLM fails

```bash
# Let AI analyze and group your changes
pnpm kb commit:generate

# Scope to specific package
pnpm kb commit:generate --scope "@kb-labs/core"

# Use specific scope name for commit messages
pnpm kb commit:generate --scope-name "my-feature"
```

### 📝 Conventional Commits

All commits follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

**Commit types:**
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks
- `docs:` - Documentation updates
- `test:` - Test additions/updates
- `build:` - Build system changes
- `ci:` - CI/CD changes
- `perf:` - Performance improvements

**Example commits:**
```
feat(core): add async logging API
fix(api): resolve race condition in concurrent writes
refactor(utils): extract common validation logic
chore(deps): update dependencies to latest versions
docs(readme): add installation instructions
test(core): add unit tests for logger
```

### 🎨 Commit Grouping Strategies

**Smart grouping rules:**
- Groups files by logical change, not by file type
- For initial setup: groups by package or functional area
- Scales commit count with file count:
  - 3-8 commits for <50 files
  - 5-12 commits for 50-150 files
  - 10-20 commits for 150+ files

**Heuristic fallback:**
When LLM fails, uses file-based grouping:
- Dependencies (`package.json`, `pnpm-lock.yaml`)
- Configurations (`tsconfig.json`, `tsup.config.ts`)
- Documentation (`.md` files)
- Tests (`.test.ts`, `.spec.ts`)

### 🔄 Three-Stage Workflow

**1. Generate** - Create commit plan
```bash
pnpm kb commit:generate
# Output: .kb/commit/current/plan.json
```

**2. Review** - Inspect the plan
```bash
pnpm kb commit:open
# Opens plan in your editor
```

**3. Apply** - Create the commits
```bash
pnpm kb commit:apply
# Executes git commits
```

### 🎯 Scope Support

**Nested repository detection:**
- Automatically detects git submodules
- Works with monorepo packages
- Supports wildcard patterns

```bash
# Scope to specific package
pnpm kb commit:generate --scope "@kb-labs/commit-plugin"

# Scope to directory
pnpm kb commit:generate --scope "packages/core"

# Scope with wildcard
pnpm kb commit:generate --scope "packages/*/src"
```

### 🛡️ Retry Mechanism

**Automatic LLM retry:**
- Up to 2 retry attempts on parse errors
- Exponential backoff (1s, 2s delays)
- Falls back to heuristics if all retries fail
- Detailed error logging

### 📊 Commit Reports

**Detailed execution reports:**
```bash
# View generated plan
pnpm kb commit:open

# Check what was created
cat .kb/commit/current/plan.json
```

**Plan structure:**
```json
{
  "commits": [
    {
      "message": "feat(core): add new feature",
      "files": ["src/feature.ts", "src/types.ts"],
      "description": "Implements async logging with batching"
    }
  ],
  "metadata": {
    "generator": "llm",
    "confidence": 0.85,
    "totalFiles": 15,
    "totalCommits": 4
  }
}
```

## Advanced Usage

### Monorepo Support

Commit Plugin natively supports complex monorepo structures:

```bash
# Commit changes in specific workspace
pnpm kb commit:generate --scope "@kb-labs/core"

# Nested monorepo (submodule)
pnpm kb commit:generate --scope "@kb-labs/commit-plugin"

# Wildcard patterns
pnpm kb commit:generate --scope "packages/core-*"
```

**Supported structures:**
- Flat monorepos (`packages/*`)
- Nested umbrellas (`kb-*/packages/**`)
- Git submodules (nested repositories)
- Mixed hierarchies (any structure)

### Configuration

Create `kb.config.json` in your workspace:

```json
{
  "commit": {
    "scope": {
      "default": "kb-labs-commit-plugin"
    },
    "llm": {
      "maxRetries": 2,
      "temperature": 0.3,
      "maxTokensPhase1": 2000,
      "maxTokensPhase2": 6000
    },
    "heuristics": {
      "enabled": true,
      "minCommits": 3,
      "maxCommits": 8
    }
  }
}
```

### CI/CD Integration

**GitHub Actions:**
```yaml
name: Auto Commit
on:
  workflow_dispatch:

jobs:
  commit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4

      - run: pnpm install
      - run: pnpm kb commit:generate --scope "@my-org/my-package"
      - run: pnpm kb commit:apply
      - run: git push
```

**GitLab CI:**
```yaml
auto-commit:
  script:
    - pnpm install
    - pnpm kb commit:generate
    - pnpm kb commit:apply
    - git push
  only:
    - main
  when: manual
```

## Command Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `pnpm kb commit` | Full workflow (generate + review + apply) |
| `pnpm kb commit:generate` | Generate commit plan from changes |
| `pnpm kb commit:open` | Open plan in editor for review |
| `pnpm kb commit:apply` | Execute commits from plan |
| `pnpm kb commit:push` | Push commits to remote |

### Common Flags

| Flag | Description |
|------|-------------|
| `--scope <pattern>` | Filter to specific packages/paths |
| `--scope-name <name>` | Override scope name in commit messages |
| `--dry-run` | Preview without creating commits |
| `--skip-llm` | Use heuristics only (skip AI) |

## Use Cases

### 1. Regular Development
```bash
# Make your changes
# Then create commits
pnpm kb commit
```

### 2. Large Refactoring
```bash
# Generate commits for 100+ files
pnpm kb commit:generate
# Review the plan
pnpm kb commit:open
# Apply if looks good
pnpm kb commit:apply
```

### 3. Initial Project Setup
```bash
# Generate commits for new project files
pnpm kb commit:generate --scope "@my-org/new-project"
```

### 4. Scoped Changes
```bash
# Only commit changes in specific package
pnpm kb commit:generate --scope "packages/core"
```

## FAQ

### Q: Do I need to install Commit Plugin separately?

**A:** No! Commit Plugin is part of the KB Labs platform and runs within the KB Labs environment. It's designed to work exclusively in KB Labs workspaces, not as a standalone package.

### Q: Can I install this via npm/pnpm directly?

**A:** Commit Plugin is not designed for standalone use. It's integrated into the KB Labs ecosystem and requires:
- KB Labs CLI runtime
- KB Labs workspace structure
- KB Labs plugin system

**To use it:**
```bash
# From your KB Labs workspace root
pnpm kb commit --help
```

### Q: Do I need to run setup before first use?

**A:** Yes, run setup once per project to create the `.kb/commit/` workspace:
```bash
pnpm kb plugins setup @kb-labs/commit
```
This creates the directory structure for plans and history. Setup is automatic and safe to run multiple times.

### Q: Can I use Commit Plugin outside KB Labs?

**A:** No. Commit Plugin is tightly integrated with KB Labs:
- Uses KB Labs plugin runtime (`runtime.state`, `runtime.logger`)
- Relies on KB Labs workspace structure
- Requires KB Labs CLI commands registry
- Designed for KB Labs monorepo architecture

Think of it like a VS Code extension - it only works within VS Code, not as a standalone tool.

### Q: What happens if LLM fails to generate commits?

**A:** Commit Plugin automatically falls back to heuristic-based grouping:
- Groups files by type (dependencies, configs, docs, tests)
- Creates focused commits with proper types
- Guarantees at least 3-4 commits for better granularity

### Q: Can I customize commit message format?

**A:** Commit messages follow Conventional Commits specification. You can customize scope names:
```bash
pnpm kb commit:generate --scope-name "my-feature"
```

### Q: How does the plugin group files?

**A:** It uses two strategies:
1. **LLM-based** (primary): Analyzes diffs to understand logical changes
2. **Heuristic** (fallback): Groups by file type and purpose

The LLM tries to answer: "Would a developer make these changes in separate commits?"

### Q: Can I scope commits to specific packages?

**A:** Yes! Use the `--scope` flag:
```bash
pnpm kb commit:generate --scope "@kb-labs/core"
```

### Q: Does it work with git submodules?

**A:** Yes! Commit Plugin automatically detects nested git repositories:
```bash
pnpm kb commit:generate --scope "@kb-labs/commit-plugin"
```
It will run git commands inside the submodule.

### Q: How many commits will it generate?

**A:** It scales with file count:
- <50 files → 3-8 commits
- 50-150 files → 5-12 commits
- 150+ files → 10-20 commits

You can review the plan before applying.

### Q: Can I edit the plan before applying?

**A:** Yes! Open the plan:
```bash
pnpm kb commit:open
```
Edit `.kb/commit/current/plan.json`, then apply:
```bash
pnpm kb commit:apply
```

### Q: What if I don't like the generated commits?

**A:** Don't apply them! The plan is just a JSON file. You can:
- Regenerate with different scope
- Edit the plan manually
- Skip and commit manually

## Architecture

Commit Plugin follows KB Labs standard structure:

```
packages/commit-core/src/
├── cli/              # CLI commands
│   └── commands/     # commit:generate, commit:apply, etc.
├── generator/        # Commit plan generation
│   ├── commit-plan.ts      # Main generation logic
│   ├── llm-prompt.ts       # LLM prompts
│   └── heuristics.ts       # Fallback grouping
├── analyzer/         # Git analysis
│   ├── git-status.ts       # Git status + nested repo detection
│   └── scope-resolver.ts   # Package scope resolution
├── executor/         # Commit execution
│   └── commit-executor.ts  # Git commit operations
└── utils/            # Shared utilities
    ├── errors.ts           # Custom error classes
    └── constants.ts        # Shared constants
```

## Support & Resources

- **Documentation**: [Full docs →](./docs/)
- **Issues**: [Report bugs →](https://github.com/kb-labs/kb-labs-commit-plugin/issues)
- **Discussions**: [Ask questions →](https://github.com/kb-labs/kb-labs/discussions)
- **KB Labs Platform**: [Main repository →](https://github.com/kb-labs/kb-labs)


## License

KB Public License v1.1 - see [LICENSE](LICENSE) for details.

This is open source software with some restrictions on:
- Offering as a hosted service (SaaS/PaaS)
- Creating competing platform products

For commercial licensing inquiries: contact@kblabs.dev

**User Guides:**
- [English Guide](../LICENSE-GUIDE.en.md)
- [Русское руководство](../LICENSE-GUIDE.ru.md)

---

**Note:** This plugin is part of the KB Labs ecosystem and requires the KB Labs platform to run. It cannot be used as a standalone npm package.
