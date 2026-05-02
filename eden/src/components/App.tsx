import { Projects } from "./projects/Projects";
import { AuthProvider, useAuthSwitcher } from "./providers/AuthProvider";
import { ThemeProvider } from "./providers/ThemeProvider";
import { ThemeToggle } from "./shared/ThemeToggle";
import { UserSwitcher } from "@/temp/UserSwitcher";

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
  const { userId, users } = useAuthSwitcher();
  return (
    <>
      <div className="fixed bottom-2 right-2 z-50 flex items-center gap-2">
        <ThemeToggle />
        <UserSwitcher />
      </div>
      {userId ? (
        <Projects />
      ) : (
        <div className="flex h-screen items-center justify-center text-xs text-muted-foreground">
          {users.length === 0
            ? "No users yet — create one in the top-right corner."
            : "Pick a user in the top-right corner."}
        </div>
      )}
    </>
  );
}

export default App;
