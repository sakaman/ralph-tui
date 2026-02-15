# Agent Instructions

This file provides guidance to AI coding agents when working with code in this repository.

You are an AI assistant. Your role is to assist with software development tasks while adhering to strict coding standards and practices. Here's how you should approach your work:

1. Critical Coding Rules:
   - Prioritize simple, clean, and maintainable solutions over clever or complex ones.
   - Make the smallest reasonable changes to achieve the desired outcome.
   - Never make unrelated code changes; document issues for later instead.
   - Preserve code comments unless you can prove they are actively false.
   - Start all code files with a file-level JSDoc comment section explaining the file's purpose, prefixed with "ABOUTME: ".
   - Avoid temporal context in comments; make them evergreen.

2. Avoiding entropy
   - This codebase will outlive you. Every shortcut you take becomes someone else's burden. Every hack compounds into technical debt that slows the whole team down.
   - You are not just writing code. You are shaping the future of this project. The patterns you establish will be copied. The corners you cut will be cut again.
   - Fight entropy. Leave the codebase better than you found it.

## Project Overview

**Ralph TUI** is an AI Agent Loop Orchestrator - a terminal UI for orchestrating AI coding agents to work through task lists autonomously. It connects AI coding assistants to task trackers and runs them in an autonomous loop, completing tasks one-by-one with intelligent selection, error handling, and full visibility.

**Current Version:** 0.7.1

## Build Instructions

This project uses **bun** as its package manager and runtime.

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Type check (no emit)
bun run typecheck

# Lint
bun run lint
bun run lint:fix    # Auto-fix lint issues

# Run tests
bun test            # Run all tests
bun test --watch    # Run tests in watch mode
bun test --coverage # Run tests with coverage

# Run in development mode
bun run dev

# Clean build artifacts
bun run clean
```

**After making code changes**, always run:
```bash
bun run typecheck && bun run build
```

## Architecture

### Core Directories

```
src/
├── cli.tsx              # CLI entry point
├── commands/            # CLI commands (run, resume, status, logs, listen, remote, etc.)
├── config/              # Configuration loading and validation (Zod schemas)
├── engine/              # Execution engine (iteration loop, events, rate limiting)
├── interruption/        # Signal handling and graceful shutdown
├── logs/                # Iteration log persistence and structured logging
├── models-dev/          # Model development utilities
├── parallel/            # Parallel task execution with git worktrees
├── plugins/
│   ├── agents/          # Agent plugins (claude, opencode, gemini, codex, kiro, cursor, iflow)
│   │   ├── builtin/     # Built-in agent implementations
│   │   ├── droid/       # Factory Droid agent support
│   │   ├── opencode/    # OpenCode agent support
│   │   └── tracing/     # Subagent tracing parser
│   └── trackers/        # Tracker plugins (json, beads, beads-bv, beads-rust)
│       └── builtin/     # Built-in tracker implementations
├── prd/                 # PRD generation and parsing
├── remote/              # Remote instance management (WebSocket server/client)
├── sandbox/             # Sandbox execution (bwrap, sandbox-exec)
├── session/             # Session persistence and lock management
├── setup/               # Interactive setup wizard
├── shell-completion/    # Shell completion support
├── templates/           # Handlebars prompt templates
├── chat/                # AI chat mode for PRD creation
└── tui/                 # Terminal UI components (OpenTUI/React)
```

### Key Technologies

- **Bun** - JavaScript runtime and package manager
- **OpenTUI** - Terminal UI framework with React bindings
- **Handlebars** - Prompt templating engine
- **Zod** - Schema validation for configuration

### Plugin System

The plugin architecture supports multiple AI agents and task trackers:

**Agents:**
- `claude` - Claude Code (Anthropic)
- `opencode` - OpenCode
- `gemini` - Gemini CLI
- `codex` - Codex
- `kiro` - Kiro CLI
- `cursor` - Cursor
- `iflow` - iFlow CLI

**Trackers:**
- `json` - Simple JSON-based task tracking (prd.json)
- `beads` - Beads issue tracking (legacy)
- `beads-bv` - Beads with binary versioning
- `beads-rust` - beads-rust CLI integration (recommended)

## Issue Tracking with beads-rust

This project uses **br** (beads-rust) for issue tracking. Data is stored in `.beads/` directory.

### Quick Reference

```bash
br ready              # Find available work (unblocked issues)
br list               # List all open issues
br list --all         # Include closed issues
br show <id>          # View issue details with dependencies
br show <id> --json   # JSON output for programmatic use
```

### Creating & Managing Issues

```bash
# Create issues
br create "Title" --type task --priority 2 --description "Details"
br create "Epic title" --type epic --priority 1
br create "Child task" --type task --parent <epic-id>

# Update status
br update <id> --status in_progress   # Claim work
br update <id> --status open          # Release work
br update <id> --assignee "email"     # Assign to someone

# Close issues
br close <id>                         # Mark complete
br close <id> --reason "explanation"  # With reason
```

### Dependencies

```bash
br dep add <issue> <depends-on>       # Add dependency (issue depends on depends-on)
br dep remove <issue> <depends-on>    # Remove dependency
br dep list <id>                      # List dependencies
br dep tree <id>                      # Show dependency tree
br dep cycles                         # Detect circular dependencies
```

### Filtering & Search

```bash
br list --status open                 # Filter by status
br list --type task                   # Filter by type (task, bug, feature, epic)
br list --priority 1                  # Filter by priority (0-4, 0=critical)
br list --label backend               # Filter by label
br list --assignee "email"            # Filter by assignee
br ready --type task                  # Ready tasks only (exclude epics)
```

### Syncing with Git

```bash
br sync --flush-only                  # Export DB to JSONL (for commits)
git add .beads/ && git commit         # Commit issue changes
```

### JSON Output

Most commands support `--json` for programmatic access:

```bash
br list --json | jq '.[0]'            # First issue
br ready --json | jq 'length'         # Count of ready issues
br show <id> --json | jq '.dependents'  # Get children of epic
```

### Priority Levels

| Priority | Meaning |
|----------|---------|
| P0 (0) | Critical - Drop everything |
| P1 (1) | High - Do soon |
| P2 (2) | Medium - Normal work |
| P3 (3) | Low - When time permits |
| P4 (4) | Backlog - Someday/maybe |

### Issue Types

- `epic` - Large feature or initiative containing child tasks
- `feature` - New functionality
- `task` - General work item
- `bug` - Defect to fix

### Parent-Child Relationships

When you create a task with `--parent <epic-id>`, a parent-child dependency is created. The epic's `dependents` field lists all children:

```bash
br show <epic-id> --json | jq '.dependents[] | select(.dependency_type == "parent-child")'
```

## Parallel Execution

The `src/parallel/` module provides parallel task execution using git worktrees:

- **ParallelExecutor** - Coordinates parallel execution of independent tasks
- **TaskGraph** - Analyzes task dependencies to find parallel groups
- **WorktreeManager** - Manages git worktrees for isolated execution
- **MergeEngine** - Sequential merge of completed work
- **ConflictResolver** - AI-assisted conflict resolution

See `src/parallel/index.ts` for the main entry point.

## Remote Instance Management

Ralph TUI supports controlling remote instances via WebSocket:

- **server.ts** - WebSocket server for remote control (`--listen` mode)
- **client.ts** - WebSocket client with auto-reconnect
- **token.ts** - Two-tier token management (server token + connection token)
- **audit.ts** - JSONL audit logging for remote actions

## Skills

Bundled skills in `skills/` directory:

- `ralph-tui-prd` - Interactive PRD creation
- `ralph-tui-create-json` - Convert PRD to prd.json
- `ralph-tui-create-beads` - Convert PRD to Beads issues
- `ralph-tui-create-beads-rust` - Convert PRD to beads-rust issues

## UBS Quick Reference for AI Agents

UBS stands for "Ultimate Bug Scanner": **The AI Coding Agent's Secret Weapon: Flagging Likely Bugs for Fixing Early On**

**Golden Rule:** `ubs <changed-files>` before every commit. Exit 0 = safe. Exit >0 = fix & re-run.

**Commands:**
```bash
ubs file.ts file2.py                    # Specific files (< 1s) — USE THIS
ubs $(git diff --name-only --cached)    # Staged files — before commit
ubs --only=js,python src/               # Language filter (3-5x faster)
ubs --ci --fail-on-warning .            # CI mode — before PR
ubs --help                              # Full command reference
ubs sessions --entries 1                # Tail the latest install session log
ubs .                                   # Whole project (ignores things like .venv and node_modules automatically)
```

**Output Format:**
```
⚠️  Category (N errors)
    file.ts:42:5 – Issue description
    💡 Suggested fix
Exit code: 1
```
Parse: `file:line:col` → location | 💡 → how to fix | Exit 0/1 → pass/fail

**Fix Workflow:**
1. Read finding → category + fix suggestion
2. Navigate `file:line:col` → view context
3. Verify real issue (not false positive)
4. Fix root cause (not symptom)
5. Re-run `ubs <file>` → exit 0
6. Commit

**Speed Critical:** Scope to changed files. `ubs src/file.ts` (< 1s) vs `ubs .` (30s). Never full scan for small edits.

**Bug Severity:**
- **Critical** (always fix): Null safety, XSS/injection, async/await, memory leaks
- **Important** (production): Type narrowing, division-by-zero, resource leaks
- **Contextual** (judgment): TODO/FIXME, console logs

**Anti-Patterns:**
- ❌ Ignore findings → ✅ Investigate each
- ❌ Full scan per edit → ✅ Scope to file
- ❌ Fix symptom (`if (x) { x.y }`) → ✅ Root cause (`x?.y`)