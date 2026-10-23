
import { useCallback, useEffect, useState } from "react";
import {
  Package,
  AlertTriangle,
  CalendarClock,
  Truck,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  LoaderCircle,
  ShieldCheck,
  PackageX,
  Activity,
  CircleAlert,
  CheckCircle2,
  ArrowRight,
  Boxes,
  Leaf,
} from "lucide-react";

const API_URL = "/api/dashboard/inventory";

const styles = {
  card: "rounded-2xl border border-[#dfe8d9] bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-6",
  muted: "text-sm text-[#718078]",
  subtle: "text-xs text-[#89958c]",
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function getName(item) {
  if (typeof item?.ingredient === "object") {
    return item.ingredient?.name || "Unknown ingredient";
  }

  return item?.name || item?.ingredientId?.name || "Unknown ingredient";
}

function StatCard({ title, value, description, icon: Icon, tone }) {
  const tones = {
    green: "bg-[#e8f3e8] text-[#356c45]",
    amber: "bg-[#fff1dd] text-[#a96a22]",
    red: "bg-[#f9e9e4] text-[#ad5a43]",
    purple: "bg-[#f1eaf8] text-[#7855a2]",
    blue: "bg-[#eef1f8] text-[#566a96]",
  };

  return (
    <div className="h-full rounded-2xl border border-[#dfe8d9] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#718078]">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#244638]">
            {formatNumber(value)}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#89958c]">
            {description}
          </p>
        </div>

        <div className={`shrink-0 rounded-xl p-3 ${tones[tone] || tones.green}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ title, description, icon: Icon }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="rounded-xl border border-[#dfe8d9] bg-[#edf3eb] p-2.5 text-[#426c56]">
        <Icon size={19} />
      </div>
      <div>
        <h2 className="font-semibold text-[#244638]">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[#89958c]">
          {description}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-[#dfe8d9] bg-[#fafbf7] px-4 py-7 text-center text-sm text-[#89958c]">
      {children}
    </div>
  );
}

function HealthBar({ label, count, total, color, background }) {
  const percentage =
    total > 0 ? Math.min((count / total) * 100, 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#53645a]">{label}</span>
        <span className="text-sm font-semibold text-[#244638]">
          {formatNumber(count)}
        </span>
      </div>

      <div
        className={`h-2.5 overflow-hidden rounded-full ${background}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={count}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ActionLink({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="mt-4 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[#426c56] transition hover:text-[#173d35] focus:outline-none focus:ring-2 focus:ring-[#b8cfb5]"
    >
      {children}
      <ArrowRight size={15} />
    </button>
  );
}

export default function DashboardPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL);
      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message || "Unable to load dashboard information."
        );
      }

      setData(result);
    } catch (err) {
      setError(err.message || "Could not connect to the dashboard API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const summary = data?.summary || {};
  const lowStock = data?.lowStockIngredients || [];
  const outOfStock = data?.outOfStockIngredients || [];
  const movements = data?.recentMovements || [];
  const alerts = data?.recentAlerts || [];
  const expiry = data?.expiryWarnings || {};

  const expired = expiry.expiredBatches || [];
  const nearExpiry = expiry.nearExpiryBatches || [];
  const unknownExpiry = expiry.expiryUnknownBatches || [];

  const totalIngredients = Number(summary.activeIngredientCount || 0);
  const lowCount = Number(summary.lowStockCount ?? lowStock.length);
  const outCount = Number(summary.outOfStockCount ?? outOfStock.length);

  const healthyCount = Math.max(
    totalIngredients - lowCount - outCount,
    0
  );

  const expiryCount =
    Number(summary.expiredBatchCount ?? expired.length) +
    Number(summary.nearExpiryBatchCount ?? nearExpiry.length) +
    Number(summary.expiryUnknownBatchCount ?? unknownExpiry.length);

  const totalHealthItems = healthyCount + lowCount + outCount;

  const expiryItems = [
    ...expired.map((item) => ({
      ...item,
      statusLabel: "Expired",
      tone: "red",
    })),
    ...nearExpiry.map((item) => ({
      ...item,
      statusLabel: "Expiring soon",
      tone: "amber",
    })),
    ...unknownExpiry.map((item) => ({
      ...item,
      statusLabel: "Expiry unknown",
      tone: "purple",
    })),
  ];

  const openAlerts = alerts.filter(
    (item) =>
      !["resolved", "closed"].includes(
        String(item.status || "").toLowerCase()
      )
  );

  function goTo(page) {
    if (onNavigate) onNavigate(page);
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[320px] items-center justify-center gap-3 text-sm text-[#718078]">
        <LoaderCircle size={22} className="animate-spin" />
        Loading Resilio dashboard...
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Dashboard heading */}
      <header className="flex flex-col justify-between gap-5 rounded-2xl border border-[#dfe8d9] bg-gradient-to-r from-[#e3efdf] via-[#f0f4e9] to-[#fff0e5] p-6 sm:flex-row sm:items-center sm:p-7">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#6e8073]">
            <Leaf size={15} />
            <span>Inventory Management</span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-[#244638] sm:text-4xl">
            Dashboard
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-[#718078]">
            Monitor restaurant stock, track expiry risks, and identify
            inventory issues from one place.
          </p>
        </div>

        <button
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#244638] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#315b48] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh dashboard
        </button>
      </header>

      {/* API error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <CircleAlert size={19} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">
                Dashboard data could not be loaded
              </p>
              <p className="mt-1">{error}</p>
              <button
                onClick={loadDashboard}
                className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 font-medium transition hover:bg-red-50"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main status cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total ingredients"
          value={summary.activeIngredientCount}
          description="Active ingredients registered"
          icon={Package}
          tone="green"
        />

        <StatCard
          title="Low stock"
          value={lowCount}
          description="At or below minimum stock"
          icon={AlertTriangle}
          tone="amber"
        />

        <StatCard
          title="Out of stock"
          value={outCount}
          description="No available stock"
          icon={PackageX}
          tone="red"
        />

        <StatCard
          title="Expiry risks"
          value={expiryCount}
          description="Expired, upcoming or unknown"
          icon={CalendarClock}
          tone="purple"
        />
      </div>

      {/* Stock health + quick actions */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className={`${styles.card} xl:col-span-3`}>
          <SectionHeading
            title="Stock health"
            description="How your registered ingredients are doing"
            icon={Activity}
          />

          <div className="space-y-5">
            <HealthBar
              label="Healthy stock"
              count={healthyCount}
              total={totalHealthItems}
              color="bg-[#5b8c68]"
              background="bg-[#e8f3e8]"
            />

            <HealthBar
              label="Low stock"
              count={lowCount}
              total={totalHealthItems}
              color="bg-[#d9a04a]"
              background="bg-[#fff1dd]"
            />

            <HealthBar
              label="Out of stock"
              count={outCount}
              total={totalHealthItems}
              color="bg-[#c86e57]"
              background="bg-[#f9e9e4]"
            />
          </div>

          <div className="mt-5 rounded-xl border border-[#e8eee3] bg-[#f7f8f3] p-3 text-xs leading-5 text-[#718078]">
            <strong className="text-[#244638]">How to read this:</strong>{" "}
            Green means healthy stock, amber means low stock, and red means
            stock is unavailable.
          </div>

          {totalIngredients === 0 && (
            <p className="mt-3 text-xs text-[#89958c]">
              Stock health will become meaningful after ingredients are
              registered.
            </p>
          )}
        </div>

        <div className={`${styles.card} xl:col-span-2`}>
          <SectionHeading
            title="Quick actions"
            description="Go directly to the task you need"
            icon={Boxes}
          />

          <div className="space-y-3">
            <button
              onClick={() => goTo("Ingredients")}
              className="flex w-full items-center gap-3 rounded-xl border border-[#e5e8df] p-3 text-left transition hover:border-[#cbdac7] hover:bg-[#f7f8f3]"
            >
              <span className="rounded-lg bg-[#e8f3e8] p-2.5 text-[#356c45]">
                <Package size={19} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-[#244638]">
                  Manage ingredients
                </span>
                <span className="mt-1 block text-xs text-[#89958c]">
                  Add or update ingredient records
                </span>
              </span>
              <ArrowRight size={16} className="text-[#89958c]" />
            </button>

            <button
              onClick={() => goTo("Stock Batches")}
              className="flex w-full items-center gap-3 rounded-xl border border-[#e5e8df] p-3 text-left transition hover:border-[#cbdac7] hover:bg-[#f7f8f3]"
            >
              <span className="rounded-lg bg-[#eef1f8] p-2.5 text-[#566a96]">
                <Truck size={19} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-[#244638]">
                  View stock batches
                </span>
                <span className="mt-1 block text-xs text-[#89958c]">
                  Check batch and expiry details
                </span>
              </span>
              <ArrowRight size={16} className="text-[#89958c]" />
            </button>

            <button
              onClick={() => goTo("Stock Movement")}
              className="flex w-full items-center gap-3 rounded-xl border border-[#e5e8df] p-3 text-left transition hover:border-[#cbdac7] hover:bg-[#f7f8f3]"
            >
              <span className="rounded-lg bg-[#fff1dd] p-2.5 text-[#a96a22]">
                <ArrowDownToLine size={19} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-[#244638]">
                  Stock movements
                </span>
                <span className="mt-1 block text-xs text-[#89958c]">
                  Review stock-in and stock-out records
                </span>
              </span>
              <ArrowRight size={16} className="text-[#89958c]" />
            </button>

            <button
              onClick={() => goTo("Alerts")}
              className="flex w-full items-center gap-3 rounded-xl border border-[#e5e8df] p-3 text-left transition hover:border-[#cbdac7] hover:bg-[#f7f8f3]"
            >
              <span className="rounded-lg bg-[#f9e9e4] p-2.5 text-[#ad5a43]">
                <CircleAlert size={19} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-[#244638]">
                  Review alerts
                </span>
                <span className="mt-1 block text-xs text-[#89958c]">
                  Investigate inventory problems
                </span>
              </span>
              <ArrowRight size={16} className="text-[#89958c]" />
            </button>
          </div>
        </div>
      </div>

      {/* Stock shortages + expiry monitoring */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className={styles.card}>
          <SectionHeading
            title="Needs attention"
            description="Ingredients with stock shortages"
            icon={AlertTriangle}
          />

          {lowStock.length === 0 && outOfStock.length === 0 ? (
            <EmptyState>
              <CheckCircle2
                size={24}
                className="mx-auto mb-2 text-[#5b8c68]"
              />
              No stock shortage records found.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {[
                ...outOfStock.map((item) => ({
                  ...item,
                  displayStatus: "Out of stock",
                  isCritical: true,
                })),
                ...lowStock.map((item) => ({
                  ...item,
                  displayStatus: "Low stock",
                  isCritical: false,
                })),
              ]
                .slice(0, 6)
                .map((item, index) => (
                  <div
                    key={item._id || item.ingredientCode || index}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#eee9df] bg-[#faf9f4] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#244638]">
                        {item.name || "Unknown ingredient"}
                      </p>
                      <p className="mt-1 text-xs text-[#89958c]">
                        Minimum: {formatNumber(item.minimumStock)}{" "}
                        {item.unit || ""}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.isCritical
                            ? "bg-[#f9e9e4] text-[#ad5a43]"
                            : "bg-[#fff1dd] text-[#a96a22]"
                        }`}
                      >
                        {item.displayStatus}
                      </span>
                      <p className="mt-1 text-xs text-[#718078]">
                        Available: {formatNumber(item.currentQuantity)}{" "}
                        {item.unit || ""}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}

          <ActionLink onClick={() => goTo("Stock Quantity")}>
            View stock quantities
          </ActionLink>
        </div>

        <div className={styles.card}>
          <SectionHeading
            title="Expiry monitoring"
            description="Batches that need an expiry review"
            icon={CalendarClock}
          />

          {expiryItems.length === 0 ? (
            <EmptyState>
              <CheckCircle2
                size={24}
                className="mx-auto mb-2 text-[#5b8c68]"
              />
              No expiry warnings found.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {expiryItems.slice(0, 6).map((item, index) => (
                <div
                  key={item._id || item.batchCode || index}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#eee9df] bg-[#faf9f4] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#244638]">
                      {getName(item)}
                    </p>
                    <p className="mt-1 text-xs text-[#89958c]">
                      Batch: {item.batchCode || "—"}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.tone === "red"
                          ? "bg-[#f9e9e4] text-[#ad5a43]"
                          : item.tone === "amber"
                            ? "bg-[#fff1dd] text-[#a96a22]"
                            : "bg-[#f1eaf8] text-[#7855a2]"
                      }`}
                    >
                      {item.statusLabel}
                    </span>
                    <p className="mt-1 text-xs text-[#718078]">
                      {formatDate(item.expiryDate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <ActionLink onClick={() => goTo("Stock Batches")}>
            View stock batches
          </ActionLink>
        </div>
      </div>

      {/* Recent stock movements */}
      <div className={styles.card}>
        <SectionHeading
          title="Recent stock movements"
          description="A short history of the latest inventory changes"
          icon={Activity}
        />

        {movements.length === 0 ? (
          <EmptyState>
            No stock movement records available yet.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#e5e8df]">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-[#f7f4ec] text-[#53645a]">
                <tr>
                  <th className="px-4 py-3 font-medium">Ingredient</th>
                  <th className="px-4 py-3 font-medium">Movement</th>
                  <th className="px-4 py-3 font-medium">Quantity</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee9df]">
                {movements.slice(0, 5).map((item, index) => {
                  const isStockIn = item.movementType === "Stock In";

                  return (
                    <tr
                      key={item._id || index}
                      className="transition hover:bg-[#fafbf7]"
                    >
                      <td className="px-4 py-3 font-medium text-[#244638]">
                        {item.ingredientId?.name || "Unknown ingredient"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                            isStockIn
                              ? "bg-[#e8f3e8] text-[#356c45]"
                              : "bg-[#fff1dd] text-[#a96a22]"
                          }`}
                        >
                          {isStockIn ? (
                            <ArrowDownToLine size={13} />
                          ) : (
                            <ArrowUpFromLine size={13} />
                          )}
                          {item.movementType || "Movement"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#53645a]">
                        {formatNumber(item.quantity)} {item.unit || ""}
                      </td>
                      <td className="px-4 py-3 text-[#718078]">
                        {formatDate(item.movementDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <ActionLink onClick={() => goTo("Stock Movement")}>
          View all movements
        </ActionLink>
      </div>

      {/* Alerts + self-healing protection */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className={styles.card}>
          <SectionHeading
            title="Recent alerts"
            description="Inventory issues recorded by the system"
            icon={CircleAlert}
          />

          {openAlerts.length === 0 ? (
            <EmptyState>
              <CheckCircle2
                size={24}
                className="mx-auto mb-2 text-[#5b8c68]"
              />
              No open alerts are reported.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {openAlerts.slice(0, 4).map((item, index) => (
                <div
                  key={item._id || index}
                  className="flex items-start gap-3 rounded-xl border border-[#eee9df] bg-[#faf9f4] p-3"
                >
                  <AlertTriangle
                    size={18}
                    className="mt-0.5 shrink-0 text-[#a96a22]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#244638]">
                      {item.ingredientId?.name ||
                        item.title ||
                        "Inventory alert"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#718078]">
                      {item.message ||
                        item.description ||
                        item.alertType ||
                        "Review this inventory alert."}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#fff1dd] px-2 py-1 text-xs font-medium text-[#a96a22]">
                    {item.status || "Open"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <ActionLink onClick={() => goTo("Alerts")}>
            View all alerts
          </ActionLink>
        </div>

        <div className="rounded-2xl border border-[#315b48] bg-gradient-to-br from-[#244638] to-[#173d35] p-6 text-white shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-white/10 bg-white/10 p-3">
              <ShieldCheck size={23} />
            </div>
            <div>
              <h2 className="font-semibold">Resilio Protection</h2>
              <p className="mt-1 text-sm leading-6 text-white/75">
                Monitor inventory failures and review recovery activity.
                Alerts indicate problems; automatic recovery must be
                implemented and verified separately.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/15 bg-white/5 p-4">
            <p className="text-xs text-white/60">Open inventory alerts</p>
            <p className="mt-2 text-3xl font-semibold">
              {formatNumber(summary.openAlertCount ?? openAlerts.length)}
            </p>
            <p className="mt-1 text-xs text-white/60">
              Issues that may need investigation
            </p>
          </div>

          <button
            onClick={() => goTo("Self-Healing Monitor")}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#e5eddb] px-4 py-3 text-sm font-semibold text-[#244638] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            Open self-healing monitor
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex flex-col justify-between gap-2 border-t border-[#e5e8df] pt-4 pb-2 text-xs text-[#89958c] sm:flex-row">
        <span className="font-medium tracking-[0.12em]">
          RESILIO · INVENTORY DASHBOARD
        </span>
        <span>Last updated: {formatDate(data?.generatedAt)}</span>
      </footer>
    </section>
  );
}
