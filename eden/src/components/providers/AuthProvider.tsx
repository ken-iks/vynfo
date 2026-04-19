import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext<string>("");

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState("74c25bd8-a7a0-4964-87df-08d6d3aa51d3");
  return <AuthContext.Provider value={userId}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be useed within AuthProvider");
  return ctx;
}
