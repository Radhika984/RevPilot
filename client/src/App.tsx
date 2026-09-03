import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/protected-route/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { RevenueWarRoom } from "@/pages/RevenueWarRoom";
import { RecoveryQueue } from "@/pages/RecoveryQueue";
import { Playbooks } from "@/pages/Playbooks";
import { Approvals } from "@/pages/Approvals";
import { AuditLedger } from "@/pages/AuditLedger";
import { Analytics } from "@/pages/Analytics";
import { MerchantPolicies } from "@/pages/MerchantPolicies";
import { NotFound } from "@/pages/NotFound";

/**
 * RevPilot now has seven authenticated screens (Phase 11 adds Recovery
 * Analytics and Merchant Policies alongside Phase 8-10's Revenue War
 * Room, Recovery Queue, Playbook Detail timeline, Approval Inbox, and
 * Audit Ledger). ProtectedRoute still gates all of them the same way
 * it gated the single screen before: unauthenticated visitors see
 * LoginPage regardless of path, authenticated merchants get the
 * router.
 */
function App() {
  return (
    <ProtectedRoute>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <AppShell title="Revenue War Room">
                <RevenueWarRoom />
              </AppShell>
            }
          />
          <Route
            path="/recovery-queue"
            element={
              <AppShell title="Recovery Queue">
                <RecoveryQueue />
              </AppShell>
            }
          />
          <Route
            path="/playbooks/:id"
            element={
              <AppShell title="Playbook Detail">
                <Playbooks />
              </AppShell>
            }
          />
          <Route
            path="/approvals"
            element={
              <AppShell title="Approval Inbox">
                <Approvals />
              </AppShell>
            }
          />
          <Route
            path="/audit-ledger"
            element={
              <AppShell title="Audit Ledger">
                <AuditLedger />
              </AppShell>
            }
          />
          <Route
            path="/analytics"
            element={
              <AppShell title="Recovery Analytics">
                <Analytics />
              </AppShell>
            }
          />
          <Route
            path="/policies"
            element={
              <AppShell title="Merchant Policies">
                <MerchantPolicies />
              </AppShell>
            }
          />
          <Route
            path="*"
            element={
              <AppShell title="Not Found">
                <NotFound />
              </AppShell>
            }
          />
        </Routes>
      </BrowserRouter>
    </ProtectedRoute>
  );
}

export default App;