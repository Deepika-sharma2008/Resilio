import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Phone,
  X,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Building2,
  Hash,
  Users,
  Mail,
  Leaf,
} from "lucide-react";

const API_URL = "/api/suppliers";

const emptyForm = {
  supplierCode: "",
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
};

function SummaryCard({ icon: Icon, label, value, note, accent }) {
  return (
    <div className="rounded-2xl border border-[#E8E5DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#78877C]">{label}</p>
        <div className={`rounded-xl p-2.5 ${accent}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold text-[#173D35]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[#78877C]">{note}</p>
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not load suppliers.");
      }

      setSuppliers(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const activeSuppliers = suppliers.filter(
    (supplier) => supplier.isActive !== false
  );

  const filteredSuppliers = activeSuppliers.filter((supplier) => {
    const searchableText = [
      supplier.supplierCode,
      supplier.name,
      supplier.contactPerson,
      supplier.phone,
      supplier.email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(search.trim().toLowerCase());
  });

  function openAddForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function openEditForm(supplier) {
    setEditingId(supplier._id);
    setForm({
      supplierCode: supplier.supplierCode || "",
      name: supplier.name || "",
      contactPerson: supplier.contactPerson || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
    });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not save supplier.");
      }

      setShowForm(false);
      setNotice(
        editingId
          ? "Supplier updated successfully."
          : "Supplier added successfully."
      );

      await loadSuppliers();
    } catch (err) {
      setError(err.message || "Could not save supplier.");
    } finally {
      setSaving(false);
    }
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditingId(null);
  }

  return (
    <div className="space-y-6 pb-8 text-[#244638]">
      {/* Page header — matches Stock Batches */}
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-[#dfe8d9] bg-gradient-to-r from-[#e3efdf] via-[#f0f4e9] to-[#fff0e5] p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#64816b]">
            <Leaf size={15} />
            Inventory management
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#244638] sm:text-3xl">
            Suppliers
          </h1>

          <p className="mt-1.5 max-w-xl text-sm leading-6 text-[#6e8073]">
            Manage the people and businesses that supply your ingredients.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadSuppliers}
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
            onClick={openAddForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f684b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#24553b] active:scale-[0.98]"
          >
            <Plus size={17} />
            Add supplier
          </button>
        </div>
      </header>

      {/* Feedback messages */}
      {notice && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={19} />
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

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
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

      {/* Summary card */}
      <section className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          icon={Users}
          label="Total suppliers"
          value={loading ? "—" : activeSuppliers.length}
          note="Active suppliers available for purchasing"
          accent="bg-[#DCE5D8] text-[#173D35]"
        />
      </section>

      {/* Add / Edit supplier form */}
      {showForm && (
        <section className="overflow-hidden rounded-2xl border border-[#E8E5DA] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[#E8EAE1] bg-[#F2F5ED] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-white p-3 text-[#315E49]">
                {editingId ? <Pencil size={20} /> : <Building2 size={20} />}
              </span>
              <div>
                <h2 className="font-bold text-[#173D35]">
                  {editingId ? "Edit supplier" : "Add a supplier"}
                </h2>
                <p className="mt-1 text-xs text-[#78877C]">
                  Enter the supplier's basic details.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              aria-label="Close form"
              className="rounded-lg p-2 hover:bg-white disabled:opacity-60"
            >
              <X size={19} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-semibold">
                Supplier code *
                <span className="relative block">
                  <Hash
                    size={16}
                    className="absolute left-3 top-3.5 text-[#78877C]"
                  />
                  <input
                    name="supplierCode"
                    value={form.supplierCode}
                    onChange={updateField}
                    required
                    maxLength={30}
                    placeholder="e.g. SUP-001"
                    className="w-full rounded-xl border border-[#DCE5D8] bg-[#FCFCF8] py-3 pl-10 pr-3 font-normal outline-none focus:border-[#527A61] focus:ring-2 focus:ring-[#DCE5D8]"
                  />
                </span>
              </label>

              <label className="block space-y-2 text-sm font-semibold">
                Supplier name *
                <span className="relative block">
                  <Building2
                    size={16}
                    className="absolute left-3 top-3.5 text-[#78877C]"
                  />
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    required
                    maxLength={100}
                    placeholder="Business or supplier name"
                    className="w-full rounded-xl border border-[#DCE5D8] bg-[#FCFCF8] py-3 pl-10 pr-3 font-normal outline-none focus:border-[#527A61] focus:ring-2 focus:ring-[#DCE5D8]"
                  />
                </span>
              </label>

              <label className="block space-y-2 text-sm font-semibold">
                Contact person
                <input
                  name="contactPerson"
                  value={form.contactPerson}
                  onChange={updateField}
                  maxLength={100}
                  placeholder="Contact person's name"
                  className="w-full rounded-xl border border-[#DCE5D8] bg-[#FCFCF8] px-3 py-3 font-normal outline-none focus:border-[#527A61] focus:ring-2 focus:ring-[#DCE5D8]"
                />
              </label>

              <label className="block space-y-2 text-sm font-semibold">
                Phone number *
                <span className="relative block">
                  <Phone
                    size={16}
                    className="absolute left-3 top-3.5 text-[#78877C]"
                  />
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={updateField}
                    required
                    maxLength={25}
                    placeholder="Phone number"
                    className="w-full rounded-xl border border-[#DCE5D8] bg-[#FCFCF8] py-3 pl-10 pr-3 font-normal outline-none focus:border-[#527A61] focus:ring-2 focus:ring-[#DCE5D8]"
                  />
                </span>
              </label>

              <label className="block space-y-2 text-sm font-semibold sm:col-span-2">
                Email address
                <span className="relative block">
                  <Mail
                    size={16}
                    className="absolute left-3 top-3.5 text-[#78877C]"
                  />
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateField}
                    maxLength={150}
                    placeholder="supplier@example.com"
                    className="w-full rounded-xl border border-[#DCE5D8] bg-[#FCFCF8] py-3 pl-10 pr-3 font-normal outline-none focus:border-[#527A61] focus:ring-2 focus:ring-[#DCE5D8]"
                  />
                </span>
              </label>

              <label className="block space-y-2 text-sm font-semibold sm:col-span-2">
                Address{" "}
                <span className="font-normal text-[#78877C]">
                  (optional)
                </span>
                <input
                  name="address"
                  value={form.address}
                  onChange={updateField}
                  maxLength={250}
                  placeholder="City or business address"
                  className="w-full rounded-xl border border-[#DCE5D8] bg-[#FCFCF8] px-3 py-3 font-normal outline-none focus:border-[#527A61] focus:ring-2 focus:ring-[#DCE5D8]"
                />
              </label>
            </div>

            <div className="flex flex-col-reverse justify-end gap-3 border-t border-[#E8EAE1] pt-5 sm:flex-row">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl border border-[#DCE5D8] px-5 py-3 text-sm font-semibold hover:bg-[#F7F8F2] disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f684b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#24553b] disabled:opacity-60"
              >
                {saving && (
                  <LoaderCircle size={17} className="animate-spin" />
                )}
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Add supplier"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Supplier list */}
      <section className="overflow-hidden rounded-2xl border border-[#E8E5DA] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#E8EAE1] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-[#173D35]">
              Supplier list
            </h2>
            <p className="mt-1 text-sm text-[#78877C]">
              Contact details for your ingredient suppliers.
            </p>
          </div>

          <label className="relative block w-full sm:max-w-xs">
            <Search
              size={17}
              className="absolute left-3 top-3.5 text-[#78877C]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search suppliers..."
              className="w-full rounded-xl border border-[#DCE5D8] bg-[#FCFCF8] py-3 pl-10 pr-3 text-sm outline-none focus:border-[#527A61] focus:ring-2 focus:ring-[#DCE5D8]"
            />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-14 text-sm text-[#78877C]">
            <LoaderCircle size={22} className="animate-spin" />
            Loading suppliers...
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users size={30} className="mx-auto text-[#78877C]" />
            <h3 className="mt-3 font-bold text-[#173D35]">
              No suppliers found
            </h3>
            <p className="mt-2 text-sm text-[#78877C]">
              {search
                ? "Try a different search."
                : "Add your first supplier to get started."}
            </p>
            {!search && (
              <button
                type="button"
                onClick={openAddForm}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2f684b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#24553b]"
              >
                <Plus size={16} />
                Add supplier
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Cards on small screens */}
            <div className="grid gap-4 p-4 md:hidden">
              {filteredSuppliers.map((supplier) => (
                <article
                  key={supplier._id}
                  className="rounded-2xl border border-[#E8E5DA] bg-[#FCFBF7] p-5 shadow-sm transition hover:border-[#C7D5C8] hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#DCE5D8] font-bold text-[#173D35]">
                        {(supplier.name || "S").slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h3 className="break-words font-bold text-[#173D35]">
                          {supplier.name}
                        </h3>
                        <p className="mt-1 text-xs text-[#78877C]">
                          {supplier.supplierCode}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditForm(supplier)}
                      aria-label={`Edit ${supplier.name}`}
                      className="rounded-lg border border-[#DCE5D8] p-2 text-[#315E49] transition hover:bg-[#EDF2E8]"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-[#53665B]">
                    <p>{supplier.contactPerson || "Contact person not added"}</p>
                    <p className="flex items-center gap-2">
                      <Phone size={14} />
                      {supplier.phone || "No phone number"}
                    </p>
                    {supplier.email && (
                      <p className="flex items-center gap-2 break-all">
                        <Mail size={14} />
                        {supplier.email}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {/* Table on larger screens */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-[#F7F4EC] text-xs uppercase tracking-wider text-[#78877C]">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Supplier</th>
                    <th className="px-6 py-4 font-semibold">Contact person</th>
                    <th className="px-6 py-4 font-semibold">Phone</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEECE4]">
                  {filteredSuppliers.map((supplier) => (
                    <tr
                      key={supplier._id}
                      className="transition hover:bg-[#FCFBF7]"
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#173D35]">
                          {supplier.name}
                        </p>
                        <p className="mt-1 text-xs text-[#78877C]">
                          {supplier.supplierCode}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {supplier.contactPerson || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2">
                          <Phone size={14} className="text-[#78877C]" />
                          {supplier.phone || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditForm(supplier)}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#DCE5D8] px-3 py-2 text-sm font-medium text-[#315E49] transition hover:bg-[#EDF2E8]"
                        >
                          <Pencil size={15} />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}