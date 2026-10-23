
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileBarChart,
  Package,
  ArrowLeftRight,
  Wallet,
  AlertTriangle,
  CalendarClock,
  RefreshCw,
  Search,
  Download,
  LoaderCircle,
  XCircle,
} from "lucide-react";

const REPORTS = [
  { id: "current-stock", label: "Current Stock", icon: Package },
  { id: "stock-movements", label: "Stock Movements", icon: ArrowLeftRight },
  { id: "valuation", label: "Valuation", icon: Wallet },
  { id: "low-stock", label: "Low Stock", icon: AlertTriangle },
  { id: "expiry", label: "Expiry", icon: CalendarClock },
];

const today = new Date().toISOString().slice(0, 10);

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
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

function getIngredientName(value) {
  if (!value) return "Unknown ingredient";

  return typeof value === "object"
    ? value.name || "Unknown ingredient"
    : String(value);
}

function getStatusStyle(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("expired") || value.includes("out of stock")) {
    return "bg-red-50 text-red-700";
  }

  if (
    value.includes("low") ||
    value.includes("near") ||
    value.includes("unknown")
  ) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-emerald-50 text-emerald-700";
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-[#E8E5DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#78877C]">{label}</p>
        <div className="rounded-xl bg-[#DCE5D8] p-3">
          <Icon size={19} className="text-[#173D35]" />
        </div>
      </div>

      <p className="mt-3 text-2xl font-bold text-[#244638]">
        {value}
      </p>
    </div>
  );
}

function DataTable({ columns, rows, emptyMessage }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E8E5DA]">
      <table className="w-full min-w-[650px] text-left text-sm">
        <thead className="bg-[#F7F4EC] text-xs uppercase tracking-wide text-[#78877C]">
          <tr>
            {columns.map((column) => (
              <th key={column.label} className="px-5 py-4 font-semibold">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-[#F0EDE5]">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-10 text-center text-[#78877C]"
              >
                {emptyMessage || "No records found."}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={
                  row._id ||
                  row.batchCode ||
                  row.movementCode ||
                  index
                }
                className="transition hover:bg-[#FAFBF8]"
              >
                {columns.map((column) => (
                  <td
                    key={column.label}
                    className="px-5 py-4 text-[#35483D]"
                  >
                    {column.render
                      ? column.render(row)
                      : row[column.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function InventoryReportsPage() {
  const [activeReport, setActiveReport] = useState("current-stock");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [movementType, setMovementType] = useState("");
  const [days, setDays] = useState("7");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (activeReport === "stock-movements") {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        if (movementType) params.set("movementType", movementType);
      }

      if (activeReport === "expiry") {
        params.set("days", days);
      }

      const query = params.toString();
      const url = `/api/reports/inventory/${activeReport}${
        query ? `?${query}` : ""
      }`;

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load report.");
      }

      setReport(result);
    } catch (err) {
      setReport(null);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [activeReport, from, to, movementType, days]);

  useEffect(() => {
    setSearch("");
    loadReport();
  }, [loadReport]);

  const currentStock = report?.data || [];
  const movementRows = report?.data || [];
  const valuationRows = report?.data || [];

  const lowStockRows = [
    ...(report?.lowStock || []),
    ...(report?.outOfStock || []),
  ];

  const expiryRows = [
    ...(report?.expired || []).map((item) => ({
      ...item,
      reportStatus: "Expired",
    })),
    ...(report?.nearExpiry || []).map((item) => ({
      ...item,
      reportStatus: "Near Expiry",
    })),
    ...(report?.expiryUnknown || []).map((item) => ({
      ...item,
      reportStatus: "Expiry Unknown",
    })),
  ];

  let rows = [];
  let columns = [];

  if (activeReport === "current-stock") {
    rows = currentStock;
    columns = [
      {
        label: "Ingredient",
        render: (row) => getIngredientName(row.name),
      },
      { label: "Code", key: "ingredientCode" },
      {
        label: "Available Quantity",
        render: (row) =>
          `${formatNumber(row.currentQuantity)} ${row.unit || ""}`,
      },
      {
        label: "Minimum Stock",
        render: (row) =>
          row.minimumStock == null
            ? "Not set"
            : `${formatNumber(row.minimumStock)} ${row.unit || ""}`,
      },
      {
        label: "Status",
        render: (row) => (
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
              row.stockStatus
            )}`}
          >
            {row.stockStatus || "Unknown"}
          </span>
        ),
      },
    ];
  } else if (activeReport === "stock-movements") {
    rows = movementRows;
    columns = [
      {
        label: "Date",
        render: (row) => formatDate(row.movementDate),
      },
      { label: "Movement Code", key: "movementCode" },
      {
        label: "Ingredient",
        render: (row) => getIngredientName(row.ingredientId),
      },
      {
        label: "Movement",
        render: (row) => (
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
              row.movementType
            )}`}
          >
            {row.movementType || "—"}
          </span>
        ),
      },
      {
        label: "Quantity",
        render: (row) =>
          `${formatNumber(row.quantity)} ${row.unit || ""}`,
      },
      { label: "Reason", key: "reason" },
    ];
  } else if (activeReport === "valuation") {
    rows = valuationRows;
    columns = [
      { label: "Batch", key: "batchCode" },
      {
        label: "Ingredient",
        render: (row) => getIngredientName(row.ingredient),
      },
      {
        label: "Remaining",
        render: (row) => formatNumber(row.quantityRemaining),
      },
      {
        label: "Unit Cost",
        render: (row) => formatNumber(row.unitCost),
      },
      {
        label: "Estimated Value",
        render: (row) => formatNumber(row.estimatedValue),
      },
      { label: "Status", key: "status" },
    ];
  } else if (activeReport === "low-stock") {
    rows = lowStockRows;
    columns = [
      {
        label: "Ingredient",
        render: (row) => getIngredientName(row.name),
      },
      { label: "Code", key: "ingredientCode" },
      {
        label: "Available",
        render: (row) =>
          `${formatNumber(row.currentQuantity)} ${row.unit || ""}`,
      },
      {
        label: "Minimum",
        render: (row) =>
          row.minimumStock == null
            ? "Not set"
            : `${formatNumber(row.minimumStock)} ${row.unit || ""}`,
      },
      {
        label: "Status",
        render: (row) => {
          const status =
            row.stockStatus ||
            (row.currentQuantity <= 0 ? "Out of Stock" : "Low Stock");

          return (
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                status
              )}`}
            >
              {status}
            </span>
          );
        },
      },
    ];
  } else {
    rows = expiryRows;
    columns = [
      { label: "Batch", key: "batchCode" },
      {
        label: "Ingredient",
        render: (row) => getIngredientName(row.ingredient),
      },
      {
        label: "Remaining Quantity",
        render: (row) => formatNumber(row.quantityRemaining),
      },
      {
        label: "Expiry Date",
        render: (row) => formatDate(row.expiryDate),
      },
      {
        label: "Status",
        render: (row) => (
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
              row.reportStatus
            )}`}
          >
            {row.reportStatus}
          </span>
        ),
      },
    ];
  }

  const filteredRows = rows.filter((row) => {
    const text = [
      row.name,
      row.ingredientCode,
      row.movementCode,
      row.movementType,
      row.reason,
      row.batchCode,
      row.stockStatus,
      row.reportStatus,
      row.ingredient?.name,
      row.ingredientId?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return text.includes(search.trim().toLowerCase());
  });

  function exportCSV() {
    if (!filteredRows.length) return;

    const keys = columns.map((column) => column.label);

    const escapeCSV = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const values = filteredRows.map((row) =>
      columns
        .map((column) => {
          if (column.key) return row[column.key] ?? "";

          if (column.label === "Ingredient") {
            return getIngredientName(
              row.ingredient || row.ingredientId || row.name
            );
          }

          if (column.label === "Date") return row.movementDate || "";
          if (column.label === "Expiry Date") return row.expiryDate || "";

          if (column.label === "Status") {
            return (
              row.reportStatus ||
              row.stockStatus ||
              row.status ||
              row.movementType ||
              ""
            );
          }

          if (
            column.label === "Available Quantity" ||
            column.label === "Available"
          ) {
            return row.currentQuantity ?? "";
          }

          if (
            column.label === "Minimum Stock" ||
            column.label === "Minimum"
          ) {
            return row.minimumStock ?? "";
          }

          if (column.label === "Quantity") return row.quantity ?? "";
          if (
            column.label === "Remaining" ||
            column.label === "Remaining Quantity"
          ) {
            return row.quantityRemaining ?? "";
          }
          if (column.label === "Unit Cost") return row.unitCost ?? "";
          if (column.label === "Estimated Value") {
            return row.estimatedValue ?? "";
          }
          if (column.label === "Movement") return row.movementType ?? "";
          if (column.label === "Reason") return row.reason ?? "";

          return "";
        })
        .map(escapeCSV)
        .join(",")
    );

    const csv = [keys.map(escapeCSV).join(","), ...values].join("\n");
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);

    link.href = objectUrl;
    link.download = `resilio-${activeReport}-${today}.csv`;
    link.click();

    URL.revokeObjectURL(objectUrl);
  }

  const selectedReport = REPORTS.find(
    (item) => item.id === activeReport
  );

  const summaryCards = (() => {
    if (!report) return [];

    if (activeReport === "current-stock") {
      return [
        {
          label: "Ingredients",
          value: report.count || 0,
          icon: Package,
        },
        {
          label: "Low Stock",
          value: currentStock.filter(
            (row) => row.stockStatus === "Low Stock"
          ).length,
          icon: AlertTriangle,
        },
        {
          label: "Out of Stock",
          value: currentStock.filter(
            (row) => row.stockStatus === "Out of Stock"
          ).length,
          icon: XCircle,
        },
      ];
    }

    if (activeReport === "stock-movements") {
      return [
        {
          label: "Transactions",
          value: report.count || 0,
          icon: ArrowLeftRight,
        },
        {
          label: "Stock In",
          value: (report.summary || [])
            .filter((row) => row.movementType === "Stock In")
            .reduce(
              (sum, row) => sum + (row.transactionCount || 0),
              0
            ),
          icon: Package,
        },
        {
          label: "Stock Out",
          value: (report.summary || [])
            .filter((row) => row.movementType === "Stock Out")
            .reduce(
              (sum, row) => sum + (row.transactionCount || 0),
              0
            ),
          icon: ArrowLeftRight,
        },
      ];
    }

    if (activeReport === "valuation") {
      return [
        {
          label: "Recorded Value",
          value: formatNumber(report.totalRecordedValue),
          icon: Wallet,
        },
        {
          label: "Batches",
          value: report.count || 0,
          icon: Package,
        },
      ];
    }

    if (activeReport === "low-stock") {
      return [
        {
          label: "Low Stock",
          value: report.summary?.lowStockCount || 0,
          icon: AlertTriangle,
        },
        {
          label: "Out of Stock",
          value: report.summary?.outOfStockCount || 0,
          icon: Package,
        },
      ];
    }

    return [
      {
        label: "Expired",
        value: report.summary?.expiredCount || 0,
        icon: AlertTriangle,
      },
      {
        label: "Near Expiry",
        value: report.summary?.nearExpiryCount || 0,
        icon: CalendarClock,
      },
      {
        label: "Unknown Expiry",
        value: report.summary?.expiryUnknownCount || 0,
        icon: Package,
      },
    ];
  })();

  return (
    <div className="space-y-6 pb-8 text-[#244638]">
      {/* Page heading */}
      <header className="flex flex-col justify-between gap-5 rounded-2xl border border-[#dfe8d9] bg-gradient-to-r from-[#e3efdf] via-[#f0f4e9] to-[#fff0e5] p-6 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-[#6e8073]">
            <FileBarChart size={17} />
            <span>Inventory Management</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#244638] sm:text-3xl">
            Reports
          </h1>

          <p className="mt-1.5 text-sm leading-6 text-[#6e8073]">
            Review stock levels, movements, costs and expiry details.
          </p>
        </div>

        <button
          type="button"
          onClick={loadReport}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173D35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245548] disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh Report
        </button>
      </header>

      {/* Report tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {REPORTS.map((item) => {
          const Icon = item.icon;
          const active = activeReport === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveReport(item.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "border-[#173D35] bg-[#173D35] text-white shadow-sm"
                  : "border-[#E8E5DA] bg-white text-[#53645A] hover:border-[#9AAE9E] hover:bg-[#FAFBF8]"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Filters and export */}
      <section className="flex flex-col gap-4 rounded-2xl border border-[#E8E5DA] bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
          {activeReport === "stock-movements" && (
            <>
              <label className="text-sm font-medium text-[#53645A]">
                From
                <input
                  type="date"
                  value={from}
                  max={to || today}
                  onChange={(event) => setFrom(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#E8E5DA] bg-white px-3 py-3 text-sm outline-none focus:border-[#52796F] sm:w-auto"
                />
              </label>

              <label className="text-sm font-medium text-[#53645A]">
                To
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  max={today}
                  onChange={(event) => setTo(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#E8E5DA] bg-white px-3 py-3 text-sm outline-none focus:border-[#52796F] sm:w-auto"
                />
              </label>

              <label className="text-sm font-medium text-[#53645A]">
                Movement Type
                <select
                  value={movementType}
                  onChange={(event) => setMovementType(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#E8E5DA] bg-white px-3 py-3 text-sm outline-none focus:border-[#52796F] sm:w-auto"
                >
                  <option value="">All movements</option>
                  <option value="Stock In">Stock In</option>
                  <option value="Stock Out">Stock Out</option>
                  <option value="Wastage">Wastage</option>
                  <option value="Adjustment">Adjustment</option>
                </select>
              </label>
            </>
          )}

          {activeReport === "expiry" && (
            <label className="text-sm font-medium text-[#53645A]">
              Show batches expiring within
              <select
                value={days}
                onChange={(event) => setDays(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-[#E8E5DA] bg-white px-3 py-3 text-sm outline-none focus:border-[#52796F]"
              >
                <option value="7">7 days</option>
                <option value="15">15 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
            </label>
          )}

          <label className="text-sm font-medium text-[#53645A]">
            Search records
            <span className="relative mt-1 block">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#78877C]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ingredient, code..."
                aria-label="Search report records"
                className="w-full rounded-xl border border-[#E8E5DA] bg-[#F7F4EC]/50 py-3 pl-9 pr-3 text-sm outline-none transition focus:border-[#52796F] sm:min-w-64"
              />
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={exportCSV}
          disabled={loading || filteredRows.length === 0}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#DCE5D8] bg-[#F7F4EC] px-4 py-3 text-sm font-semibold text-[#244638] transition hover:bg-[#DCE5D8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={16} />
          Export CSV
        </button>
      </section>

      {/* Summary cards */}
      {summaryCards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {/* Report table */}
      <section className="overflow-hidden rounded-2xl border border-[#E8E5DA] bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-2 border-b border-[#E8E5DA] p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-[#244638]">
              {selectedReport?.label} Report
            </h2>
            <p className="mt-1 text-sm text-[#78877C]">
              {loading
                ? "Loading records..."
                : `${filteredRows.length} record${filteredRows.length === 1 ? "" : "s"} shown`}
            </p>
          </div>

          {report?.generatedAt && (
            <p className="text-xs text-[#78877C]">
              Generated {formatDate(report.generatedAt)}
            </p>
          )}
        </div>

        {error ? (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">Unable to load this report</p>
            <p className="mt-1">{error}</p>
            <button
              type="button"
              onClick={loadReport}
              className="mt-3 rounded-lg bg-white px-3 py-2 font-semibold text-red-700"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-[#78877C]">
            <LoaderCircle size={18} className="animate-spin" />
            Loading report data...
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <DataTable
              columns={columns}
              rows={filteredRows}
              emptyMessage="No matching records found."
            />
          </div>
        )}
      </section>

      {activeReport === "valuation" && report?.note && (
        <p className="text-xs leading-5 text-[#78877C]">{report.note}</p>
      )}

    </div>
  );
}
