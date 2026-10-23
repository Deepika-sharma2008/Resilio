
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  AlertTriangle,
  PackageX,
  CalendarClock,
  RefreshCw,
  Search,
  CheckCircle2,
  CircleAlert,
} from "lucide-react";

const API_URL = "/api/reports/inventory";

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function AlertCard({ icon: Icon, title, count, description, color }) {
  const colors = {
    red: "bg-red-50 text-red-700 border-red-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    sage: "bg-[#DCE5D8] text-[#173D35] border-[#CBD8C8]",
  };

  return (
    <div className="rounded-2xl border border-[#E8E5DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[#78877C]">{title}</p>
          <p className="mt-3 text-3xl font-bold text-[#244638]">
            {count}
          </p>
          <p className="mt-2 text-sm text-[#78877C]">{description}</p>
        </div>

        <div className={`rounded-xl border p-3 ${colors[color]}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ children, type }) {
  const styles = {
    danger: "bg-red-50 text-red-700",
    warning: "bg-amber-50 text-amber-700",
    success: "bg-emerald-50 text-emerald-700",
    neutral: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[type] || styles.neutral
      }`}
    >
      {children}
    </span>
  );
}

export default function AlertsPage() {
  const [stockData, setStockData] = useState({
    lowStock: [],
    outOfStock: [],
    summary: {},
  });

  const [expiryData, setExpiryData] = useState({
    expired: [],
    nearExpiry: [],
    expiryUnknown: [],
    summary: {},
  });

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [stockResponse, expiryResponse] = await Promise.all([
        fetch(`${API_URL}/low-stock`),
        fetch(`${API_URL}/expiry?days=7`),
      ]);

      const stockResult = await stockResponse.json();
      const expiryResult = await expiryResponse.json();

      if (!stockResponse.ok || !stockResult.success) {
        throw new Error(
          stockResult.message || "Unable to load stock alerts."
        );
      }

      if (!expiryResponse.ok || !expiryResult.success) {
        throw new Error(
          expiryResult.message || "Unable to load expiry alerts."
        );
      }

      setStockData(stockResult);
      setExpiryData(expiryResult);
    } catch (err) {
      setError(err.message || "Unable to load inventory alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const alerts = useMemo(
    () => [
      ...(stockData.outOfStock || []).map((item) => ({
        ...item,
        alertType: "Out of Stock",
        severity: "Critical",
        category: "stock",
        description: "No stock is currently available.",
      })),

      ...(stockData.lowStock || []).map((item) => ({
        ...item,
        alertType: "Low Stock",
        severity: "Warning",
        category: "stock",
        description: "Available quantity is at or below the minimum level.",
      })),

      ...(expiryData.expired || []).map((item) => ({
        ...item,
        alertType: "Expired",
        severity: "Critical",
        category: "expiry",
        description: "This batch has passed its expiry date.",
      })),

      ...(expiryData.nearExpiry || []).map((item) => ({
        ...item,
        alertType: "Near Expiry",
        severity: "Warning",
        category: "expiry",
        description: "This batch expires within the next 7 days.",
      })),

      ...(expiryData.expiryUnknown || []).map((item) => ({
        ...item,
        alertType: "Expiry Unknown",
        severity: "Warning",
        category: "expiry",
        description: "An expiry date has not been recorded.",
      })),
    ],
    [stockData, expiryData]
  );

  const filteredAlerts = alerts.filter((alert) => {
    const name =
      typeof alert.ingredient === "object"
        ? alert.ingredient?.name
        : alert.name;

    const matchesSearch = [
      name,
      alert.ingredientCode,
      alert.batchCode,
      alert.alertType,
      alert.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "stock" && alert.category === "stock") ||
      (activeFilter === "expiry" && alert.category === "expiry") ||
      (activeFilter === "critical" && alert.severity === "Critical");

    return matchesSearch && matchesFilter;
  });

  function getName(alert) {
    if (alert.ingredient && typeof alert.ingredient === "object") {
      return alert.ingredient.name || "Unknown ingredient";
    }

    return alert.name || "Unknown ingredient";
  }

  function getQuantity(alert) {
    const quantity = alert.currentQuantity ?? alert.quantityRemaining;

    return quantity == null
      ? "—"
      : `${Number(quantity).toLocaleString("en-IN")} ${alert.unit || ""}`;
  }

  function getStatusType(alert) {
    return alert.severity === "Critical" ? "danger" : "warning";
  }

  const criticalCount = alerts.filter(
    (alert) => alert.severity === "Critical"
  ).length;

  const warningCount = alerts.filter(
    (alert) => alert.severity === "Warning"
  ).length;

  return (
    <div className="space-y-6 pb-8 text-[#244638]">
      {/* Page heading */}
      <header className="flex flex-col justify-between gap-5 rounded-2xl border border-[#dfe8d9] bg-gradient-to-r from-[#e3efdf] via-[#f0f4e9] to-[#fff0e5] p-6 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-[#6e8073]">
            <Bell size={17} />
            <span>Inventory Management</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#244638] sm:text-3xl">
            Inventory Alerts
          </h1>

          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#6e8073]">
            Monitor stock shortages and expiry risks before they affect
            restaurant operations.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAlerts}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173D35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245548] disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh Alerts
        </button>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AlertCard
          icon={Bell}
          title="Total Alerts"
          count={alerts.length}
          description="Detected inventory issues"
          color="sage"
        />

        <AlertCard
          icon={PackageX}
          title="Out of Stock"
          count={stockData.summary?.outOfStockCount || 0}
          description="Ingredients unavailable"
          color="red"
        />

        <AlertCard
          icon={AlertTriangle}
          title="Low Stock"
          count={stockData.summary?.lowStockCount || 0}
          description="Restocking may be needed"
          color="amber"
        />

        <AlertCard
          icon={CalendarClock}
          title="Expiry Risks"
          count={
            (expiryData.summary?.expiredCount || 0) +
            (expiryData.summary?.nearExpiryCount || 0)
          }
          description="Expired or expiring within 7 days"
          color="red"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Unable to load alerts</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={loadAlerts}
            className="mt-3 rounded-lg bg-white px-3 py-2 font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {/* Detected issues */}
      <section className="overflow-hidden rounded-2xl border border-[#E8E5DA] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#E8E5DA] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#244638]">
              Detected Issues
            </h2>
            <p className="mt-1 text-sm text-[#78877C]">
              Review each issue and take the appropriate inventory action.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78877C]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search alerts..."
                aria-label="Search alerts"
                className="w-full rounded-xl border border-[#E8E5DA] bg-[#F7F4EC]/50 py-3 pl-9 pr-3 text-sm outline-none transition focus:border-[#52796F] focus:ring-2 focus:ring-[#DCE5D8] sm:w-60"
              />
            </div>

            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
              aria-label="Filter alerts"
              className="rounded-xl border border-[#E8E5DA] bg-white px-3 py-3 text-sm text-[#244638] outline-none focus:border-[#52796F]"
            >
              <option value="all">All alerts</option>
              <option value="stock">Stock alerts</option>
              <option value="expiry">Expiry alerts</option>
              <option value="critical">Critical only</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-[#F7F4EC] text-xs uppercase tracking-wide text-[#78877C]">
              <tr>
                <th className="px-5 py-4 font-semibold">Issue</th>
                <th className="px-5 py-4 font-semibold">Ingredient / Batch</th>
                <th className="px-5 py-4 font-semibold">Available</th>
                <th className="px-5 py-4 font-semibold">Expiry Date</th>
                <th className="px-5 py-4 font-semibold">Severity</th>
                <th className="px-5 py-4 font-semibold">Recommended Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F0EDE5]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-[#78877C]">
                    Loading inventory alerts...
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <CheckCircle2
                      size={28}
                      className="mx-auto mb-2 text-emerald-600"
                    />
                    <p className="font-semibold text-[#244638]">
                      No matching alerts
                    </p>
                    <p className="mt-1 text-sm text-[#78877C]">
                      Try another filter or refresh the data.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert, index) => (
                  <tr
                    key={`${alert.alertType}-${alert._id || alert.batchCode || index}`}
                    className="transition hover:bg-[#FAFBF8]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {alert.severity === "Critical" ? (
                          <CircleAlert
                            size={17}
                            className="shrink-0 text-red-600"
                          />
                        ) : (
                          <AlertTriangle
                            size={17}
                            className="shrink-0 text-amber-600"
                          />
                        )}
                        <span className="font-semibold text-[#35483D]">
                          {alert.alertType}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#78877C]">
                        {alert.description}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#244638]">
                        {getName(alert)}
                      </p>
                      <p className="mt-1 text-xs text-[#78877C]">
                        {alert.batchCode || alert.ingredientCode || "No code"}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-[#35483D]">
                      {getQuantity(alert)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-[#35483D]">
                      {formatDate(alert.expiryDate)}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge type={getStatusType(alert)}>
                        {alert.severity}
                      </StatusBadge>
                    </td>

                    <td className="px-5 py-4 text-[#53645A]">
                      {alert.alertType === "Out of Stock"
                        ? "Restock this ingredient."
                        : alert.alertType === "Low Stock"
                          ? "Check stock and plan replenishment."
                          : alert.alertType === "Expired"
                            ? "Separate the expired batch from usable stock."
                            : alert.alertType === "Near Expiry"
                              ? "Review the batch and use safely before expiry."
                              : "Check the batch record and add its expiry date."}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#E8E5DA] px-5 py-4 text-xs text-[#78877C]">
          <span>{filteredAlerts.length} alert records shown</span>
          <span>{criticalCount} critical</span>
          <span>{warningCount} warnings</span>
          <span>Expiry window: 7 days</span>
        </div>
      </section>

    </div>
  );
}
