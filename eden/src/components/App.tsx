import { AuthProvider } from "./providers/AuthProvider";
import { MediaHolder } from "./video/MediaHolder";

function App() {
  return (
    <AuthProvider>
      <MediaHolder />
    </AuthProvider>
  );
}

export default App;
