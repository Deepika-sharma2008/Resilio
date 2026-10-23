
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Package,
  Search,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Boxes,
  Leaf,
} from "lucide-react";

function StockBadge({ quantity, minimumStock }) {
  if (quantity <= 0) {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
        Out of stock
      </span>
    );
  }

  if (minimumStock != null && quantity <= minimumStock) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        Low stock
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
      In stock
    </span>
  );
}

function SummaryCard({ icon, label, value, description, color }) {
  return (
    <div className="rounded-2xl border border-[#E8E5DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[#78877C]">{label}</p>
          <p className="mt-3 text-3xl font-bold text-[#244638]">
            {value}
          </p>
          <p className="mt-2 text-xs text-[#78877C]">{description}</p>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function StockQuantityPage() {
  const [quantities, setQuantities] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadInventory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch("/api/stock-quantities");
      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message || "Could not load stock quantities."
        );
      }

      setQuantities(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err.message || "Unable to load inventory.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const inventory = useMemo(() => {
    return quantities.map((record) => {
      const ingredient =
        record.ingredientId &&
        typeof record.ingredientId === "object"
          ? record.ingredientId
          : {};

      return {
        id: record._id,
        name: ingredient.name || "Unknown ingredient",
        code: ingredient.ingredientCode || "—",
        unit: ingredient.unit || "",
        quantity: Number(record.totalQuantity) || 0,
        minimumStock:
          ingredient.minimumStock == null
            ? null
            : Number(ingredient.minimumStock),
      };
    });
  }, [quantities]);

  const filteredInventory = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return inventory;

    return inventory.filter((item) =>
      `${item.name} ${item.code}`.toLowerCase().includes(term)
    );
  }, [inventory, search]);

  const lowStock = inventory.filter(
    (item) =>
      item.quantity > 0 &&
      item.minimumStock != null &&
      item.quantity <= item.minimumStock
  ).length;

  const outOfStock = inventory.filter(
    (item) => item.quantity <= 0
  ).length;

  return (
    <div className="space-y-6 pb-8 text-[#244638]">
      {/* Page heading */}
      <header className="flex flex-col justify-between gap-5 rounded-2xl border border-[#dfe8d9] bg-gradient-to-r from-[#e3efdf] via-[#f0f4e9] to-[#fff0e5] p-6 sm:flex-row sm:items-center">
        <div >
          <div  className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#64816b]">
              <Leaf size={15} />
            INVENTORY MANAGEMENT         
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#244638] sm:text-3xl">
            Stock Quantity
          </h1>

          <p className="mt-1.5 text-sm leading-6 text-[#6e8073]">
            Check available ingredient quantities and stock levels.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadInventory(true)}
          disabled={loading || refreshing}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173D35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245548] disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </header>

      {/* Error */}
      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => loadInventory(true)}
            className="font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          icon={<Package size={22} />}
          label="Ingredients"
          value={inventory.length}
          description="Tracked stock records"
          color="bg-[#DCE5D8] text-[#173D35]"
        />

        <SummaryCard
          icon={<AlertTriangle size={22} />}
          label="Low Stock"
          value={lowStock}
          description="Need replenishment"
          color="bg-amber-50 text-amber-700"
        />

        <SummaryCard
          icon={<XCircle size={22} />}
          label="Out of Stock"
          value={outOfStock}
          description="No available quantity"
          color="bg-red-50 text-red-700"
        />
      </div>

      {/* Inventory list */}
      <section className="overflow-hidden rounded-2xl border border-[#E8E5DA] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#E8E5DA] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#244638]">
              <Boxes size={20} />
              Available Stock
            </h2>
            <p className="mt-1 text-sm text-[#78877C]">
              Current quantity for each ingredient.
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78877C]"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ingredients..."
              aria-label="Search ingredients"
              className="w-full rounded-xl border border-[#E8E5DA] bg-[#F7F4EC]/50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#52796F] focus:ring-2 focus:ring-[#DCE5D8]"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-[#78877C]">
            Loading stock quantities...
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-12 text-center">
            <Package
              size={32}
              className="mx-auto mb-3 text-[#A7B0A5]"
            />

            <p className="font-semibold text-[#244638]">
              {search ? "No matching ingredients" : "No stock records found"}
            </p>

            <p className="mt-2 text-sm text-[#78877C]">
              {search
                ? "Try another ingredient name or code."
                : "Record stock through your existing stock-in process to see quantities here."}
            </p>
          </div>
        ) : (
          <>
            <div className="border-b border-[#F0EDE5] px-5 py-3 text-xs text-[#78877C]">
              Showing {filteredInventory.length} of {inventory.length} ingredients
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F7F4EC] text-xs uppercase tracking-wide text-[#78877C]">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Ingredient</th>
                    <th className="px-5 py-4 font-semibold">Available Quantity</th>
                    <th className="px-5 py-4 font-semibold">Minimum Stock</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F0EDE5]">
                  {filteredInventory.map((item) => (
                    <tr
                      key={item.id}
                      className="transition hover:bg-[#FAFBF8]"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#244638]">
                          {item.name}
                        </p>
                        <p className="mt-1 text-xs text-[#78877C]">
                          {item.code}
                        </p>
                      </td>

                      <td className="px-5 py-4 font-semibold text-[#244638]">
                        {item.quantity.toLocaleString("en-IN")} {item.unit}
                      </td>

                      <td className="px-5 py-4 text-[#78877C]">
                        {item.minimumStock == null
                          ? "Not set"
                          : `${item.minimumStock.toLocaleString("en-IN")} ${item.unit}`}
                      </td>

                      <td className="px-5 py-4">
                        <StockBadge
                          quantity={item.quantity}
                          minimumStock={item.minimumStock}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 p-4 md:hidden">
              {filteredInventory.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-[#E8E5DA] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#244638]">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-xs text-[#78877C]">
                        {item.code}
                      </p>
                    </div>

                    <StockBadge
                      quantity={item.quantity}
                      minimumStock={item.minimumStock}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-sm text-[#78877C]">
                      Available
                    </span>
                    <span className="font-semibold text-[#244638]">
                      {item.quantity.toLocaleString("en-IN")} {item.unit}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-sm text-[#78877C]">
                      Minimum stock
                    </span>
                    <span className="text-sm text-[#244638]">
                      {item.minimumStock == null
                        ? "Not set"
                        : `${item.minimumStock.toLocaleString("en-IN")} ${item.unit}`}
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
