import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { ProtectedRoute } from "./components/protected-route/ProtectedRoute";

function ApiMeFetcher() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) return;

    const fetchMe = async () => {
      try {
        const token = await getToken();
        if (!token) {
          console.error("Verification: No token obtained from Clerk");
          return;
        }

        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
        const response = await fetch(`${apiUrl}/api/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log(`[Verification] GET /api/me response status: ${response.status}`);
        if (response.status === 200) {
          const data = await response.json();
          console.log("[Verification] GET /api/me 200 OK data:", data);
        } else if (response.status === 404) {
          const data = await response.json().catch(() => ({}));
          console.log("[Verification] GET /api/me 404 Merchant Not Found:", data);
        } else {
          const text = await response.text();
          console.error(`[Verification] GET /api/me ${response.status} Error:`, text);
        }
      } catch (err) {
        console.error("[Verification] GET /api/me failed:", err);
      }
    };

    fetchMe();
  }, [getToken, isSignedIn]);

  return null;
}

function App() {
  return (
    <ProtectedRoute>
      <ApiMeFetcher />
      <div className="min-h-screen bg-background" />
    </ProtectedRoute>
  );
}

export default App;