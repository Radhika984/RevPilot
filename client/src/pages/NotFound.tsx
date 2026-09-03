import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Phase 12 polish: App.tsx previously had no catch-all route, so any
 * unmatched path under the authenticated shell (a stale bookmark, a
 * mistyped /playbooks/:id, a link copied from an old build) rendered
 * nothing at all. This is that missing error state, styled to match
 * the rest of the app rather than the browser's blank default.
 */
export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Compass className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">Page not found</p>
        <p className="text-sm text-muted-foreground">
          That page doesn't exist, or the link may be out of date.
        </p>
      </div>
      <Button asChild size="sm">
        <Link to="/">Back to Revenue War Room</Link>
      </Button>
    </div>
  );
}