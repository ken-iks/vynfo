import { Projects } from "./projects/Projects";
import { AuthProvider, useAuthSwitcher } from "./providers/AuthProvider";
import { UserSwitcher } from "@/temp/UserSwitcher";

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { userId, users } = useAuthSwitcher();
  return (
    <>
      <div className="fixed bottom-2 right-2 z-50">
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
