import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthContext } from "@/components/providers/AuthProvider";

export function SignIn() {
  const { signInWithGoogle } = useAuthContext();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Vynfo</CardTitle>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={signInWithGoogle}>
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
