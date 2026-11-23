"use client";
import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/types";

const UserContext = createContext<SessionUser | null>(null);

export const UserProvider = UserContext.Provider;

/** The signed-in admin. Only available below the dashboard layout. */
export function useUser(): SessionUser {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser must be used inside the dashboard layout");
  return user;
}
