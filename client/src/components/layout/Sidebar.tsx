import {
  LayoutDashboard,
  RefreshCw,
  CircleCheckBig,
  ScrollText,
  BarChart3,
  SlidersHorizontal,
  ShieldCheck,
  X,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  /** Route this item links to. Omitted for sections not yet built (shown as "Soon"). */
  to?: string;
  /**
   * Extra paths (in addition to `to`) that should also highlight this
   * item as active — e.g. a detail route reached by clicking a row on
   * the list route it belongs to.
   */
  activeMatch?: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Revenue War Room", icon: LayoutDashboard, to: "/" },
  {
    label: "Recovery Queue",
    icon: RefreshCw,
    to: "/recovery-queue",
    activeMatch: (pathname) => pathname.startsWith("/playbooks/"),
  },
  { label: "Approvals", icon: CircleCheckBig, to: "/approvals" },
  { label: "Audit Ledger", icon: ScrollText, to: "/audit-ledger" },
  { label: "Analytics", icon: BarChart3, to: "/analytics" },
  { label: "Policies", icon: SlidersHorizontal, to: "/policies" },
];

function SidebarContent() {
  const { pathname } = useLocation();
  const closeMobileNav = useUIStore((s) => s.closeMobileNav);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="size-4.5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">RevPilot</p>
          <p className="text-[11px] text-muted-foreground">Revenue Operations</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          if (item.to) {
            const isActive =
              pathname === item.to ||
              (item.to !== "/" && pathname.startsWith(item.to)) ||
              Boolean(item.activeMatch?.(pathname));
            return (
              <NavLink
                key={item.label}
                to={item.to}
                onClick={closeMobileNav}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </NavLink>
            );
          }
          return (
            <div
              key={item.label}
              aria-disabled="true"
              className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground/60"
            >
              <span className="flex items-center gap-3">
                <Icon className="size-4" />
                {item.label}
              </span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Detect. Decide. Recover. Automated revenue recovery for
          Razorpay merchants.
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const isMobileNavOpen = useUIStore((s) => s.isMobileNavOpen);
  const closeMobileNav = useUIStore((s) => s.closeMobileNav);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          isMobileNavOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity",
            isMobileNavOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={closeMobileNav}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-64 border-r border-border bg-card transition-transform",
            isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex justify-end px-3 pt-3">
            <button
              type="button"
              onClick={closeMobileNav}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </button>
          </div>
          <SidebarContent />
        </aside>
      </div>
    </>
  );
}