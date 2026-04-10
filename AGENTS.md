# Agent Context

- Use Node 22 for this repo. Run `nvm use` from the repository root before installing dependencies or running scripts.
- The repo is a monorepo with `apps/desktop`, `apps/mobile`, and `packages/browser-core`.
- Prefer root npm scripts such as `npm run desktop:typecheck`, `npm run desktop:build`, and `npm run mobile:typecheck` when validating changes.
- Do not run EAS project initialization unless the user explicitly asks for it, since it depends on their Expo account.

