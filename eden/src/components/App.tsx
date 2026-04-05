import { Projects } from "./projects/Projects";
import { AuthProvider } from "./providers/AuthProvider";

function App() {
  return (
    <AuthProvider>
      <Projects />
    </AuthProvider>
  );
}

export default App;
