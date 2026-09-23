import { Button } from "@/components/ui/button";

type LandingPageProps = {
  onSignIn: () => void;
};

const steps = [
  {
    title: "Set up your workspace",
    body: "Spin up an isolated workspace and bring your team members in.",
  },
  {
    title: "Upload your assets",
    body: "Upload raw files into Vynfo's native file system and pull them back out anytime. Use Vynfo as your team's cloud storage.",
  },
  {
    title: "Create a project",
    body: "Start a project to share a timeline and its full version history.",
  },
  {
    title: "Edit on branches",
    body: "Teammates edit on isolated branches and merge into main once the project owner approves.",
  },
  {
    title: "Ask Murch",
    body: "Spawn Murch agents onto their own isolated branches to delegate tasks, or to find and piece together interesting cuts you might have missed.",
  },
  {
    title: "Export any version",
    body: "Get a high-quality export of the final cut, or any earlier cut in the version history. Everything is stored and recoverable.",
  },
];

export function LandingPage({ onSignIn }: LandingPageProps) {
  return (
    <main className="dark min-h-screen overflow-hidden bg-background text-foreground">
      <header className="px-6 py-6 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
          <a href="/" className="flex items-center gap-4 text-lg font-semibold">
            <span className="flex size-16 items-center justify-center overflow-hidden rounded-[1.5rem] border bg-card shadow-sm">
              <img
                src="/vynfo-logo-new.png"
                alt=""
                className="size-24 max-w-none"
              />
            </span>
            <span>Vynfo</span>
          </a>
          <Button onClick={onSignIn}>Sign in with Google</Button>
        </div>
      </header>

      <section className="px-6 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-4xl py-14 text-center lg:py-16">
          <h1 className="text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Collaborative post production.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Vynfo lets editing teams move quickly and safely on one shared
            timeline.
          </p>
          <div className="mt-7 flex justify-center">
            <Button size="lg" onClick={onSignIn}>
              Sign in with Google
            </Button>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              How to use Vynfo
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              With a web-native video editor and integrated version
              control/review, Vynfo was built from the ground up for{" "}
              <span className="font-medium text-foreground">
                collaborative post production
              </span>
              .
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-3xl border bg-card p-6 shadow-sm"
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
