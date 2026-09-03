import { create } from "zustand";

/**
 * Pure UI state only — no business/revenue data lives here. Server
 * data (revenue summary, at-risk, recovered) is owned by TanStack
 * Query (see src/hooks/useRevenue.ts), which already handles caching,
 * loading and error state far better than a manual store would.
 */
interface UIState {
  isMobileNavOpen: boolean;
  isSidebarCollapsed: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleSidebarCollapsed: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isMobileNavOpen: false,
  isSidebarCollapsed: false,
  openMobileNav: () => set({ isMobileNavOpen: true }),
  closeMobileNav: () => set({ isMobileNavOpen: false }),
  toggleSidebarCollapsed: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));
