
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  Pencil,
  X,
  Leaf,
  Package,
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Power,
  Carrot,
  Tag,
  CalendarClock,
} from "lucide-react";

const API_URL = "/api";

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

const emptyForm = {
  ingredientCode: "",
  name: "",
  category: "Vegetables",
  unit: "kg",
  minimumStock: "5",
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[#dfe7dc] bg-white px-3.5 py-2.5 text-sm text-[#244638] outline-none transition placeholder:text-[#a0aaa0] focus:border-[#6b9b78] focus:ring-2 focus:ring-[#dcebd9]";

async function readResponse(response) {
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Something went wrong.");
  }

  return result;
}

function nextIngredientCode(ingredients) {
  const largest = ingredients.reduce((max, item) => {
    const match = item.ingredientCode?.match(/^ING-(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `ING-${String(largest + 1).padStart(3, "0")}`;
}

function formatDateTime(date) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const categoryColors = {
  Vegetables: "bg-green-100 text-green-800",
  Fruits: "bg-orange-100 text-orange-800",
  Dairy: "bg-sky-100 text-sky-800",
  Meat: "bg-rose-100 text-rose-800",
  Grains: "bg-amber-100 text-amber-800",
  Spices: "bg-purple-100 text-purple-800",
  Oils: "bg-yellow-100 text-yellow-800",
  Other: "bg-slate-100 text-slate-700",
};

function StatCard({ label, value, icon: Icon, note, color }) {
  return (
    <div className="rounded-2xl border border-[#e8eadf] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#718078]">{label}</p>
          <p className="mt-2 text-3xl font-bold text-[#244638]">{value}</p>
          <p className="mt-1.5 text-xs text-[#89958c]">{note}</p>
        </div>

        <div className={`rounded-2xl p-3.5 ${color}`}>
          <Icon size={23} />
        </div>
      </div>
    </div>
  );
}

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reactivatingId, setReactivatingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // Load the latest ingredient records from the backend.
  const loadIngredients = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/ingredients?includeInactive=true`,
        {
          credentials: "include",
        }
      );

      const result = await readResponse(response);
      setIngredients(result.data || []);
    } catch (err) {
      setError(err.message || "Unable to load ingredients.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + automatic refresh after offline inventory sync.
  useEffect(() => {
    loadIngredients();

    const handleInventorySync = (event) => {
      loadIngredients();

      const ingredientName = event.detail?.ingredientName;

      setNotice(
        ingredientName
          ? `${ingredientName} synced successfully. Refreshing ingredient records...`
          : "Offline inventory synced. Refreshing ingredient records..."
      );
    };

    window.addEventListener(
      "resilio:inventory-synced",
      handleInventorySync
    );

    return () => {
      window.removeEventListener(
        "resilio:inventory-synced",
        handleInventorySync
      );
    };
  }, [loadIngredients]);

  const activeIngredients = useMemo(
    () => ingredients.filter((item) => item.isActive !== false),
    [ingredients]
  );

  const inactiveIngredients = useMemo(
    () => ingredients.filter((item) => item.isActive === false),
    [ingredients]
  );

  const filteredIngredients = useMemo(() => {
    const term = search.trim().toLowerCase();

    return ingredients.filter((item) => {
      const isActive = item.isActive !== false;

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" && isActive) ||
        (statusFilter === "Inactive" && !isActive);

      const matchesSearch =
        !term ||
        [item.name, item.ingredientCode, item.category].some((value) =>
          value?.toLowerCase().includes(term)
        );

      const matchesCategory =
        categoryFilter === "All" || item.category === categoryFilter;

      return matchesStatus && matchesSearch && matchesCategory;
    });
  }, [ingredients, search, categoryFilter, statusFilter]);

  const categoryCount = new Set(
    activeIngredients.map((item) => item.category)
  ).size;

  function openAddForm() {
    setEditingId(null);

    setForm({
      ...emptyForm,
      ingredientCode: nextIngredientCode(ingredients),
    });

    setError("");
    setNotice("");
    setShowForm(true);
  }

  function openEditForm(item) {
    setEditingId(item._id);

    setForm({
      ingredientCode: item.ingredientCode || "",
      name: item.name || "",
      category: item.category || "Other",
      unit: item.unit || "kg",
      minimumStock: String(item.minimumStock ?? 5),
    });

    setError("");
    setNotice("");
    setShowForm(true);
  }

  function updateField(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ingredientCode: form.ingredientCode.trim().toUpperCase(),
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        minimumStock: Number(form.minimumStock),
      };

      if (!payload.ingredientCode || !payload.name) {
        throw new Error("Please enter the ingredient code and name.");
      }

      if (
        form.minimumStock.trim() === "" ||
        !Number.isFinite(payload.minimumStock) ||
        payload.minimumStock < 0
      ) {
        throw new Error(
          "Minimum stock must be zero or a positive number."
        );
      }

      const response = await fetch(
        editingId
          ? `${API_URL}/ingredients/${editingId}`
          : `${API_URL}/ingredients`,
        {
          method: editingId ? "PUT" : "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      await readResponse(response);

      setShowForm(false);

      setNotice(
        editingId
          ? "Ingredient details updated successfully."
          : "Ingredient added successfully."
      );

      await loadIngredients();
    } catch (err) {
      setError(err.message || "Unable to save ingredient.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateIngredient(item) {
    const confirmed = window.confirm(
      `Deactivate "${item.name}"? It will remain saved in the database and can be reactivated later.`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await readResponse(
        await fetch(`${API_URL}/ingredients/${item._id}`, {
          method: "DELETE",
          credentials: "include",
        })
      );

      setNotice(`${item.name} has been deactivated.`);
      await loadIngredients();
    } catch (err) {
      setError(err.message || "Unable to deactivate ingredient.");
    }
  }

  async function reactivateIngredient(item) {
    const confirmed = window.confirm(`Reactivate "${item.name}"?`);

    if (!confirmed) return;

    setError("");
    setNotice("");
    setReactivatingId(item._id);

    try {
      const result = await readResponse(
        await fetch(
          `${API_URL}/ingredients/${item._id}/reactivate`,
          {
            method: "PATCH",
            credentials: "include",
          }
        )
      );

      setNotice(
        result.message || `${item.name} reactivated successfully.`
      );

      await loadIngredients();
      setStatusFilter("Active");
    } catch (err) {
      setError(err.message || "Unable to reactivate ingredient.");
    } finally {
      setReactivatingId(null);
    }
  }

  return (
    <div className="space-y-6 text-[#244638]">
      <section className="flex flex-col justify-between gap-5 rounded-2xl border border-[#dfe8d9] bg-gradient-to-r from-[#e3efdf] via-[#f0f4e9] to-[#fff0e5] p-6 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#64816b]">
            <Leaf size={15} />
            Inventory management
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ingredients
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-[#6e8073]">
            Manage your restaurant ingredients, organize categories, and set
            minimum stock levels.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f684b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#24553b] active:scale-[0.98]"
        >
          <Plus size={18} />
          Add ingredient
        </button>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertTriangle size={19} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 size={19} className="shrink-0" />
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Active ingredients"
          value={activeIngredients.length}
          icon={Package}
          note="Currently available in inventory"
          color="bg-[#e0efdd] text-[#42734c]"
        />

        <StatCard
          label="Inactive ingredients"
          value={inactiveIngredients.length}
          icon={Power}
          note="Saved but currently deactivated"
          color="bg-[#fff0e8] text-[#b56d4d]"
        />

        <StatCard
          label="Categories in use"
          value={categoryCount}
          icon={Tag}
          note="Categories among active ingredients"
          color="bg-[#ffead9] text-[#b36d36]"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e5e9df] bg-white shadow-sm">
        <div className="border-b border-[#edf0e9] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">Ingredient directory</h2>
              <p className="mt-1 text-sm text-[#849087]">
                Search, filter, and manage active and inactive ingredients.
              </p>
            </div>

            <span className="w-fit rounded-full bg-[#edf5e9] px-3 py-1.5 text-xs font-semibold text-[#4c7654]">
              {filteredIngredients.length} results
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#89958c]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ingredients..."
                className="w-full rounded-xl border border-[#dfe7dc] bg-[#fcfdf9] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#78a17b] focus:ring-2 focus:ring-[#e0efdd]"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-[#dfe7dc] bg-[#fcfdf9] px-4 py-3 text-sm outline-none focus:border-[#78a17b]"
              aria-label="Filter by ingredient status"
            >
              <option value="Active">Active ingredients</option>
              <option value="Inactive">Inactive ingredients</option>
              <option value="All">All ingredients</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-[#dfe7dc] bg-[#fcfdf9] px-4 py-3 text-sm outline-none focus:border-[#78a17b]"
              aria-label="Filter by category"
            >
              <option value="All">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadIngredients}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe7dc] bg-white px-4 py-3 text-sm font-medium transition hover:bg-[#f1f6ed] disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead className="bg-[#f4f7f0] text-xs uppercase tracking-wider text-[#718078]">
              <tr>
                <th className="px-6 py-4 font-semibold">Ingredient</th>
                <th className="px-5 py-4 font-semibold">Category</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">Unit</th>
                <th className="px-5 py-4 font-semibold">Minimum stock</th>
                <th className="px-5 py-4 font-semibold">Created At</th>
                <th className="px-5 py-4 font-semibold">Updated At</th>
                <th className="px-5 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#edf0e9]">
              {!loading &&
                filteredIngredients.map((item) => {
                  const isActive = item.isActive !== false;

                  return (
                    <tr
                      key={item._id}
                      className={`transition hover:bg-[#fbfcf8] ${
                        !isActive ? "bg-[#fffdfa]" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              isActive
                                ? "bg-[#e6f1e2] text-[#47754e]"
                                : "bg-[#f5e9df] text-[#a77555]"
                            }`}
                          >
                            <Carrot size={19} />
                          </div>

                          <div>
                            <p className="font-semibold text-[#294637]">
                              {item.name}
                            </p>
                            <p className="mt-1 text-xs text-[#89958c]">
                              {item.ingredientCode}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
                            categoryColors[item.category] ||
                            categoryColors.Other
                          }`}
                        >
                          {item.category}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                            isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isActive ? "bg-green-600" : "bg-orange-500"
                            }`}
                          />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-[#536359]">
                        {item.unit}
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-semibold text-[#294637]">
                          {item.minimumStock}
                        </span>{" "}
                        <span className="text-[#89958c]">{item.unit}</span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-start gap-2">
                          <CalendarClock
                            size={16}
                            className="mt-0.5 shrink-0 text-[#729477]"
                          />
                          <div>
                            <p className="text-xs font-medium text-[#405b49]">
                              {formatDateTime(item.createdAt)}
                            </p>
                            <p className="mt-1 text-[10px] text-[#89958c]">
                              First created
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-start gap-2">
                          <RefreshCw
                            size={15}
                            className="mt-0.5 shrink-0 text-[#b58a60]"
                          />
                          <div>
                            <p className="text-xs font-medium text-[#718078]">
                              {formatDateTime(item.updatedAt)}
                            </p>
                            <p className="mt-1 text-[10px] text-[#89958c]">
                              Last modified
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(item)}
                            title="Edit ingredient"
                            aria-label={`Edit ${item.name}`}
                            className="rounded-lg bg-[#e9f2e5] p-2.5 text-[#43734b] transition hover:bg-[#d7e9d1]"
                          >
                            <Pencil size={16} />
                          </button>

                          {isActive ? (
                            <button
                              type="button"
                              onClick={() => deactivateIngredient(item)}
                              title="Deactivate ingredient"
                              aria-label={`Deactivate ${item.name}`}
                              className="rounded-lg bg-[#fff0e8] p-2.5 text-[#b56d4d] transition hover:bg-[#ffe1d3]"
                            >
                              <Power size={16} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => reactivateIngredient(item)}
                              disabled={reactivatingId === item._id}
                              title="Reactivate ingredient"
                              aria-label={`Reactivate ${item.name}`}
                              className="rounded-lg bg-[#e9f2e5] p-2.5 text-[#43734b] transition hover:bg-[#d7e9d1] disabled:opacity-60"
                            >
                              {reactivatingId === item._id ? (
                                <LoaderCircle
                                  size={16}
                                  className="animate-spin"
                                />
                              ) : (
                                <RefreshCw size={16} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-14 text-center text-[#718078]"
                  >
                    <LoaderCircle
                      size={23}
                      className="mx-auto mb-3 animate-spin"
                    />
                    Loading ingredients...
                  </td>
                </tr>
              )}

              {!loading && filteredIngredients.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf5e9] text-[#63866a]">
                      <Package size={27} />
                    </div>

                    <p className="font-semibold text-[#294637]">
                      {statusFilter === "Inactive"
                        ? "No inactive ingredients"
                        : statusFilter === "Active"
                          ? "No active ingredients found"
                          : "No matching ingredients found"}
                    </p>

                    <p className="mt-1 text-sm text-[#849087]">
                      {statusFilter === "Inactive"
                        ? "Deactivated ingredients will appear here."
                        : "Try another search or category."}
                    </p>

                    {statusFilter === "Active" && ingredients.length === 0 && (
                      <button
                        type="button"
                        onClick={openAddForm}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#2f684b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#24553b]"
                      >
                        <Plus size={16} />
                        Add ingredient
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#edf0e9] bg-[#fcfdf9] px-5 py-4 text-xs text-[#879289] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            Showing {filteredIngredients.length} of {ingredients.length} registered ingredients
          </span>

          <span>
            {activeIngredients.length} active · {inactiveIngredients.length} inactive
          </span>
        </div>
      </section>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#173d35]/40 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setShowForm(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ingredient-form-title"
            className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-[#e5e9df] bg-[#fffefa] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 bg-[#e5f0e0] px-6 py-5">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#618167]">
                  <Leaf size={14} />
                  Ingredient details
                </div>

                <h2
                  id="ingredient-form-title"
                  className="text-2xl font-bold text-[#244638]"
                >
                  {editingId ? "Edit ingredient" : "Add ingredient"}
                </h2>

                <p className="mt-1 text-sm text-[#718078]">
                  Enter the details for your inventory.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={saving}
                aria-label="Close form"
                className="rounded-lg p-2 text-[#55705b] hover:bg-white/70 disabled:opacity-60"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#405b49]">
                  Ingredient code *
                  <input
                    name="ingredientCode"
                    value={form.ingredientCode}
                    onChange={updateField}
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
                    value={form.name}
                    onChange={updateField}
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
                    value={form.category}
                    onChange={updateField}
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
                    value={form.unit}
                    onChange={updateField}
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
                    value={form.minimumStock}
                    onChange={updateField}
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
                  disabled={saving}
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-[#dce3d9] px-5 py-3 text-sm font-medium text-[#536359] transition hover:bg-[#f0f4ec] disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f684b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#24553b] disabled:opacity-60"
                >
                  {saving && (
                    <LoaderCircle size={17} className="animate-spin" />
                  )}

                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Save ingredient"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
