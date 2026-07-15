---
name:slice 
description: Workflow for building features using vertical slices, Accelerate principles, and radical simplicity. Use when starting a new feature, project, or implementation task.
disable-model-invocation: true
---

For any feature, follow this loop: Research → Slice Plan → Implement Slice → Verify → Commit. Repeat.

## 1. Research First (before writing any code)

- Clarify goal, constraints, and acceptance criteria with the user.
- Read existing code to find patterns and interfaces to reuse.
- Search online for accurate, up-to-date documentation on libraries and frameworks.
- Use Context7 for API endpoints and design system references.
- Search API documentation for any external services being integrated.
- Identify risks and unknowns. Ask about them now, not mid-implementation.
- Time-box this. Stop when you know enough to slice.

## 2. Vertical Slices, Not Layers

NEVER build all frontend, then all backend, then integrate. Instead:

- **Slice 0 (Skeleton):** Wire all layers end-to-end with stubs. Frontend → API → Backend → DB. App runs.
- **Slice 1:** Smallest user-visible capability through ALL layers.
- **Slice N:** One additional capability per slice.

Each slice must be deployable and testable on its own.

## 3. Radically Simple

- Write the simplest thing that works.
- No abstraction until the third time you need it (rule of 3).
- Prefer fewer moving parts. Only split when it clearly improves clarity or testability.
- Delete dead code. If you can remove it and things still work, remove it.
- Don't add libraries for what 10-20 lines of code can do.

## 4. Verify Every Slice (mandatory before moving on)

- Build/compile passes.
- Tests pass. Add new tests for changed behavior.
- Manual smoke test the user-visible path.
- If a slice breaks something, fix it before starting the next slice.

## 5. Small Batches

- Commit after each verified slice.
- If a slice is taking too long, it's too big — split it.
- Keep trunk releasable. Never leave the codebase in a broken state.

## 6. Present the Slice Plan (get approval before coding)

Slice 0: Skeleton — [what gets connected, how to verify]
Slice 1: [First feature] — [what it does across all layers, acceptance check]
Slice 2: [Next feature] — [what it adds, acceptance check]

Each slice is a checkpoint. Wait for user approval before starting.
