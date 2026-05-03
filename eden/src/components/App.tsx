import { Projects } from "./projects/Projects";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppLayout } from "./AppLayout.tsx";
import { CompleteOnboarding } from "./auth/CompleteOnboarding";
import { SignIn } from "./auth/SignIn";
import { AuthProvider, useAuthContext } from "./providers/AuthProvider";
import { ThemeProvider } from "./providers/ThemeProvider";
import { WorkspaceProvider } from "./providers/WorkspaceProvider.tsx";
import { Settings } from "./settings/Settings.tsx";
import { Spaces, SpaceRoute } from "./spaces/Spaces.tsx";
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
    <WorkspaceProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout onSignOut={signOut} />}>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/spaces" element={<Spaces />} />
            <Route path="/spaces/:spaceId" element={<SpaceRoute />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WorkspaceProvider>
  );
}

export default App;
