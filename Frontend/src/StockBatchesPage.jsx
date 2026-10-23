
import React, { useCallback, useEffect, useState } from "react";
import {
  Search,
  Package,
  CalendarClock,
  CalendarDays,
  Plus,
  RefreshCw,
  Pencil,
  X,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Truck,
  Leaf,
} from "lucide-react";

const API_URL = "/api";
const BATCHES_URL = `${API_URL}/stock-batches`;

const categories = [
  "Vegetables",
  "Fruits",
  "Dairy",
  "Meat",
  "Grains",
  "Spices",
  "Oils",
  "Other",
];

const units = ["kg", "g", "litre", "ml", "piece"];

const emptyIngredientForm = {
  ingredientCode: "",
  name: "",
  category: "Vegetables",
  unit: "kg",
  minimumStock: "5",
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || `Request failed (${response.status})`);
  }

  return result;
}

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);

const dateText = (value) => {
  if (!value) return "Not specified";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not specified";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const idOf = (value) =>
  value && typeof value === "object" ? value._id : value;

const nameOf = (value) => {
  if (!value) return "Not assigned";
  if (typeof value === "string") return value;
  return value.name || value.title || "Not assigned";
};

function nextIngredientCode(ingredients) {
  const largest = ingredients.reduce((max, item) => {
    const match = item.ingredientCode?.match(/^ING-(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `ING-${String(largest + 1).padStart(3, "0")}`;
}

function getStatus(batch) {
  if (
    batch.expiryDate &&
    new Date(batch.expiryDate).getTime() <
      new Date().setHours(0, 0, 0, 0)
  ) {
    return "Expired";
  }

  return batch.status || "Available";
}

function StatusBadge({ status }) {
  const styles = {
    Available: "bg-emerald-50 text-emerald-800",
    Expired: "bg-red-50 text-red-700",
    Depleted: "bg-stone-100 text-stone-600",
    Quarantined: "bg-amber-50 text-amber-800",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || "bg-stone-100 text-stone-700"
      }`}
    >
      {status}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, note, accent }) {
  return (
    <div className="rounded-2xl border border-[#E8E5DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#78877C]">{label}</p>
        <div className={`rounded-xl p-2.5 ${accent}`}>
          <Icon size={20} />
        </div>
      </div>

      <p className="mt-3 text-3xl font-semibold text-[#173D35]">{value}</p>
      <p className="mt-1 text-xs text-[#78877C]">{note}</p>
    </div>
  );
}

function BatchCard({ batch, onEdit }) {
  const ingredient = batch.ingredientId;
  const supplier = batch.supplierId;
  const status = getStatus(batch);

  return (
    <article className="rounded-2xl border border-[#E8E5DA] bg-white p-5 shadow-sm transition hover:border-[#C7D5C8] hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#DCE5D8] text-[#173D35]">
            <Package size={23} />
          </div>

          <div className="min-w-0">
            <h3 className="break-words text-base font-bold text-[#173D35]">
              {batch.batchCode || "Unnamed batch"}
            </h3>

            <p className="mt-1 text-sm text-[#53665B]">
              {nameOf(ingredient)}
              {ingredient?.ingredientCode
                ? ` · ${ingredient.ingredientCode}`
                : ""}
            </p>

            <p className="mt-1 flex items-center gap-1.5 text-sm text-[#78877C]">
              <Truck size={14} />
              {nameOf(supplier)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <StatusBadge status={status} />

          <button
            type="button"
            onClick={() => onEdit(batch)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE5D8] px-3 py-2 text-sm font-medium text-[#173D35] transition hover:bg-[#F0F4ED]"
          >
            <Pencil size={14} />
            Edit
          </button>
        </div>
      </div>

      <div className="my-5 grid grid-cols-2 gap-4 rounded-xl bg-[#F7F4EC] p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-[#78877C]">Qty received</p>
          <p className="mt-1 text-lg font-semibold text-[#173D35]">
            {batch.quantityReceived ?? batch.quantity ?? 0}
            <span className="ml-1 text-xs font-normal text-[#78877C]">
              {ingredient?.unit || ""}
            </span>
          </p>
        </div>

        <div>
          <p className="text-xs text-[#78877C]">Qty remaining</p>
          <p className="mt-1 text-lg font-semibold text-[#173D35]">
            {batch.quantityRemaining ?? "—"}
            <span className="ml-1 text-xs font-normal text-[#78877C]">
              {ingredient?.unit || ""}
            </span>
          </p>
        </div>

        <div>
          <p className="text-xs text-[#78877C]">Unit cost</p>
          <p className="mt-1 text-lg font-semibold text-[#173D35]">
            {money(batch.unitCost)}
          </p>
        </div>

        <div>
          <p className="text-xs text-[#78877C]">Total cost</p>
          <p className="mt-1 text-lg font-semibold text-[#173D35]">
            {money(
              batch.totalCost ??
                Number(batch.quantity ?? batch.quantityReceived ?? 0) *
                  Number(batch.unitCost ?? 0)
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <CalendarDays size={17} className="mt-0.5 text-[#78877C]" />
          <div>
            <p className="text-xs text-[#78877C]">Received date</p>
            <p className="mt-1 text-sm font-medium text-[#173D35]">
              {dateText(batch.receivedDate)}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <CalendarClock size={17} className="mt-0.5 text-[#78877C]" />
          <div>
            <p className="text-xs text-[#78877C]">Expiry date</p>
            <p
              className={`mt-1 text-sm font-medium ${
                status === "Expired" ? "text-red-700" : "text-[#173D35]"
              }`}
            >
              {dateText(batch.expiryDate)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-[#EEECE4] pt-3 text-xs text-[#78877C]">
        Created: {dateText(batch.createdAt)}
        <span className="mx-2">·</span>
        Updated: {dateText(batch.updatedAt)}
      </div>
    </article>
  );
}

const emptyForm = {
  batchCode: "",
  ingredientId: "",
  quantity: "",
  unitCost: "",
  supplierId: "",
  receivedDate: new Date().toISOString().slice(0, 10),
  expiryDate: "",
  referenceCode: "",
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[#dfe7dc] bg-white px-3.5 py-2.5 text-sm text-[#244638] outline-none transition placeholder:text-[#a0aaa0] focus:border-[#6b9b78] focus:ring-2 focus:ring-[#dcebd9]";

export default function StockBatchesPage() {
  const [batches, setBatches] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [modal, setModal] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({
    supplierId: "",
    expiryDate: "",
  });

  const [ingredientForm, setIngredientForm] = useState(
    emptyIngredientForm
  );

  const [ingredientSaving, setIngredientSaving] = useState(false);
  const [ingredientError, setIngredientError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [batchResult, ingredientResult, supplierResult] =
        await Promise.all([
          requestJson(BATCHES_URL),
          requestJson(`${API_URL}/ingredients`),
          requestJson(`${API_URL}/suppliers`),
        ]);

      setBatches(Array.isArray(batchResult.data) ? batchResult.data : []);
      setIngredients(
        Array.isArray(ingredientResult.data) ? ingredientResult.data : []
      );
      setSuppliers(
        Array.isArray(supplierResult.data) ? supplierResult.data : []
      );
    } catch (err) {
      setError(
        err.message ||
          "Could not load inventory. Check your backend route and connection."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const expiringSoon = batches.filter((batch) => {
    const expiry = batch.expiryDate ? new Date(batch.expiryDate) : null;

    return (
      getStatus(batch) === "Available" &&
      expiry &&
      expiry >= today &&
      expiry <= nextWeek &&
      Number(batch.quantityRemaining ?? batch.quantity ?? 0) > 0
    );
  }).length;

  const filteredBatches = batches.filter((batch) => {
    const searchableText = [
      batch.batchCode,
      nameOf(batch.ingredientId),
      nameOf(batch.supplierId),
      batch.ingredientId?.ingredientCode,
      batch.supplierId?.supplierCode,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      searchableText.includes(search.toLowerCase()) &&
      (statusFilter === "All" || getStatus(batch) === statusFilter)
    );
  });

  const updateForm = (event) => {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  const receiveStock = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        movementCode: `MOV-${Date.now()}`,
        batchCode: form.batchCode.trim(),
        ingredientId: form.ingredientId,
        quantity: Number(form.quantity),
        unitCost: Number(form.unitCost),
        supplierId: form.supplierId || null,
        receivedDate: form.receivedDate || new Date().toISOString(),
        expiryDate: form.expiryDate || null,
        referenceCode: form.referenceCode.trim() || null,
      };

      const result = await requestJson(BATCHES_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setNotice(result.message || "Stock received successfully.");
      setModal("");
      setForm({
        ...emptyForm,
        receivedDate: new Date().toISOString().slice(0, 10),
      });

      await loadData();
    } catch (err) {
      setError(err.message || "Could not receive stock.");
    } finally {
      setSaving(false);
    }
  };

  const openAddIngredient = () => {
    setIngredientError("");
    setError("");
    setNotice("");

    setIngredientForm({
      ...emptyIngredientForm,
      ingredientCode: nextIngredientCode(ingredients),
    });

    setModal("ingredient");
  };

  const updateIngredientForm = (event) => {
    const { name, value } = event.target;

    setIngredientForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const saveIngredient = async (event) => {
    event.preventDefault();
    setIngredientSaving(true);
    setIngredientError("");

    try {
      const payload = {
        ingredientCode: ingredientForm.ingredientCode.trim().toUpperCase(),
        name: ingredientForm.name.trim(),
        category: ingredientForm.category,
        unit: ingredientForm.unit,
        minimumStock: Number(ingredientForm.minimumStock),
      };

      if (!payload.ingredientCode || !payload.name) {
        throw new Error("Please enter the ingredient code and name.");
      }

      if (
        ingredientForm.minimumStock.trim() === "" ||
        !Number.isFinite(payload.minimumStock) ||
        payload.minimumStock < 0
      ) {
        throw new Error("Minimum stock must be zero or a positive number.");
      }

      const result = await requestJson(`${API_URL}/ingredients`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const newIngredient = result.data;

      await loadData();

      if (newIngredient?._id) {
        setForm((previous) => ({
          ...previous,
          ingredientId: newIngredient._id,
        }));
      }

      setModal("");
      setNotice(result.message || "Ingredient added successfully.");
    } catch (err) {
      setIngredientError(err.message || "Unable to save ingredient.");
    } finally {
      setIngredientSaving(false);
    }
  };

  const openEdit = (batch) => {
    setSelectedBatch(batch);

    setEditForm({
      supplierId: idOf(batch.supplierId) || "",
      expiryDate: batch.expiryDate
        ? new Date(batch.expiryDate).toISOString().slice(0, 10)
        : "",
    });

    setError("");
    setNotice("");
    setModal("edit");
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!selectedBatch?._id) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const result = await requestJson(
        `${BATCHES_URL}/${selectedBatch._id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            expiryDate: editForm.expiryDate || null,
            supplierId: editForm.supplierId || null,
          }),
        }
      );

      setNotice(result.message || "Batch details updated.");
      setModal("");
      setSelectedBatch(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Could not update batch details.");
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    if (saving || ingredientSaving) return;

    setModal("");
    setSelectedBatch(null);
    setError("");
    setIngredientError("");
  };

  return (
    <div className="space-y-6 text-[#244638]">
      {/* Page Header */}
      <header className="flex flex-col justify-between gap-5 rounded-2xl border border-[#dfe8d9] bg-gradient-to-r from-[#e3efdf] via-[#f0f4e9] to-[#fff0e5] p-6 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#64816b]">
            <Leaf size={15} />
            Inventory management
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#244638] sm:text-3xl">
            Stock Batches
          </h1>

          <p className="mt-1.5 max-w-xl text-sm leading-6 text-[#6e8073]">
            Manage received stock, organize ingredient batches, track costs,
            and monitor expiry dates.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe7dc] bg-white px-4 py-3 text-sm font-semibold text-[#244638] transition hover:bg-[#f1f6ed] disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setError("");
              setNotice("");
              setForm({
                ...emptyForm,
                receivedDate: new Date().toISOString().slice(0, 10),
              });
              setModal("receive");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f684b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#24553b] active:scale-[0.98]"
          >
            <Plus size={17} />
            Receive Stock
          </button>
        </div>
      </header>

      {/* Error message */}
      {error && !modal && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto"
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Success message */}
      {notice && !modal && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={18} />
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          icon={Package}
          label="Total batches"
          value={loading ? "—" : batches.length}
          note="All recorded deliveries"
          accent="bg-[#DCE5D8] text-[#173D35]"
        />

        <SummaryCard
          icon={CalendarClock}
          label="Expiring soon"
          value={loading ? "—" : expiringSoon}
          note="Available stock expiring in 7 days"
          accent="bg-[#F4E6CB] text-[#8A6125]"
        />
      </section>

      {/* Batch directory */}
      <section className="rounded-2xl border border-[#E8E5DA] bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5">
          <h2 className="text-lg font-bold">Batch records</h2>
          <p className="mt-1 text-sm text-[#78877C]">
            Search and review received stock and batch details.
          </p>
        </div>

        <div className="mb-5 flex flex-col gap-3 md:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#E4E5DB] bg-[#FCFBF7] px-3">
            <Search size={18} className="shrink-0 text-[#78877C]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search batch, ingredient or supplier..."
              className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-[#A0A79E]"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={16} className="text-[#78877C]" />
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-[#E4E5DB] bg-[#FCFBF7] px-3 py-3 text-sm text-[#173D35] outline-none"
          >
            <option value="All">All statuses</option>
            <option value="Available">Available</option>
            <option value="Depleted">Depleted</option>
            <option value="Expired">Expired</option>
            <option value="Quarantined">Quarantined</option>
          </select>
        </div>

        <div className="mb-4 text-sm text-[#78877C]">
          Showing {filteredBatches.length} of {batches.length} batches
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#78877C]">
            <LoaderCircle size={28} className="animate-spin" />
            <p className="text-sm">Loading stock batches...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-[#F7F4EC] px-4 py-10 text-center">
            <AlertCircle size={28} className="mx-auto mb-3 text-[#78877C]" />
            <p className="font-semibold">Could not load batches</p>
            <p className="mt-1 text-sm text-[#78877C]">
              Check the error above and verify your backend API route.
            </p>
            <button
              type="button"
              onClick={loadData}
              className="mt-4 rounded-lg bg-[#173D35] px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="rounded-xl bg-[#F7F4EC] px-4 py-12 text-center">
            <Package size={32} className="mx-auto mb-3 text-[#78877C]" />
            <p className="font-semibold">No batches found</p>
            <p className="mt-1 text-sm text-[#78877C]">
              Try another search or receive new stock.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredBatches.map((batch) => (
              <BatchCard
                key={batch._id}
                batch={batch}
                onEdit={openEdit}
              />
            ))}
          </div>
        )}
      </section>

      {/* Receive Stock / Edit Batch / Add Ingredient dialogs */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#102A24]/50 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-[#e5e9df] bg-[#fffefa] shadow-2xl"
          >
            {/* Add ingredient dialog */}
            {modal === "ingredient" ? (
              <>
                <div className="flex items-start justify-between gap-4 bg-[#e5f0e0] px-6 py-5">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#618167]">
                      <Leaf size={14} />
                      Ingredient details
                    </div>

                    <h2 className="text-2xl font-bold text-[#244638]">
                      Add ingredient
                    </h2>

                    <p className="mt-1 text-sm text-[#718078]">
                      Register an ingredient before receiving its stock.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={ingredientSaving}
                    aria-label="Close ingredient form"
                    className="rounded-lg p-2 text-[#55705b] hover:bg-white/70 disabled:opacity-60"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={saveIngredient} className="space-y-5 p-6">
                  {ingredientError && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <AlertCircle size={17} className="mt-0.5 shrink-0" />
                      <span>{ingredientError}</span>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-[#405b49]">
                      Ingredient code *
                      <input
                        name="ingredientCode"
                        value={ingredientForm.ingredientCode}
                        onChange={updateIngredientForm}
                        required
                        maxLength={30}
                        placeholder="ING-001"
                        className={inputClass}
                      />
                    </label>

                    <label className="block text-sm font-medium text-[#405b49]">
                      Ingredient name *
                      <input
                        name="name"
                        value={ingredientForm.name}
                        onChange={updateIngredientForm}
                        required
                        maxLength={100}
                        placeholder="e.g. Tomato"
                        className={inputClass}
                      />
                    </label>

                    <label className="block text-sm font-medium text-[#405b49]">
                      Category *
                      <select
                        name="category"
                        value={ingredientForm.category}
                        onChange={updateIngredientForm}
                        className={inputClass}
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-[#405b49]">
                      Measurement unit *
                      <select
                        name="unit"
                        value={ingredientForm.unit}
                        onChange={updateIngredientForm}
                        className={inputClass}
                      >
                        {units.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-[#405b49] sm:col-span-2">
                      Minimum stock level *
                      <input
                        name="minimumStock"
                        type="number"
                        min="0"
                        step="any"
                        value={ingredientForm.minimumStock}
                        onChange={updateIngredientForm}
                        required
                        className={inputClass}
                      />
                      <span className="mt-1.5 block text-xs font-normal text-[#859087]">
                        Used to identify low-stock ingredients.
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-col-reverse gap-3 border-t border-[#e8ebe2] pt-5 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      disabled={ingredientSaving}
                      onClick={closeModal}
                      className="rounded-xl border border-[#dce3d9] px-5 py-3 text-sm font-medium text-[#536359] transition hover:bg-[#f0f4ec] disabled:opacity-60"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={ingredientSaving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f684b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#24553b] disabled:opacity-60"
                    >
                      {ingredientSaving && (
                        <LoaderCircle size={17} className="animate-spin" />
                      )}
                      {ingredientSaving ? "Saving..." : "Save ingredient"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="mb-5 flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
                  <div>
                    <h2 className="text-xl font-bold text-[#244638]">
                      {modal === "receive" ? "Receive stock" : "Edit batch"}
                    </h2>
                    <p className="mt-1 text-sm text-[#78877C]">
                      {modal === "receive"
                        ? "Record a new ingredient delivery."
                        : "Update the supplier or expiry date."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    aria-label="Close dialog"
                    className="rounded-lg p-2 text-[#78877C] hover:bg-[#F7F4EC]"
                  >
                    <X size={20} />
                  </button>
                </div>

                {error && (
                  <div className="mx-5 mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 sm:mx-6">
                    {error}
                  </div>
                )}

                <form
                  onSubmit={modal === "receive" ? receiveStock : saveEdit}
                  className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6"
                >
                  {modal === "receive" ? (
                    <>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#405b49]">
                          Batch number *
                        </label>
                        <input
                          required
                          name="batchCode"
                          value={form.batchCode}
                          onChange={updateForm}
                          placeholder="e.g. BATCH-TOM-003"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                          <label className="text-sm font-medium text-[#405b49]">
                            Ingredient *
                          </label>
                          <button
                            type="button"
                            onClick={openAddIngredient}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2f684b] hover:text-[#24553b]"
                          >
                            <Plus size={14} />
                            Add ingredient
                          </button>
                        </div>

                        <select
                          required
                          name="ingredientId"
                          value={form.ingredientId}
                          onChange={updateForm}
                          className={inputClass}
                        >
                          <option value="">Choose an ingredient</option>
                          {ingredients
                            .filter((item) => item.isActive !== false)
                            .map((item) => (
                              <option key={item._id} value={item._id}>
                                {item.name}
                                {item.ingredientCode
                                  ? ` (${item.ingredientCode})`
                                  : ""}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-[#405b49]">
                          Quantity *
                          <input
                            required
                            min="0.001"
                            step="any"
                            type="number"
                            name="quantity"
                            value={form.quantity}
                            onChange={updateForm}
                            placeholder="e.g. 20"
                            className={inputClass}
                          />
                        </label>

                        <label className="block text-sm font-medium text-[#405b49]">
                          Unit cost (₹) *
                          <input
                            required
                            min="0"
                            step="any"
                            type="number"
                            name="unitCost"
                            value={form.unitCost}
                            onChange={updateForm}
                            placeholder="e.g. 32"
                            className={inputClass}
                          />
                        </label>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#405b49]">
                          Supplier
                        </label>
                        <select
                          name="supplierId"
                          value={form.supplierId}
                          onChange={updateForm}
                          className={inputClass}
                        >
                          <option value="">No supplier assigned</option>
                          {suppliers
                            .filter((item) => item.isActive !== false)
                            .map((item) => (
                              <option key={item._id} value={item._id}>
                                {item.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-[#405b49]">
                          Received date *
                          <input
                            required
                            type="date"
                            name="receivedDate"
                            value={form.receivedDate}
                            onChange={updateForm}
                            className={inputClass}
                          />
                        </label>

                        <label className="block text-sm font-medium text-[#405b49]">
                          Expiry date
                          <input
                            type="date"
                            name="expiryDate"
                            min={form.receivedDate || undefined}
                            value={form.expiryDate}
                            onChange={updateForm}
                            className={inputClass}
                          />
                        </label>
                      </div>

                      <label className="block text-sm font-medium text-[#405b49]">
                        Reference code (optional)
                        <input
                          name="referenceCode"
                          value={form.referenceCode}
                          onChange={updateForm}
                          placeholder="Invoice or delivery reference"
                          className={inputClass}
                        />
                      </label>

                      {form.quantity !== "" && form.unitCost !== "" && (
                        <div className="rounded-xl bg-[#F0F4ED] p-4">
                          <p className="text-sm text-[#53665B]">
                            Estimated total purchase cost
                          </p>
                          <p className="mt-1 text-xl font-bold text-[#173D35]">
                            {money(
                              Number(form.quantity) * Number(form.unitCost)
                            )}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl bg-[#F7F4EC] p-4">
                        <p className="text-xs text-[#78877C]">Batch number</p>
                        <p className="mt-1 font-bold text-[#244638]">
                          {selectedBatch?.batchCode}
                        </p>
                        <p className="mt-1 text-sm text-[#78877C]">
                          Quantity and cost are managed through stock
                          movements.
                        </p>
                      </div>

                      <label className="block text-sm font-medium text-[#405b49]">
                        Supplier
                        <select
                          value={editForm.supplierId}
                          onChange={(event) =>
                            setEditForm((previous) => ({
                              ...previous,
                              supplierId: event.target.value,
                            }))
                          }
                          className={inputClass}
                        >
                          <option value="">No supplier assigned</option>
                          {suppliers
                            .filter((item) => item.isActive !== false)
                            .map((item) => (
                              <option key={item._id} value={item._id}>
                                {item.name}
                              </option>
                            ))}
                        </select>
                      </label>

                      <label className="block text-sm font-medium text-[#405b49]">
                        Expiry date
                        <input
                          type="date"
                          min={
                            selectedBatch?.receivedDate
                              ? new Date(selectedBatch.receivedDate)
                                  .toISOString()
                                  .slice(0, 10)
                              : undefined
                          }
                          value={editForm.expiryDate}
                          onChange={(event) =>
                            setEditForm((previous) => ({
                              ...previous,
                              expiryDate: event.target.value,
                            }))
                          }
                          className={inputClass}
                        />
                      </label>
                    </>
                  )}

                  <div className="flex flex-col-reverse gap-2 border-t border-[#EEECE4] pt-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={saving}
                      className="rounded-xl border border-[#DCE2D7] px-4 py-3 text-sm font-semibold text-[#173D35] hover:bg-[#F7F4EC] disabled:opacity-60"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f684b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#24553b] disabled:opacity-60"
                    >
                      {saving && (
                        <LoaderCircle size={16} className="animate-spin" />
                      )}
                      {saving
                        ? "Saving..."
                        : modal === "receive"
                          ? "Save received stock"
                          : "Save changes"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
