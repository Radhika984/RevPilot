import { ReactNode } from "react";
import { useAuth, RedirectToSignIn } from "@clerk/react";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Reusable protected-route wrapper.
 *
 * Unauthenticated -> redirect to Clerk sign-in.
 * Authenticated   -> render children (the empty RevPilot shell).
 *
 * Intentionally has no dashboard/business logic — Phase 2 scope is
 * limited to the gate itself.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    // Avoid a flash of the sign-in redirect while Clerk is initializing.
    return null;
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  return <>{children}</>;
}