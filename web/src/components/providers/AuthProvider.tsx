import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { usersClient } from "@/lib/client";
import { auth, provider } from "@/firebase";
import type { User } from "@/gen/proto/v1/users_pb";

interface AuthContextValue {
  userId: string;
  appUser: User | undefined;
  loading: boolean;
  signedIn: boolean;
  needsOnboarding: boolean;
  authError: string;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [appUser, setAppUser] = useState<User | undefined>();
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [loadingMe, setLoadingMe] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [authError, setAuthError] = useState("");

  const refreshMe = useCallback(async () => {
    setLoadingMe(true);
    setAuthError("");
    try {
      const me = await usersClient.getMe({});
      setAppUser(me.user);
      setNeedsOnboarding(me.needsOnboarding);
    } catch (err) {
      setAppUser(undefined);
      setAuthError(
        err instanceof Error ? err.message : "Failed to load current user",
      );
      throw err;
    } finally {
      setLoadingMe(false);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, provider);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut(auth);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser === null) {
        setSignedIn(false);
        setFirebaseReady(true);
        setAppUser(undefined);
        setNeedsOnboarding(false);
        setAuthError("");
        return;
      }
      setLoadingMe(true);
      setSignedIn(true);
      setFirebaseReady(true);
      refreshMe().catch((err) => {
        console.error("failed to load current user", err);
        setLoadingMe(false);
      });
    });
  }, [refreshMe]);

  const loading = !firebaseReady || loadingMe;

  return (
    <AuthContext.Provider
      value={{
        userId: appUser?.userId ?? "",
        appUser,
        loading,
        signedIn,
        needsOnboarding,
        authError,
        signInWithGoogle,
        signOut: handleSignOut,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): string {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  if (!ctx.userId) throw new Error("useAuth: no user selected");
  return ctx.userId;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
