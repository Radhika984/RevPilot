import { Menu } from "lucide-react";
import { UserButton, useUser } from "@clerk/react";
import { useUIStore } from "@/store/uiStore";

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  const openMobileNav = useUIStore((s) => s.openMobileNav);
  const { user, isLoaded } = useUser();

  const displayName =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || "";

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:px-6">
      <button
        type="button"
        onClick={openMobileNav}
        className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      <h1 className="text-base font-semibold text-foreground">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        {isLoaded && displayName ? (
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {displayName}
          </span>
        ) : null}
        {/* No afterSignOutUrl prop on this Clerk version — sign-out is
            handled entirely client-side: once the session clears,
            ProtectedRoute's isSignedIn check re-renders LoginPage
            automatically, so no explicit redirect target is needed. */}
        <UserButton />
      </div>
    </header>
  );
}
