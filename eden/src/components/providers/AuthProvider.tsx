import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usersClient } from "@/lib/client";
import type { User } from "@/gen/proto/v1/users_pb";

const STORAGE_KEY = "vynfo:dev:userId";

interface AuthContextValue {
  userId: string;
  setUserId: (id: string) => void;
  users: User[];
  refreshUsers: () => Promise<User[]>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? "",
  );
  const [users, setUsers] = useState<User[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refreshUsers = useCallback(async () => {
    const res = await usersClient.listUsers({});
    setUsers(res.users);
    return res.users;
  }, []);

  const setUserId = useCallback((id: string) => {
    setUserIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    refreshUsers()
      .then((list) => {
        const stored = localStorage.getItem(STORAGE_KEY) ?? "";
        const stillExists = stored && list.some((u) => u.userId === stored);
        if (!stillExists) {
          setUserId(list[0]?.userId ?? "");
        }
      })
      .catch((err) => {
        console.error("failed to load users", err);
      })
      .finally(() => setLoaded(true));
  }, [refreshUsers, setUserId]);

  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{ userId, setUserId, users, refreshUsers }}>
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

export function useAuthSwitcher(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthSwitcher must be used within AuthProvider");
  return ctx;
}
