
import { useState } from "react";

export default function DatabaseFailureTest() {
  const [loading, setLoading] = useState(false);
  const [incident, setIncident] = useState(null);
  const [error, setError] = useState("");

  const testDatabaseFailure = async () => {
    const confirmed = window.confirm(
      "This test will disconnect the application's MongoDB connection temporarily. Continue?"
    );

    if (!confirmed) return;

    setLoading(true);
    setIncident(null);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/failures/database-failure",
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (data.incident) {
        setIncident(data.incident);
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Database recovery failed"
        );
      }
    } catch (err) {
      setError(
        err.message || "Unable to connect to the backend"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 text-white">
      <h2 className="mb-2 text-xl font-bold">
        Database Self-Healing
      </h2>

      <p className="mb-4 text-sm text-gray-400">
        Test database connection failure and automatic recovery.
      </p>

      <button
        onClick={testDatabaseFailure}
        disabled={loading}
        className="rounded-lg bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Failure detected / Healing in progress..."
          : "Test Database Failure"}
      </button>

      {loading && (
        <div className="mt-5 rounded-lg bg-gray-800 p-4">
          <p className="animate-pulse text-yellow-400">
            Processing database failure and retries...
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Waiting for the backend recovery result.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-950 p-4">
          <p className="font-semibold text-red-400">
            Request / Recovery Error
          </p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {incident && (
        <div className="mt-5 space-y-3">
          <div className="rounded-lg bg-gray-800 p-4">
            <p className="text-sm text-gray-400">
              Recovery Status
            </p>

            <p
              className={`text-xl font-bold ${
                incident.status === "RECOVERED"
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {incident.status}
            </p>

            <p className="mt-2 text-sm">
              Attempts: {incident.attempts ?? "N/A"}
            </p>

            <p className="text-sm">
              Recovery Time:{" "}
              {incident.recoveryTimeMs ?? "N/A"} ms
            </p>
          </div>

          <div className="rounded-lg bg-gray-800 p-4">
            <h3 className="mb-3 font-semibold">
              Failure & Recovery Timeline
            </h3>

            {incident.events?.length ? (
              <ol className="space-y-3">
                {incident.events.map((event, index) => (
                  <li key={index} className="border-l-2 border-purple-500 pl-3">
                    <p className="text-sm">{event.message}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(event.time).toLocaleTimeString()}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-400">
                No event timeline was returned.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
