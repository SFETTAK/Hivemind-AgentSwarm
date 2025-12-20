# Contributing to Hivemind

## Development Setup

```bash
# Clone the repo
git clone https://github.com/SFETTAK/Hivemind-AgentSwarm.git
cd Hivemind-AgentSwarm

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start the API server
pnpm start
```

## Project Structure

```
packages/
├── core/         # Types, agents, profiles (no dependencies)
├── connectors/   # External integrations (tmux, LLM APIs)
├── config/       # Settings management
└── api/          # Express REST API
```

## Package Dependencies

```
core ← connectors ← api
       config ←────┘
```

- **core** has no dependencies (pure TypeScript)
- **connectors** depends on core
- **config** depends on core
- **api** depends on all packages

## Code Style

- TypeScript strict mode
- Explicit types for public APIs
- JSDoc comments for exported functions
- No default exports (use named exports)

## Adding a New Connector

1. Create directory: `packages/connectors/src/{name}/`
2. Implement client in `client.ts`
3. Export from `index.ts`
4. Re-export from `packages/connectors/src/index.ts`

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm build` to verify
5. Submit PR with clear description

## Questions?

Open an issue or start a discussion.

