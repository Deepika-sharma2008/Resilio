import { useCallback, useEffect, useState } from "react";

import {
  LayoutDashboard,
  Carrot,
  Layers3,
  Truck,
  ArrowLeftRight,
  ClipboardList,
  ChartNoAxesCombined,
  Bell,
  ShieldCheck,
  Settings,
  LogOut,
  Search,
  Menu,
  X,
  ChevronDown,
  Leaf,
} from "lucide-react";

import "./App.css";
import LoginPage from "./LoginPage.jsx";
import DashboardPage from "./DashboardPage.jsx";
import IngredientsPage from "./IngredientsPage.jsx";
import SuppliersPage from "./SuppliersPage.jsx";
import StockQuantityPage from "./StockQuantityPage.jsx";
import StockBatchesPage from "./StockBatchesPage.jsx";
import StockMovementsPage from "./StockMovementsPage.jsx";
import InventoryReportsPage from "./InventoryReportsPage.jsx";
import SelfHealingMonitor from "./pages/SelfHealingMonitor.jsx";

import AlertsPage from "./AlertsPage.jsx";

import OfflineInventoryRecovery from "./OfflineInventoryRecovery.jsx";


const API_URL = "/api";

const navigationGroups = [
  {
    title: "MAIN",
    items: [{ name: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "INVENTORY MANAGEMENT",
    items: [
      { name: "Ingredients", icon: Carrot },
      { name: "Stock Batches", icon: Layers3 },
      { name: "Suppliers", icon: Truck },
      { name: "Stock Movement", icon: ArrowLeftRight },
      { name: "Stock Quantity", icon: ClipboardList },
    ],
  },
  {
    title: "MONITORING & ANALYSIS",
    items: [
      { name: "Reports", icon: ChartNoAxesCombined },
      { name: "Alerts", icon: Bell },
      { name: "Self-Healing Monitor", icon: ShieldCheck },
      { name: "Settings", icon: Settings },
    ],
  },
];

const descriptions = {
  Dashboard: "Overview of your restaurant inventory.",
  Ingredients: "Manage your restaurant ingredients.",
  "Stock Batches": "Track stock batches, costs and expiry dates.",
  Suppliers: "Manage your ingredient suppliers.",
  "Stock Movement": "Track stock received and stock issued.",
  "Stock Quantity": "View available quantities and stock status.",
  Reports: "Review inventory reports and stock summaries.",
  Alerts: "Monitor low-stock and expiry alerts.",
  "Self-Healing Monitor":
    "Monitor detected failures and recovery activity.",
  Settings: "Manage your Resilio application settings.",
};

function ComingSoon({ title }) {
  return (
    <div className="rounded-xl border border-[#E6E3DA] bg-white p-8 sm:p-10">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#DCE5D8] text-[#173D35]">
        <Layers3 size={23} />
      </div>

      <h2 className="text-xl font-semibold text-[#173D35]">{title}</h2>

      <p className="mt-2 max-w-lg text-sm leading-6 text-[#78877C]">
        {descriptions[title]}
      </p>

      <p className="mt-5 text-xs text-[#78877C]">
        This page has not been connected to its functionality yet.
      </p>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authError, setAuthError] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  const [activePage, setActivePage] = useState("Dashboard");
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Ask the backend whether the browser has a valid admin session.
  const checkSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        setIsAuthenticated(false);
        setAdminEmail("");
        return false;
      }

      const result = await response.json();

      if (result.success && result.isAdmin) {
        setIsAuthenticated(true);
        setAdminEmail(result.admin?.email || "");
        return true;
      }

      setIsAuthenticated(false);
      setAdminEmail("");
      return false;
    } catch {
      setIsAuthenticated(false);
      setAdminEmail("");
      setAuthError(
        "Unable to connect to Resilio. Make sure the backend is running."
      );
      return false;
    }
  }, []);

  // Check the session when the application opens.
  useEffect(() => {
    let active = true;

    async function initializeAuth() {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
        });

        if (!active) return;

        if (!response.ok) {
          setIsAuthenticated(false);
          setAdminEmail("");
          return;
        }

        const result = await response.json();

        if (!active) return;

        if (result.success && result.isAdmin) {
          setIsAuthenticated(true);
          setAdminEmail(result.admin?.email || "");
        } else {
          setIsAuthenticated(false);
          setAdminEmail("");
        }
      } catch {
        if (active) {
          setIsAuthenticated(false);
          setAdminEmail("");
          setAuthError(
            "Unable to connect to Resilio. Make sure the backend is running."
          );
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    initializeAuth();

    return () => {
      active = false;
    };
  }, []);

  // Called by LoginPage after the login API succeeds.
  async function handleLogin() {
    setAuthError("");

    const authenticated = await checkSession();

    if (!authenticated) {
      throw new Error(
        "Login was submitted, but the admin session could not be verified. Please try again."
      );
    }

    setActivePage("Dashboard");
    setDashboardData(null);
    setError("");
  }

  // Load dashboard information using the authenticated session cookie.
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/dashboard/inventory`, {
        credentials: "include",
      });

      if (response.status === 401) {
        setIsAuthenticated(false);
        setAdminEmail("");
        setDashboardData(null);
        setError("Your session has expired. Please log in again.");
        return;
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to load dashboard information."
        );
      }

      setDashboardData(result.data);
    } catch (err) {
      setError(
        err.message ||
        "Unable to connect to the backend. Check whether your server is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch the dashboard only after authentication is confirmed.
  useEffect(() => {
    if (isAuthenticated) {
      loadDashboard();
    }
  }, [isAuthenticated, loadDashboard]);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setAuthError("");

    try {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "Unable to log out.");
      }

      setIsAuthenticated(false);
      setAdminEmail("");
      setActivePage("Dashboard");
      setDashboardData(null);
      setError("");
      setSidebarOpen(false);
      setProfileOpen(false);
      setSearchText("");
    } catch (err) {
      setAuthError(
        err.message || "Unable to log out. Please try again."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  function navigateTo(page) {
    setActivePage(page);
    setSidebarOpen(false);
    setProfileOpen(false);

    if (page === "Dashboard") {
      loadDashboard();
    }
  }

  function renderPage() {
    switch (activePage) {
      case "Dashboard":
        return (
          <DashboardPage
            data={dashboardData}
            loading={loading}
            error={error}
            onRefresh={loadDashboard}
            onNavigate={navigateTo}
          />
        );

      case "Ingredients":
        return <IngredientsPage />;

      case "Suppliers":
        return <SuppliersPage />;

      case "Stock Batches":
        return <StockBatchesPage />;

      case "Stock Movement":
        return <StockMovementsPage />;

      case "Stock Quantity":
        return <StockQuantityPage />;

      case "Reports":
        return <InventoryReportsPage />;

      case "Alerts":
        return <AlertsPage />;
      case "Self-Healing Monitor":
        return (
          <SelfHealingMonitor onNavigate={navigateTo}/>
        );

      case "Offline Inventory Recovery":
        return <OfflineInventoryRecovery />;

      default:
        return <ComingSoon title={activePage} />;
    }
  }

  // Keep the dashboard hidden while checking the server session.
  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F4EC] px-5">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#173D35] text-white">
            <Leaf size={27} />
          </div>
          <h1 className="mt-4 font-serif text-3xl font-semibold text-[#173D35]">
            resilio
          </h1>
          <p className="mt-3 text-sm text-[#78877C]">
            Checking your admin session...
          </p>
        </div>
      </div>
    );
  }

  // Only render the login screen when the backend has not authenticated us.
  if (!isAuthenticated) {
    return (
      <div>
        {authError && (
          <div
            role="alert"
            className="mx-auto max-w-xl border-b border-[#E8C9C2] bg-[#FBEEEA] px-5 py-3 text-sm text-[#9D4538]"
          >
            {authError}
          </div>
        )}

        <LoginPage onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EC] text-[#173D35]">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[255px] flex-col border-r border-[#E6E3DA] bg-[#FFFEFA] transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-[#E6E3DA] px-5 py-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#173D35] text-white">
            <Leaf size={23} />
          </div>

          <div className="flex-1">
            <h1 className="font-serif text-[27px] font-semibold leading-7 tracking-tight">
              resilio
            </h1>
            <p className="mt-1 text-[9px] font-bold tracking-[1.5px] text-[#78877C]">
              SMART INVENTORY
            </p>
          </div>

          <button
            type="button"
            aria-label="Close sidebar"
            className="rounded-lg p-2 text-[#78877C] hover:bg-[#F0F3ED] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {navigationGroups.map((group) => (
            <div key={group.title} className="mb-6">
              <p className="mb-2 px-3 text-[10px] font-bold tracking-[1px] text-[#899187]">
                {group.title}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.name;

                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => navigateTo(item.name)}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors ${active
                          ? "bg-[#173D35] font-semibold text-white"
                          : "text-[#647269] hover:bg-[#F0F3ED] hover:text-[#173D35]"
                        }`}
                    >
                      <Icon size={19} strokeWidth={1.8} />
                      <span className="flex-1">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom sidebar */}
        <div className="border-t border-[#E6E3DA] p-3">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#DCE5D8] p-3">
            <ShieldCheck size={20} className="shrink-0" />

            <div>
              <p className="text-[11px] font-semibold">
                Resilio Protection
              </p>
              <p className="mt-1 text-[10px] text-[#69796C]">
                Inventory monitoring
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[13px] text-[#786C65] transition-colors hover:bg-[#F8EEEB] hover:text-[#A34D3E] disabled:opacity-60"
          >
            <LogOut size={19} />
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="min-h-screen lg:ml-[255px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex min-h-[88px] items-center justify-between gap-4 border-b border-[#E6E3DA] bg-[#FFFEFA] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              className="rounded-lg p-2 hover:bg-[#F0F3ED] lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>

            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold">
                {activePage}
              </h2>
              <p className="mt-1 hidden text-xs text-[#78877C] sm:block">
                {descriptions[activePage]}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {/* Search input */}
            <label className="hidden h-10 w-48 items-center gap-2 rounded-lg border border-[#E6E3DA] bg-white px-3 text-[#78877C] md:flex">
              <Search size={17} />
              <input
                type="search"
                aria-label="Search"
                placeholder="Search..."
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="w-full min-w-0 bg-transparent text-xs text-[#173D35] outline-none placeholder:text-[#9AA39A]"
              />
            </label>

            {/* Notifications */}
            <button
              type="button"
              aria-label="Open alerts"
              title="Alerts"
              onClick={() => navigateTo("Alerts")}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-[#E6E3DA] bg-white text-[#52685A] hover:bg-[#F0F3ED]"
            >
              <Bell size={19} />
            </button>

            {/* Admin profile */}
            <div className="relative">
              <button
                type="button"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-[#F0F3ED] sm:gap-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DCE5D8] text-sm font-semibold">
                  A
                </div>

                <div className="hidden text-left sm:block">
                  <p className="text-xs font-semibold">Admin</p>
                  <p className="mt-1 max-w-40 truncate text-[10px] text-[#78877C]">
                    {adminEmail || "Administrator"}
                  </p>
                </div>

                <ChevronDown size={15} className="hidden sm:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 overflow-hidden rounded-xl border border-[#E6E3DA] bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => navigateTo("Settings")}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[#F0F3ED]"
                  >
                    <Settings size={17} />
                    Settings
                  </button>

                  <button
                    type="button"
                    disabled={loggingOut}
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[#A34D3E] hover:bg-[#F8EEEB] disabled:opacity-60"
                  >
                    <LogOut size={17} />
                    {loggingOut ? "Logging out..." : "Logout"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Selected page */}
        <main className="p-4 sm:p-6 lg:p-8">
          {authError && (
            <div
              role="alert"
              className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#E8C9C2] bg-[#FBEEEA] px-4 py-3 text-sm text-[#9D4538]"
            >
              <span>{authError}</span>
              <button
                type="button"
                onClick={() => setAuthError("")}
                aria-label="Dismiss error"
              >
                <X size={17} />
              </button>
            </div>
          )}

          {renderPage()}
        </main>
      </div>
    </div>
  );
}

