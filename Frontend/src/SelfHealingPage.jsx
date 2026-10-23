
import { useEffect, useState } from "react";

const API = "/api/admin/failures";

const failureTypes = [
  { id: "database", name: "Database Health Check" },
  { id: "order", name: "Order Processing Demo" },
  { id: "api", name: "API Recovery Demo" }
];

export default function SelfHealingPage() {
  const [ingredients, setIngredients] = useState([]);
  const [ingredientId, setIngredientId] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    try {
      const [ingredientResponse, historyResponse] =
        await Promise.all([
          fetch(`${API}/ingredients`),
          fetch(`${API}/history`)
        ]);

      const ingredientResult = await ingredientResponse.json();
      const historyResult = await historyResponse.json();

      if (!ingredientResponse.ok || !historyResponse.ok) {
        throw new Error("Could not load self-healing data");
      }

      setIngredients(ingredientResult.data || []);
      setIncidents(historyResult.incidents || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function runTest(type) {
    setLoading(type);
    setError("");

    try {
      const response = await fetch(`${API}/simulate/${type}`, {
        method: "POST"
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Test failed");
      }

      await loadData();
    } catch (err) {
      setError(err.message);
      await loadData();
    } finally {
      setLoading("");
    }
  }

  async function reconcileInventory() {
    if (!ingredientId) {
      setError("Please select an ingredient first");
      return;
    }

    setLoading("inventory");
    setError("");

    try {
      const response = await fetch(
        `${API}/inventory/reconcile/${ingredientId}`,
        { method: "POST" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Reconciliation failed");
      }

      await loadData();
    } catch (err) {
      setError(err.message);
      await loadData();
    } finally {
      setLoading("");
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">
          Self-Healing Monitor
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Monitor inventory repair, health checks and recovery tests.
        </p>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">
          Inventory Reconciliation
        </h2>

        <select
          className="mb-3 w-full rounded-lg border p-3"
          value={ingredientId}
          onChange={e => setIngredientId(e.target.value)}
        >
          <option value="">Select ingredient</option>
          {ingredients.map(item => (
            <option key={item._id} value={item._id}>
              {item.name} ({item.ingredientCode})
            </option>
          ))}
        </select>

        <button
          disabled={!!loading || !ingredientId}
          onClick={reconcileInventory}
          className="rounded-lg bg-green-700 px-4 py-3 text-white disabled:opacity-50"
        >
          {loading === "inventory"
            ? "Checking stock..."
            : "Check & Repair Inventory"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {failureTypes.map(item => (
          <button
            key={item.id}
            disabled={!!loading}
            onClick={() => runTest(item.id)}
            className="rounded-xl bg-purple-800 p-4 text-left text-white disabled:opacity-50"
          >
            <span className="block font-semibold">{item.name}</span>
            <span className="mt-2 block text-sm">
              {loading === item.id
                ? "Running..."
                : "Run recovery test"}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <h2 className="p-4 text-lg font-semibold">
          Incident History
        </h2>

        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3">Failure</th>
              <th className="p-3">Status</th>
              <th className="p-3">Healing</th>
              <th className="p-3">Time</th>
            </tr>
          </thead>

          <tbody>
            {incidents.map(item => (
              <tr key={item.id} className="border-t">
                <td className="p-3">{item.failure}</td>
                <td className="p-3">{item.status}</td>
                <td className="p-3">{item.healing}</td>
                <td className="p-3">
                  {item.recoveryTimeMs == null
                    ? "—"
                    : `${item.recoveryTimeMs} ms`}
                </td>
              </tr>
            ))}

            {incidents.length === 0 && (
              <tr>
                <td colSpan="4" className="p-4 text-gray-500">
                  No incidents recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
