import { ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { ShieldCheck } from "lucide-react";
import { LoginPage } from "@/pages/LoginPage";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Reusable protected-route wrapper.
 *
 * Loading         -> render a small branded loading state while Clerk
 *   initializes, instead of a blank white screen (Phase 12 polish —
 *   this used to `return null` here).
 * Unauthenticated -> render RevPilot's own branded LoginPage in place
 *   (no redirect to a hosted Clerk page — this app has no separate
 *   route to redirect to, so the SPA's single screen just swaps
 *   between LoginPage and the authenticated app shell).
 * Authenticated   -> render children (Phase 8: the app shell wrapping
 *   the Revenue War Room).
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <div className="flex size-9 animate-pulse items-center justify-center rounded-md bg-foreground text-background">
          <ShieldCheck className="size-5" />
        </div>
        <p className="text-sm text-muted-foreground">Loading RevPilot…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return <LoginPage />;
  }

  return <>{children}</>;
}