import { useAuthContext } from "@/components/providers/AuthProvider";
import { LandingPage } from "@/landing-page/LandingPage";
import { useNavigate } from "react-router";

export function SignIn() {
  const { signInWithGoogle } = useAuthContext();
  const navigate = useNavigate();

  const handleSignIn = async () => {
    await signInWithGoogle();
    navigate("/projects", { replace: true });
  };

  return <LandingPage onSignIn={handleSignIn} />;
}
