import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  RefreshCw,
  ClipboardList,
  Package,
  CircleAlert,
  CalendarDays,
  X,
  Leaf,
} from "lucide-react";

const API_URL = "/api/stock-movements";

function getIngredientName(movement) {
  const ingredient = movement.ingredientId;

  if (ingredient && typeof ingredient === "object") {
    return ingredient.name || ingredient.ingredientCode || "Ingredient";
  }

  return movement.ingredientName || "Ingredient";
}

function getMovementCode(movement) {
  return movement.movementCode || "—";
}

function formatDate(date) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isStockIn(movement) {
  return String(movement.movementType || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "") === "stockin";
}

function isStockOut(movement) {
  return String(movement.movementType || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "") === "stockout";
}

function formatQuantity(movement) {
  const quantity = Number(movement.quantity || 0);
  const sign = isStockIn(movement) ? "+" : isStockOut(movement) ? "−" : "";

  return `${sign}${quantity} ${movement.unit || ""}`.trim();
}

export default function StockMovementsPage() {
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchMovements = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch(API_URL);
      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Unable to load stock movements.");
      }

      const records = Array.isArray(result.data)
        ? result.data
        : Array.isArray(result.data?.movements)
          ? result.data.movements
          : Array.isArray(result.movements)
            ? result.movements
            : [];

      setMovements(records);
    } catch (err) {
      setError(
        err.message ||
          "Could not load movements. Please check the API route."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLowerCase();

    return movements.filter((movement) => {
      const ingredientName = getIngredientName(movement).toLowerCase();
      const code = getMovementCode(movement).toLowerCase();
      const reason = String(movement.reason || "").toLowerCase();
      const reference = String(movement.referenceCode || "").toLowerCase();

      const matchesSearch =
        !term ||
        ingredientName.includes(term) ||
        code.includes(term) ||
        reason.includes(term) ||
        reference.includes(term);

      const matchesType =
        typeFilter === "All" ||
        (typeFilter === "Stock In" && isStockIn(movement)) ||
        (typeFilter === "Stock Out" && isStockOut(movement));

      return matchesSearch && matchesType;
    });
  }, [movements, search, typeFilter]);

  const stockInCount = movements.filter(isStockIn).length;
  const stockOutCount = movements.filter(isStockOut).length;

  const recentMovements = [...filteredMovements].sort(
    (a, b) =>
      new Date(b.movementDate || b.createdAt || 0).getTime() -
      new Date(a.movementDate || a.createdAt || 0).getTime()
  );

  return (
    <div className="space-y-6 pb-8 text-[#244638]">
      {/* Page header — consistent with Ingredients and Suppliers */}
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-[#dfe8d9] bg-gradient-to-r from-[#e3efdf] via-[#f0f4e9] to-[#fff0e5] p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#64816b]">
            <Leaf size={15} />
            Inventory management
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#244638] sm:text-3xl">
            Stock Movements
          </h1>

          <p className="mt-1.5 max-w-xl text-sm leading-6 text-[#6e8073]">
            Track every recorded change in ingredient stock.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchMovements(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe7dc] bg-white px-4 py-3 text-sm font-semibold text-[#244638] transition hover:bg-[#f1f6ed] disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </header>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <CircleAlert size={19} className="mt-0.5 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="font-semibold">Unable to load movements</p>
            <p className="mt-1 break-words">{error}</p>
          </div>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className="shrink-0"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<Package size={21} />}
          label="Total Movements"
          value={movements.length}
          description="Recorded stock changes"
          color="green"
        />

        <SummaryCard
          icon={<ArrowDownLeft size={21} />}
          label="Stock In"
          value={stockInCount}
          description="Incoming stock records"
          color="sage"
        />

        <SummaryCard
          icon={<ArrowUpRight size={21} />}
          label="Stock Out"
          value={stockOutCount}
          description="Outgoing stock records"
          color="sand"
        />
      </section>

      {/* Search and filter */}
      <section className="rounded-2xl border border-[#E8E5DA] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78877C]"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ingredient, movement code or reason..."
              className="w-full rounded-xl border border-[#DCE5D8] bg-[#FCFCF8] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#527A61] focus:ring-2 focus:ring-[#DCE5D8]"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-xl border border-[#DCE5D8] bg-[#FCFCF8] px-4 py-3 text-sm text-[#244638] outline-none focus:border-[#527A61] focus:ring-2 focus:ring-[#DCE5D8]"
          >
            <option value="All">All movements</option>
            <option value="Stock In">Stock In</option>
            <option value="Stock Out">Stock Out</option>
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[#78877C]">
          <span>
            Showing {filteredMovements.length} of {movements.length} records
          </span>

          {(search || typeFilter !== "All") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter("All");
              }}
              className="font-semibold text-[#315E49] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* Movement history */}
      <section className="overflow-hidden rounded-2xl border border-[#E8E5DA] bg-white shadow-sm">
        <div className="border-b border-[#E8EAE1] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#DCE5D8] p-2.5 text-[#173D35]">
              <ClipboardList size={20} />
            </div>

            <div>
              <h2 className="font-bold text-[#173D35]">
                Movement History
              </h2>
              <p className="mt-1 text-sm text-[#78877C]">
                A record of stock operations performed in Resilio.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 p-10 text-sm text-[#78877C]">
            <RefreshCw size={19} className="animate-spin" />
            Loading stock movements...
          </div>
        ) : recentMovements.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DCE5D8] text-[#173D35]">
              <ClipboardList size={26} />
            </div>

            <h3 className="mt-4 font-semibold text-[#173D35]">
              No movements found
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#78877C]">
              {movements.length === 0
                ? "Stock movement records will appear here when stock is received or issued."
                : "Try another search term or clear your filters."}
            </p>

            {(search || typeFilter !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("All");
                }}
                className="mt-4 rounded-xl border border-[#DCE5D8] px-4 py-2.5 text-sm font-semibold text-[#315E49] transition hover:bg-[#F2F5ED]"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-[#F7F4EC] text-xs uppercase tracking-wider text-[#78877C]">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Movement</th>
                    <th className="px-5 py-4 font-semibold">Ingredient</th>
                    <th className="px-5 py-4 font-semibold">Type</th>
                    <th className="px-5 py-4 font-semibold">Quantity</th>
                    <th className="px-5 py-4 font-semibold">Reason</th>
                    <th className="px-5 py-4 font-semibold">Date</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#EEECE4]">
                  {recentMovements.map((movement) => (
                    <tr
                      key={movement._id || getMovementCode(movement)}
                      className="transition hover:bg-[#FCFBF7]"
                    >
                      <td className="px-5 py-4 font-medium text-[#173D35]">
                        {getMovementCode(movement)}
                      </td>

                      <td className="px-5 py-4 text-[#173D35]">
                        <p className="font-semibold">
                          {getIngredientName(movement)}
                        </p>

                        {movement.ingredientId?.ingredientCode && (
                          <p className="mt-1 text-xs text-[#78877C]">
                            {movement.ingredientId.ingredientCode}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <MovementBadge movement={movement} />
                      </td>

                      <td
                        className={`px-5 py-4 font-semibold ${
                          isStockIn(movement)
                            ? "text-[#315E49]"
                            : isStockOut(movement)
                              ? "text-[#795A35]"
                              : "text-[#78877C]"
                        }`}
                      >
                        {formatQuantity(movement)}
                      </td>

                      <td className="max-w-xs px-5 py-4 text-[#78877C]">
                        {movement.reason || "—"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-[#78877C]">
                        {formatDate(
                          movement.movementDate || movement.createdAt
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-4 p-4 md:hidden">
              {recentMovements.map((movement) => (
                <article
                  key={movement._id || getMovementCode(movement)}
                  className="rounded-2xl border border-[#E8E5DA] bg-[#FCFBF7] p-5 shadow-sm transition hover:border-[#C7D5C8] hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-bold text-[#173D35]">
                        {getIngredientName(movement)}
                      </h3>
                      <p className="mt-1 break-all text-xs text-[#78877C]">
                        {getMovementCode(movement)}
                      </p>
                    </div>

                    <MovementBadge movement={movement} />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#EEECE4] pt-4">
                    <span className="text-sm text-[#78877C]">Quantity</span>
                    <span className="font-bold text-[#173D35]">
                      {formatQuantity(movement)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <span className="text-sm text-[#78877C]">Reason</span>
                    <span className="max-w-[65%] text-right text-sm text-[#173D35]">
                      {movement.reason || "—"}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-sm text-[#78877C]">
                      <CalendarDays size={15} />
                      Date
                    </span>
                    <span className="text-sm text-[#173D35]">
                      {formatDate(
                        movement.movementDate || movement.createdAt
                      )}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ icon, label, value, description, color }) {
  const colors = {
    green: "bg-[#DCE5D8] text-[#173D35]",
    sage: "bg-[#EDF2E8] text-[#315E49]",
    sand: "bg-[#F0E4D4] text-[#795A35]",
  };

  return (
    <div className="rounded-2xl border border-[#E8E5DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#78877C]">{label}</p>
          <p className="mt-3 text-3xl font-bold text-[#173D35]">{value}</p>
          <p className="mt-2 text-xs text-[#78877C]">{description}</p>
        </div>

        <div className={`rounded-xl p-3 ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function MovementBadge({ movement }) {
  const stockIn = isStockIn(movement);
  const stockOut = isStockOut(movement);

  const styles = stockIn
    ? "bg-[#DCE5D8] text-[#173D35]"
    : stockOut
      ? "bg-[#F0E4D4] text-[#795A35]"
      : "bg-gray-100 text-gray-600";

  const label = stockIn
    ? "Stock In"
    : stockOut
      ? "Stock Out"
      : movement.movementType || "Other";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      {stockIn ? (
        <ArrowDownLeft size={13} />
      ) : stockOut ? (
        <ArrowUpRight size={13} />
      ) : null}
      {label}
    </span>
  );
}