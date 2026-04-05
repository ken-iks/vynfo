import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext<string>("");

export function AuthProvider({ children } : { children: React.ReactNode }) {
    const [userId, setUserId] = useState("d322efef-cb5f-4cb8-9dc7-92e5500265fe");
    return (
        <AuthContext.Provider value={ userId }>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be useed within AuthProvider");
    return ctx
}
