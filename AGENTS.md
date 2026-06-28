# Agent Rules

Rules an AI coding agent must follow while working in this repo. Add new rules as top-level sections under "## Rules" so this file stays a single, scannable list.

## Rules

### 1. Do not run builds/tests as a verification step

**Trigger check:** Before running ANY shell command after finishing your edits, ask: *"Am I about to run this only to verify my changes compile/typecheck/pass tests?"* If yes — STOP. Summarize and hand back to the user.

- When you finish a code change, stop after the edits and lint checks. Do NOT run build, compile, or test commands as a final "verification" step. The user runs these themselves.
- This includes (non-exhaustive):
  - `go build`, `go test`, `go run`
  - `pnpm build`, `pnpm dev`, `pnpm test`, `pnpm tsc`, `npm run ...`
  - `cargo build`, `cargo test`
  - `uv run`, `pytest`, `python -m ...`
  - `make`, `make test`, `make build`
  - Docker builds, `docker compose up`
  - Any other "let me just confirm it compiles" invocation

**What to do instead:**

1. Make the edits.
2. Run `ReadLints` on the touched files to surface static issues.
3. Summarize what changed and stop.
4. If a build-like command is genuinely required **to produce an artifact the user asked for** (e.g. "generate the protobuf bindings", "run codegen"), that's fine — it's part of the deliverable, not verification.

**When it IS OK to run a build-adjacent command:**

- The user explicitly asks for it ("run the tests", "build it", "make sure it compiles").
- Codegen steps the user asked for as part of the task.
- A linter/formatter the repo's own tooling expects to run on edit (e.g. a pre-commit hook the user has asked you to invoke).

If in doubt, **don't run it** and let the user verify.

### 2. Use shadcn. Never hand-roll UI primitives.

This project uses shadcn (see `eden/components.json`). UI primitives live in `eden/src/components/ui/`. Do not bypass shadcn.

- If a needed UI primitive (`input`, `label`, `select`, `checkbox`, `tabs`, `tooltip`, etc.) is **missing** from `eden/src/components/ui/`, add it via the shadcn CLI:

  ```bash
  cd eden && pnpm dlx shadcn@latest add <component>
  ```

- If it **already exists** in `eden/src/components/ui/`, import and use it directly.
- **Never** write a replacement primitive by hand (no custom `Input`, `Label`, `Select`, etc. in `components/ui/` or elsewhere). Even "quick" one-file re-implementations are forbidden.
- **Never** copy/paste shadcn source manually instead of running the CLI.
- The shadcn style is locked to `radix-lyra` via `eden/components.json` — running the CLI keeps generated files consistent; hand-written ones will drift.
- If `pnpm dlx shadcn@latest add <x>` fails (network, sandbox, registry issue), stop and tell the user. Do **not** fall back to writing the component yourself.
- Composite/app-level components (e.g. `CreateProjectDialog`) are fine to write by hand — this rule targets **UI primitives** that shadcn owns.

**Examples:**

```tsx
// ❌ BAD — hand-rolled primitive
function Input(props: React.ComponentProps<"input">) {
  return <input className="border h-8 px-2 ..." {...props} />;
}

// ✅ GOOD — use the shadcn-generated one
import { Input } from "@/components/ui/input";
```

```bash
# ✅ GOOD — adding a missing primitive
cd eden && pnpm dlx shadcn@latest add label
```

### 3. Keep each turn tightly scoped

Do only what the user asked for in the current turn. More work is not automatically better.

- Keep implementation turns focused on the requested change and the minimum supporting edits needed to make that change coherent.
- If you notice related improvements, extra UI work, refactors, cleanup, or hardening that might be useful, mention them as suggestions instead of doing them.
- Do not expand scope because an adjacent task seems obvious. Ask or suggest first, then wait for the user to request it.
- When a change has multiple layers, complete the directly requested layer first and pause before moving into optional follow-on work.

**Examples:**

```text
❌ BAD — user asks for a DB field, so the agent also redesigns the UI flow,
adds a dialog, and installs a new UI primitive.

✅ GOOD — make the DB/proto/service change that was requested, then mention:
"The create-space UI will also need a name input when you want that wired up."
```

```text
❌ BAD — user asks for a required column migration, so the agent also adds
extra indexes, constraints, or hardening that were not requested.

✅ GOOD — add the required migration only. If an index or additional constraint
might be useful, suggest it separately and wait.
```

```text
❌ BAD — user asks to wire up a required field, so the agent uses
window.prompt as a quick client-side input without being asked to touch UI.

✅ GOOD — leave the UI alone unless requested. If UI work is necessary for the
feature to be usable, call that out before implementing it.
```

### 4. Do not move or delete files for renames, moves, or file type changes

If a file needs to be renamed, moved, or have its extension/file type changed, do not do it yourself. Ask the user to rename, move, or change the file type instead, then continue from the updated file path.

Moving, deleting, and recreating files loses editor continuity and can surprise the user, even when the final contents look similar.

**Example:**

```text
❌ BAD — deleting `SpaceView.ts` and creating `SpaceView.tsx` because JSX was added.

✅ GOOD — ask the user to change `SpaceView.ts` to `SpaceView.tsx`, then continue editing the renamed file.
```

```text
❌ BAD — moving `main.py` into `src/mensah/main.py` directly.

✅ GOOD — tell the user that `main.py` should move into `src/mensah/main.py`, wait for them to move it, then continue from the new path.
```

### 5. Prefer shared helpers for repeated logic

When similar formatting, conversion, parsing, or mapping logic appears in more than one place, prefer moving it into an existing shared helper module or a small colocated helper that can be reused.

Keep this scoped: extract only the repeated logic needed for the current task, and do not turn a narrow change into a broad refactor.

**Example:**

```text
❌ BAD — format protobuf timestamps separately inside each component.

✅ GOOD — add `formatTimestampDate` / `formatTimestampTime` to `eden/src/lib/utils.ts` and reuse them at the call sites.
```

### 6. Do the requested implementation, not a "cleaner" variant

When the user asks for a specific implementation shape, make that implementation directly. Do not substitute a more abstract, stricter, "cleaner", or more clever variant unless the user asks for it.

- If the user picks one option from a prior explanation, implement exactly that option.
- If a cleaner implementation seems worthwhile, mention it briefly as an option and wait for the user to choose it before changing course.
- Do not iterate on generated code aesthetics after the requested behavior is present.
- If a generated API is slightly awkward but correct, stop and summarize it instead of changing the source query/schema just to make the generated API prettier.
- For codegen-backed changes, make the source edit, follow any tool-specific repo rules below, check lints, and stop.

**Example:**

```text
BAD — user asks for the simple tip-commit query, so the agent rewrites it with
a join to force a nicer generated parameter type.

GOOD — add `SELECT * FROM branches WHERE project_id = $1 AND tip_commit_id = $2;`,
ask the user to run sqlc, and report that sqlc may represent `tip_commit_id`
as nullable because the column is nullable.
```

### 7. Explicitly cd before running terminal commands

Do not run any terminal command unless the command itself first changes into the exact directory where it should run.

- Use `cd <directory> && <command>` so the command's working directory is visible in the terminal history.
- Do not rely on the terminal's current directory, the workspace root, or tool-level working directory settings.
- Pick the narrowest correct directory for the command, such as `eden` for frontend package commands or `chichi` for backend commands.

### 8. Never run pnpm commands

Do not run `pnpm` commands for any reason.

- If a dependency, shadcn component, package script, install, remove, update, format, lint, dev server, build, codegen, or other `pnpm` command seems necessary, stop and tell the user what command they need to run.
- Do not substitute `npm`, `yarn`, `npx`, `corepack`, or another package-manager command for `pnpm`.
- After the user runs the command, continue from the resulting files.

### 9. Use current React 19 event types and APIs

This project uses React 19.2.10 or newer. Do not use deprecated React types or APIs.

- Never use `FormEventHandler` or `React.FormEvent` for form submission handlers. Use `SubmitEventHandler` instead.
- Before adding React types or APIs, prefer the current React 19-compatible form and avoid deprecated aliases, patterns, or imports.

### 10. Favor correct long-term fixes over temporary convenience

When the user asks how to make a specific file or code path work, inspect the actual file and recommend or implement the correct long-term approach, even if it takes more work.

- Never suggest a temporary fix, fake implementation, weaker workaround, or lazy convenience path when the correct approach is knowable.
- Do not suggest loosening production types, passing `None`, deleting useful type information, moving setup into the wrong layer, or otherwise making the product worse to avoid straightforward support code.
- Do not stop at "this may be abstract" or "you could fake it" when the concrete ownership, initialization path, abstract methods, or incompatible signatures can be discovered and fixed properly.
- If tooling reports exact missing methods or incompatible signatures, use that feedback to complete the correct implementation before responding.

### 11. Do not run sqlc generate

Do not run `sqlc generate`, `go run github.com/sqlc-dev/sqlc/cmd/sqlc ...`, or any other sqlc codegen command.

- When a change needs sqlc output, edit the source SQL/schema files only.
- Tell the user the exact command they should run, usually `cd chichi && sqlc generate`.
- After the user runs sqlc, continue from the generated files if they ask for more work.

### 12. Never update generated files unless explicitly instructed

Do not edit generated files unless the user explicitly asks you to edit generated output.

- When generated files need to change, update the source files only and tell the user the exact generation command they should run.
- Always feel comfortable stopping to ask the user for further instructions or for help running a command.
- Do not hand-edit generated code to keep the working tree temporarily compiling unless the user specifically requests that.

<!--
To add another rule, append:

### N. <Short title>

<body>

Keep the list flat (no nested rules) so the file stays scannable.
-->
