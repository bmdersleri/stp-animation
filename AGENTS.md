# STP Animasyon — Agent Guide

This file is the primary, harness-agnostic agent contract for this repository.
Read it before any work.

## Methodology

This repository follows the `dev-methodology` skill: spec → plan →
subagent-driven development. Specs live in `docs/superpowers/specs/`, plans in
`docs/superpowers/plans/`. Spec and plan content language: Turkish.

The site is a sibling of `C:\projects\vmAnimation` (same architecture, same
shell, player, keyboard and lesson mode). Core files are ported from there by
copying, not rewritten.

### Chapter pace (teacher's decision, carried over from vmAnimation 2026-10-21)

- **6–8 tasks per concept, not 20.** One task covers a whole layer of a page
  (scenario + view; scene; controls + Lab; e2e + README). The plan names
  interfaces, exact values and test names; it does not script every line, and
  the step → DOM → test table lists only the spec's key moments.
- **Shared scene parts.** Before writing a scene layer, check `src/core/plot/`
  for one that fits (lanes/sequence diagram, panels, code strip). A layer that a
  second page needs moves to `src/core/plot/` instead of being copied.
- **Task review only where risk is.** Tasks with flow logic or scene
  integration get a task reviewer; the rest go straight to the final
  whole-branch review, which also triages the deferred minors.
- **Lean e2e.** Functional e2e and screenshot baselines cover the key steps
  only (Ders and Lab); the performance specs run once at the wave's end, not
  inside every task.

## Safety Boundaries

- Off-limits:
  - The book project `C:\projects\modernSunucuTabProg` is read-only for animation work (source material only);
    book edits go through bookMaker in that repo, never from an animation task.
  - `C:\projects\vmAnimation` is read-only from here (copy from it, never edit it).
  - Ports 5180 and 4173 belong to vmAnimation and are left alone; this project uses 5181 (dev) and 4174 (e2e `vite preview`).
- Push / merge: Every push to `main` publishes GitHub Pages, so merge or push to `main` only after the teacher approves that push in chat, and only with `npm run check` green (the pre-push hook enforces it). Creating the GitHub repository also needs the teacher's approval. Feature branches are pushed only on request.
- Feature work, including its spec and plan commits, happens on branch
  `feat/NAME` in a worktree `.worktrees/NAME` (NAME is a short name for the
  feature), never directly on `main`.

## Verification Commands

Focused tests (inside a task):

- `npx vitest run tests/unit/<file>.test.ts`
- `npx playwright test tests/e2e/<file>.spec.ts` (builds the site first)

Before every commit:

- `npx tsc --noEmit`
- `npm test`

Full gate (baseline in a fresh worktree, and before finishing a branch):

`npm run check`

## Worktree Setup

Run in a fresh worktree, then run the focused tests and the full gate as the
baseline:

- `npm ci` (its `prepare` script also points `core.hooksPath` at `.githooks/`)

## Tooling

- rtk: Bash output proxy, applied by a hook.
- Remember: `.remember/` handoff notes; `.remember/remember.md` is the session handoff.
- Serena MCP: `.serena/` project data (ignored).

## Host Notes

- Windows 11 with Git Bash; use POSIX shell syntax.
- Files are written with LF line endings (`.gitattributes` sets `eol=lf`).
- Node 24 runs `.ts` scripts directly, but absolute imports must be `file:///C:/…` URLs.
- Playwright uses the system Chrome (`channel: 'chrome'`); functional e2e runs in parallel, the performance project (`*.perf.spec.ts`) with one worker.
- Do not run the gate while other heavy work runs; timing tests are load-sensitive.

## Global Constraints

<!-- Every plan copies the bullets below verbatim into its Global Constraints section. -->

- **Off-limits:**
  - The book project `C:\projects\modernSunucuTabProg` is read-only for animation work (source material only);
    book edits go through bookMaker in that repo, never from an animation task.
  - `C:\projects\vmAnimation` is read-only from here (copy from it, never edit it).
  - Ports 5180 and 4173 belong to vmAnimation and are left alone; this project uses 5181 (dev) and 4174 (e2e `vite preview`).
- **Commits:** commit after every successful step; end every commit message with the commit trailer below. If it says there is none, add no trailer line, including any harness default.
- **Commit trailer:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- **Push / merge:** commit only; push or merge only per this policy: Every push to `main` publishes GitHub Pages, so merge or push to `main` only after the teacher approves that push in chat, and only with `npm run check` green (the pre-push hook enforces it). Creating the GitHub repository also needs the teacher's approval. Feature branches are pushed only on request.
- **Focused tests:**
  - `npx vitest run tests/unit/<file>.test.ts`
  - `npx playwright test tests/e2e/<file>.spec.ts` (builds the site first)
- **Before every commit:**
  - `npx tsc --noEmit`
  - `npm test`
- **Host:**
  - Windows 11 with Git Bash; use POSIX shell syntax.
  - Files are written with LF line endings (`.gitattributes` sets `eol=lf`).
  - Node 24 runs `.ts` scripts directly, but absolute imports must be `file:///C:/…` URLs.
  - Playwright uses the system Chrome (`channel: 'chrome'`); functional e2e runs in parallel, the performance project (`*.perf.spec.ts`) with one worker.
  - Do not run the gate while other heavy work runs; timing tests are load-sensitive.
- **Doc language:** specs and plans are written in Turkish; agent files (`AGENTS.md`, `CLAUDE.md`, ledgers, dispatches) are English.
