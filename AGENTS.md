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

<!--
To add another rule, append:

### N. <Short title>

<body>

Keep the list flat (no nested rules) so the file stays scannable.
-->
