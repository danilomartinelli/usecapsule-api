# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Capsule** platform - a deployment and cloud-native application management platform built as an Nx monorepo with multiple applications and shared libraries. The project uses TypeScript throughout, with NestJS for backend services and React with React Router for frontend applications.

## Technology Stack

### Core Technologies

- **Monorepo Tool**: Nx (v21.4.1) with workspace configuration
- **Backend**: NestJS (v11) with Express
- **Frontend**: React (v19) with React Router (v7.2) and Vite
- **Styling**: Tailwind CSS (v4) with Vite plugin
- **Language**: TypeScript (v5.8.2)
- **Package Manager**: npm with workspaces
- **Testing**: Jest for unit tests, Playwright for E2E tests

### Architecture Patterns

- **Domain-Driven Design (DDD)**: Bounded contexts in `libs/contexts/`
- **Hexagonal Architecture**: Backend services with ports & adapters
- **Feature-Sliced Design (FSD)**: Frontend applications organization
- **BFF Pattern**: API Gateway acts as Backend for Frontend

## Key Commands

### Development

```bash
# Start all services (parallel execution)
npx nx run-many --target=serve --all

# Start specific services
npx nx serve api-gateway    # Backend API (port 3000)
npx nx serve portal         # React frontend (port 4200)
npx nx serve service-auth   # Auth microservice

# Development with Docker infrastructure
npm run docker:up          # Start Docker services (PostgreSQL, Redis)
npm run docker:logs        # View Docker logs
npm run docker:reset       # Reset Docker volumes and restart
```

### Building & Production

```bash
# Build all projects
npm run build:all
npx nx run-many --target=build --all

# Build for production
npm run build:prod
npx nx run-many --target=build --all --configuration=production

# Build specific service
npx nx build api-gateway
npx nx build portal --configuration=production
```

### Testing

```bash
# Run all tests
npm run validate
npx nx run-many --target=test --all

# Run affected tests (based on git changes)
npm run affected:test
npx nx affected:test --base=main

# Run specific tests
npx nx test api-gateway
npx nx test portal --coverage

# E2E tests
npx nx e2e portal-e2e
npx nx e2e api-gateway-e2e

# Run tests for a single file
npx nx test api-gateway --testPathPattern=app.service.spec.ts
```

### Code Quality

```bash
# Lint all projects
npm run affected:lint
npx nx run-many --target=lint --all

# Lint specific project
npx nx lint api-gateway
npx nx lint portal

# Format code
npx nx format:write

# Type checking
npx nx typecheck api-gateway
npx nx typecheck portal
```

### Nx-Specific Commands

```bash
# View dependency graph
npm run graph
npx nx graph

# Show affected projects
npx nx affected:graph --base=main

# Clean Nx cache
npm run clean
npx nx reset

# Generate new components/services
npx nx g @nx/nest:module <module-name> --project=api-gateway
npx nx g @nx/nest:service <service-name> --project=api-gateway
npx nx g @nx/react:component <component-name> --project=portal
```

## Project Structure

```text
apps/
├── api-gateway/       # Main NestJS BFF API (port 3000, prefix: /api)
├── portal/            # React + Vite admin dashboard (port 4200)
├── service-auth/      # NestJS authentication microservice
├── portal-e2e/        # Playwright E2E tests for portal
└── api-gateway-e2e/   # Jest E2E tests for API

libs/
├── contexts/          # DDD Bounded Contexts (Backend)
│   └── auth/         # Authentication context
├── shared/           # Shared utilities (Full-stack)
│   ├── dto/         # Data Transfer Objects
│   └── types/       # TypeScript type definitions
└── ui/              # Frontend component library
    └── react/       # React UI components with Tailwind
```

## Important Configuration Files

- **nx.json**: Nx workspace configuration with plugins and target defaults
- **tsconfig.base.json**: Base TypeScript configuration with path mappings
- **docker-compose.yml**: Local development infrastructure (databases, brokers)
- **package.json**: Scripts and dependencies (workspaces configuration)

### Path Aliases

The project uses TypeScript path mappings configured in `tsconfig.base.json`:

- `@acme/contexts-auth`: Maps to `libs/contexts/auth`
- `@acme/shared-dto`: Maps to `libs/shared/dto`
- `@acme/shared-types`: Maps to `libs/shared/types`
- `@acme/ui-react`: Maps to `libs/ui/react`

## Backend Services Configuration

### API Gateway (NestJS)

- **Port**: 3000
- **Global Prefix**: `/api`
- **Main Entry**: `apps/api-gateway/src/main.ts`
- **Module Structure**: Uses NestJS modules pattern
- **Testing**: Jest with separate E2E tests

### Service Auth

- **Framework**: NestJS
- **Purpose**: Authentication and authorization service
- **Structure**: Same as API Gateway

## Frontend Applications

### Portal (React)

- **Port**: 4200
- **Build Tool**: Vite with React Router plugin
- **Styling**: Tailwind CSS v4 with Vite plugin
- **Entry Points**:
  - Client: `app/entry.client.tsx`
  - Server: `app/entry.server.tsx`
- **Routing**: React Router v7 with file-based routing

## Development Workflow

### Adding New Features

1. Generate necessary modules/components using Nx generators
2. Implement business logic following DDD patterns for backend
3. Use Feature-Sliced Design for frontend features
4. Write tests alongside implementation
5. Run affected tests before committing

### Working with Shared Libraries

- DTOs and types go in `libs/shared/`
- UI components go in `libs/ui/react/`
- Domain logic goes in `libs/contexts/`

### Deployment Notes

- The project is designed for containerized deployment
- Each service can be built into a Docker container
- Uses environment variables for configuration
- Supports multiple environments (development, staging, production)

## Testing Strategy

- **Unit Tests**: Jest for both frontend and backend
- **E2E Tests**: Playwright for frontend, Jest for API
- **Test Coverage**: Run with `--coverage` flag
- **Test Watch Mode**: Use `--watch` for development

## Common Patterns

### Backend Patterns

- Controllers handle HTTP requests
- Services contain business logic
- Modules organize related functionality
- Use dependency injection throughout

### Frontend Patterns

- React functional components with hooks
- React Router for navigation
- Tailwind CSS for styling
- Component composition over inheritance

## Performance Considerations

- Vite provides fast HMR for frontend development
- Nx caching speeds up builds and tests
- Use `nx affected` commands to only rebuild/test changed projects
- Docker services can be reset with `npm run docker:reset` if needed

## Troubleshooting

### Common Issues

1. **Port conflicts**: Check if ports 3000, 4200 are available
2. **Docker issues**: Run `npm run docker:reset` to clean state
3. **Nx cache issues**: Run `npm run clean` or `npx nx reset`
4. **Dependency issues**: Delete `node_modules` and run `npm install`

### Debug Commands

```bash
# Check Nx configuration
npx nx show projects

# Verify project configuration
npx nx show project api-gateway

# Check for circular dependencies
npx nx graph
```

---

## Essential Commands - This is a new section for Task Master AI - Agent Integration Guide

### Core Workflow Commands

```bash
# Project Setup
task-master init                                    # Initialize Task Master in current project
task-master parse-prd .taskmaster/docs/prd.txt      # Generate tasks from PRD document
task-master models --setup                        # Configure AI models interactively

# Daily Development Workflow
task-master list                                   # Show all tasks with status
task-master next                                   # Get next available task to work on
task-master show <id>                             # View detailed task information (e.g., task-master show 1.2)
task-master set-status --id=<id> --status=done    # Mark task complete

# Task Management
task-master add-task --prompt="description" --research        # Add new task with AI assistance
task-master expand --id=<id> --research --force              # Break task into subtasks
task-master update-task --id=<id> --prompt="changes"         # Update specific task
task-master update --from=<id> --prompt="changes"            # Update multiple tasks from ID onwards
task-master update-subtask --id=<id> --prompt="notes"        # Add implementation notes to subtask

# Analysis & Planning
task-master analyze-complexity --research          # Analyze task complexity
task-master complexity-report                      # View complexity analysis
task-master expand --all --research               # Expand all eligible tasks

# Dependencies & Organization
task-master add-dependency --id=<id> --depends-on=<id>       # Add task dependency
task-master move --from=<id> --to=<id>                       # Reorganize task hierarchy
task-master validate-dependencies                            # Check for dependency issues
task-master generate                                         # Update task markdown files (usually auto-called)
```

## Key Files & Project Structure

### Core Files

- `.taskmaster/tasks/tasks.json` - Main task data file (auto-managed)
- `.taskmaster/config.json` - AI model configuration (use `task-master models` to modify)
- `.taskmaster/docs/prd.txt` - Product Requirements Document for parsing
- `.taskmaster/tasks/*.txt` - Individual task files (auto-generated from tasks.json)
- `.env` - API keys for CLI usage

### Claude Code Integration Files

- `CLAUDE.md` - Auto-loaded context for Claude Code (this file)
- `.claude/settings.json` - Claude Code tool allowlist and preferences
- `.claude/commands/` - Custom slash commands for repeated workflows
- `.mcp.json` - MCP server configuration (project-specific)

### Directory Structure

```text
project/
├── .taskmaster/
│   ├── tasks/              # Task files directory
│   │   ├── tasks.json      # Main task database
│   │   ├── task-1.md      # Individual task files
│   │   └── task-2.md
│   ├── docs/              # Documentation directory
│   │   ├── prd.txt        # Product requirements
│   ├── reports/           # Analysis reports directory
│   │   └── task-complexity-report.json
│   ├── templates/         # Template files
│   │   └── example_prd.txt  # Example PRD template
│   └── config.json        # AI models & settings
├── .claude/
│   ├── settings.json      # Claude Code configuration
│   └── commands/         # Custom slash commands
├── .env                  # API keys
├── .mcp.json            # MCP configuration
└── CLAUDE.md            # This file - auto-loaded by Claude Code
```

## MCP Integration

Task Master provides an MCP server that Claude Code can connect to. Configure in `.mcp.json`:

```json
{
  "mcpServers": {
    "task-master-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "your_key_here",
        "PERPLEXITY_API_KEY": "your_key_here",
        "OPENAI_API_KEY": "OPENAI_API_KEY_HERE",
        "GOOGLE_API_KEY": "GOOGLE_API_KEY_HERE",
        "XAI_API_KEY": "XAI_API_KEY_HERE",
        "OPENROUTER_API_KEY": "OPENROUTER_API_KEY_HERE",
        "MISTRAL_API_KEY": "MISTRAL_API_KEY_HERE",
        "AZURE_OPENAI_API_KEY": "AZURE_OPENAI_API_KEY_HERE",
        "OLLAMA_API_KEY": "OLLAMA_API_KEY_HERE"
      }
    }
  }
}
```

### Essential MCP Tools

```javascript
help; // = shows available taskmaster commands
// Project setup
initialize_project; // = task-master init
parse_prd; // = task-master parse-prd

// Daily workflow
get_tasks; // = task-master list
next_task; // = task-master next
get_task; // = task-master show <id>
set_task_status; // = task-master set-status

// Task management
add_task; // = task-master add-task
expand_task; // = task-master expand
update_task; // = task-master update-task
update_subtask; // = task-master update-subtask
update; // = task-master update

// Analysis
analyze_project_complexity; // = task-master analyze-complexity
complexity_report; // = task-master complexity-report
```

## Claude Code Workflow Integration

### Standard Development Workflow

#### 1. Project Initialization

```bash
# Initialize Task Master
task-master init

# Create or obtain PRD, then parse it
task-master parse-prd .taskmaster/docs/prd.txt

# Analyze complexity and expand tasks
task-master analyze-complexity --research
task-master expand --all --research
```

If tasks already exist, another PRD can be parsed (with new information only!) using parse-prd with --append flag. This will add the generated tasks to the existing list of tasks..

#### 2. Daily Development Loop

```bash
# Start each session
task-master next                           # Find next available task
task-master show <id>                     # Review task details

# During implementation, check in code context into the tasks and subtasks
task-master update-subtask --id=<id> --prompt="implementation notes..."

# Complete tasks
task-master set-status --id=<id> --status=done
```

#### 3. Multi-Claude Workflows

For complex projects, use multiple Claude Code sessions:

```bash
# Terminal 1: Main implementation
cd project && claude

# Terminal 2: Testing and validation
cd project-test-worktree && claude

# Terminal 3: Documentation updates
cd project-docs-worktree && claude
```

### Custom Slash Commands

Create `.claude/commands/taskmaster-next.md`:

```markdown
Find the next available Task Master task and show its details.

Steps:

1. Run `task-master next` to get the next task
2. If a task is available, run `task-master show <id>` for full details
3. Provide a summary of what needs to be implemented
4. Suggest the first implementation step
```

Create `.claude/commands/taskmaster-complete.md`:

```markdown
Complete a Task Master task: $ARGUMENTS

Steps:

1. Review the current task with `task-master show $ARGUMENTS`
2. Verify all implementation is complete
3. Run any tests related to this task
4. Mark as complete: `task-master set-status --id=$ARGUMENTS --status=done`
5. Show the next available task with `task-master next`
```

## Tool Allowlist Recommendations

Add to `.claude/settings.json`:

```json
{
  "allowedTools": [
    "Edit",
    "Bash(task-master *)",
    "Bash(git commit:*)",
    "Bash(git add:*)",
    "Bash(npm run *)",
    "mcp__task_master_ai__*"
  ]
}
```

## Configuration & Setup

### API Keys Required

At least **one** of these API keys must be configured:

- `ANTHROPIC_API_KEY` (Claude models) - **Recommended**
- `PERPLEXITY_API_KEY` (Research features) - **Highly recommended**
- `OPENAI_API_KEY` (GPT models)
- `GOOGLE_API_KEY` (Gemini models)
- `MISTRAL_API_KEY` (Mistral models)
- `OPENROUTER_API_KEY` (Multiple models)
- `XAI_API_KEY` (Grok models)

An API key is required for any provider used across any of the 3 roles defined in the `models` command.

### Model Configuration

```bash
# Interactive setup (recommended)
task-master models --setup

# Set specific models
task-master models --set-main claude-3-5-sonnet-20241022
task-master models --set-research perplexity-llama-3.1-sonar-large-128k-online
task-master models --set-fallback gpt-4o-mini
```

## Task Structure & IDs

### Task ID Format

- Main tasks: `1`, `2`, `3`, etc.
- Subtasks: `1.1`, `1.2`, `2.1`, etc.
- Sub-subtasks: `1.1.1`, `1.1.2`, etc.

### Task Status Values

- `pending` - Ready to work on
- `in-progress` - Currently being worked on
- `done` - Completed and verified
- `deferred` - Postponed
- `cancelled` - No longer needed
- `blocked` - Waiting on external factors

### Task Fields

```json
{
  "id": "1.2",
  "title": "Implement user authentication",
  "description": "Set up JWT-based auth system",
  "status": "pending",
  "priority": "high",
  "dependencies": ["1.1"],
  "details": "Use bcrypt for hashing, JWT for tokens...",
  "testStrategy": "Unit tests for auth functions, integration tests for login flow",
  "subtasks": []
}
```

## Claude Code Best Practices with Task Master

### Context Management

- Use `/clear` between different tasks to maintain focus
- This CLAUDE.md file is automatically loaded for context
- Use `task-master show <id>` to pull specific task context when needed

### Iterative Implementation

1. `task-master show <subtask-id>` - Understand requirements
2. Explore codebase and plan implementation
3. `task-master update-subtask --id=<id> --prompt="detailed plan"` - Log plan
4. `task-master set-status --id=<id> --status=in-progress` - Start work
5. Implement code following logged plan
6. `task-master update-subtask --id=<id> --prompt="what worked/didn't work"` - Log progress
7. `task-master set-status --id=<id> --status=done` - Complete task

### Complex Workflows with Checklists

For large migrations or multi-step processes:

1. Create a markdown PRD file describing the new changes: `touch task-migration-checklist.md` (prds can be .txt or .md)
2. Use Taskmaster to parse the new prd with `task-master parse-prd --append` (also available in MCP)
3. Use Taskmaster to expand the newly generated tasks into subtasks. Consdier using `analyze-complexity` with the correct --to and --from IDs (the new ids) to identify the ideal subtask amounts for each task. Then expand them.
4. Work through items systematically, checking them off as completed
5. Use `task-master update-subtask` to log progress on each task/subtask and/or updating/researching them before/during implementation if getting stuck

### Git Integration

Task Master works well with `gh` CLI:

```bash
# Create PR for completed task
gh pr create --title "Complete task 1.2: User authentication" --body "Implements JWT auth system as specified in task 1.2"

# Reference task in commits
git commit -m "feat: implement JWT auth (task 1.2)"
```

### Parallel Development with Git Worktrees

```bash
# Create worktrees for parallel task development
git worktree add ../project-auth feature/auth-system
git worktree add ../project-api feature/api-refactor

# Run Claude Code in each worktree
cd ../project-auth && claude    # Terminal 1: Auth work
cd ../project-api && claude     # Terminal 2: API work
```

## Task Master AI Troubleshooting

### AI Commands Failing

```bash
# Check API keys are configured
cat .env                           # For CLI usage

# Verify model configuration
task-master models

# Test with different model
task-master models --set-fallback gpt-4o-mini
```

### MCP Connection Issues

- Check `.mcp.json` configuration
- Verify Node.js installation
- Use `--mcp-debug` flag when starting Claude Code
- Use CLI as fallback if MCP unavailable

### Task File Sync Issues

```bash
# Regenerate task files from tasks.json
task-master generate

# Fix dependency issues
task-master fix-dependencies
```

DO NOT RE-INITIALIZE. That will not do anything beyond re-adding the same Taskmaster core files.

## Important Notes

### AI-Powered Operations

These commands make AI calls and may take up to a minute:

- `parse_prd` / `task-master parse-prd`
- `analyze_project_complexity` / `task-master analyze-complexity`
- `expand_task` / `task-master expand`
- `expand_all` / `task-master expand --all`
- `add_task` / `task-master add-task`
- `update` / `task-master update`
- `update_task` / `task-master update-task`
- `update_subtask` / `task-master update-subtask`

### File Management

- Never manually edit `tasks.json` - use commands instead
- Never manually edit `.taskmaster/config.json` - use `task-master models`
- Task markdown files in `tasks/` are auto-generated
- Run `task-master generate` after manual changes to tasks.json

### Claude Code Session Management

- Use `/clear` frequently to maintain focused context
- Create custom slash commands for repeated Task Master workflows
- Configure tool allowlist to streamline permissions
- Use headless mode for automation: `claude -p "task-master next"`

### Multi-Task Updates

- Use `update --from=<id>` to update multiple future tasks
- Use `update-task --id=<id>` for single task updates
- Use `update-subtask --id=<id>` for implementation logging

### Research Mode

- Add `--research` flag for research-based AI enhancement
- Requires a research model API key like Perplexity (`PERPLEXITY_API_KEY`) in environment
- Provides more informed task creation and updates
- Recommended for complex technical tasks
