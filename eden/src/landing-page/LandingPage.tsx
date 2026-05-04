import { Button } from "@/components/ui/button";
import { LandingThemeToggle } from "./LandingThemeToggle";

type LandingPageProps = {
  onSignIn: () => void;
};

const pillars = [
  {
    eyebrow: "Vynfo Editor",
    title: "Bring the work into one creative timeline.",
    body: "Build video projects with the editing primitives teams expect: tracks, cuts, audio, effects, and shared project state.",
  },
  {
    eyebrow: "Vynfo Version Control",
    title: "Branch, review, and merge media work.",
    body: "VVC gives creative teams branches, RTMs, comments, change requests, and a final Vynfo LGTM before work lands on main.",
  },
  {
    eyebrow: "Vynfo Spaces",
    title: "Keep project context beside the work.",
    body: "Plan, coordinate, and talk through the work with teammates in shared spaces tied to your workspace.",
  },
  {
    eyebrow: "Vynfo Agents",
    title: "Delegate the boring parts.",
    body: "Use VDAs (Vynfo Delegate Agents) to search workspace artifacts, surface useful clips, and help teams stay focused.",
  },
];

const workflow = [
  "Start a project",
  "Branch the idea",
  "Request to merge",
  "Review the diff",
  "Land the cut",
];

export function LandingPage({ onSignIn }: LandingPageProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative isolate px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
          <a href="/" className="flex items-center gap-4 text-lg font-semibold">
            <span className="flex size-20 items-center justify-center overflow-hidden rounded-[1.75rem] border bg-card shadow-sm">
              <img
                src="/vynfo-logo-new.png"
                alt=""
                className="size-32 max-w-none"
              />
            </span>
            <span>Vynfo</span>
          </a>
          <div className="flex items-center gap-2">
            <LandingThemeToggle />
            <Button onClick={onSignIn}>Sign in with Google</Button>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28">
          <div>
            <div className="mb-6 inline-flex rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              Built for collaborative media work
            </div>
            <h1 className="max-w-5xl text-6xl font-semibold tracking-tight text-balance sm:text-7xl lg:text-8xl">
              Collaborative media. Done the right way.
            </h1>
            <p className="mt-7 max-w-2xl text-xl leading-9 text-muted-foreground">
              Vynfo gives media teams a shared place to create, collaborate,
              review, and keep every version of the work moving with confidence.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={onSignIn}>
                Sign in with Google
              </Button>
            </div>
          </div>

          <div className="rounded-[2rem] border bg-card/80 p-4 shadow-2xl backdrop-blur">
            <div className="rounded-[1.5rem] border bg-background p-5">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Vynfo workspace
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    Launch cut review
                  </p>
                </div>
                <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  RTM open
                </div>
              </div>
              <div className="grid gap-4 py-5">
                {workflow.map((step, index) => (
                  <div key={step} className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                      {index + 1}
                    </div>
                    <div className="h-2 flex-1 rounded-full bg-secondary">
                      <div className="h-full w-2/3 rounded-full bg-foreground/70" />
                    </div>
                    <span className="w-28 text-right text-xs text-muted-foreground">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Branch</p>
                  <p className="mt-2 font-semibold">feature/color-pass</p>
                </div>
                <div className="rounded-2xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Review</p>
                  <p className="mt-2 font-semibold">2 comments</p>
                </div>
                <div className="rounded-2xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-2 font-semibold">LGTM pending</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              Why Vynfo
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
              Media teams deserve the same collaboration discipline as software
              teams.
            </h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Creative work gets messy when files, feedback, conversations, and
              revisions drift apart. Vynfo makes the project itself the source
              of truth, then layers collaboration on top.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => (
            <article
              key={pillar.eyebrow}
              className="rounded-3xl border bg-card p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {pillar.eyebrow}
              </p>
              <h3 className="mt-4 text-xl font-semibold">{pillar.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {pillar.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-6 py-16 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl rounded-[2rem] border bg-card p-8 shadow-sm sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                Get started
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Move creative work forward in Vynfo.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                Start from the workspace, bring teammates into the process, and
                keep every creative decision connected to the work.
              </p>
            </div>
            <Button size="lg" onClick={onSignIn}>
              Sign in with Google
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
