import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersClient } from "@/lib/client";
import { useAuthContext } from "@/components/providers/AuthProvider";

export function CompleteOnboarding() {
  const { refreshMe, signOut } = useAuthContext();
  const [displayName, setDisplayName] = useState("");
  const [displayPhoto, setDisplayPhoto] = useState<File | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!displayName.trim() || !displayPhoto) return;

    setSubmitting(true);
    setError("");
    try {
      await usersClient.completeOnboarding({
        displayName: displayName.trim(),
        displayPhoto: new Uint8Array(await displayPhoto.arrayBuffer()),
      });
      await refreshMe();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to complete signup",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Complete sign up</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Ken"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="display-photo">Display photo</Label>
              <Input
                id="display-photo"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  setDisplayPhoto(event.currentTarget.files?.[0]);
                }}
                required
              />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                type="submit"
                disabled={submitting || !displayName.trim() || !displayPhoto}
              >
                {submitting ? "Saving..." : "Continue"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={signOut}
              >
                Sign out
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
