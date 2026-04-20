import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext<string>("");

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState("de69d837-47f5-4b4d-8433-565259e8f9f6");
  return <AuthContext.Provider value={userId}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be useed within AuthProvider");
  return ctx;
}
