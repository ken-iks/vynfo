import { useAuthContext } from "@/components/providers/AuthProvider";
import { LandingPage } from "@/landing-page/LandingPage";

export function SignIn() {
  const { signInWithGoogle } = useAuthContext();

  return <LandingPage onSignIn={signInWithGoogle} />;
}
