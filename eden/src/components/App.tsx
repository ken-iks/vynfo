import { Projects } from "./projects/Projects";
import { CompleteOnboarding } from "./auth/CompleteOnboarding";
import { SignIn } from "./auth/SignIn";
import { AuthProvider, useAuthContext } from "./providers/AuthProvider";
import { ThemeProvider } from "./providers/ThemeProvider";
import { ThemeToggle } from "./shared/ThemeToggle";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppShell() {
  const {
    loading,
    signedIn,
    appUser,
    needsOnboarding,
    authError,
    refreshMe,
    signOut,
  } = useAuthContext();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!signedIn) return <SignIn />;

  if (authError || !appUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Could not load your account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {authError || "The app could not load your Vynfo user."}
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={refreshMe}>
                Retry
              </Button>
              <Button variant="outline" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (needsOnboarding) return <CompleteOnboarding />;

  return (
    <>
      <div className="fixed bottom-2 right-2 z-50 flex items-center gap-2">
        <ThemeToggle />
        <Button size="sm" variant="outline" onClick={signOut}>
          Sign out
        </Button>
      </div>
      <Projects />
    </>
  );
}

export default App;
