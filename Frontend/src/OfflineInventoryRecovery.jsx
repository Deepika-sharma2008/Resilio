
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./OfflineInventoryRecovery.css";

const DB_NAME = "resilio-offline-inventory";
const STORE_NAME = "pending-operations";
const SYNC_ENDPOINT = "/api/admin/inventory/offline-sync";

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "operationId",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Could not open local offline queue."));
  });
}

async function queueRequest(mode, action) {
  const db = await openQueueDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let request;

    try {
      request = action(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }

    tx.oncomplete = () => {
      const result = request?.result;
      db.close();
      resolve(result);
    };

    tx.onerror = () => {
      const error = tx.error;
      db.close();
      reject(error);
    };

    tx.onabort = () => {
      const error = tx.error;
      db.close();
      reject(error);
    };
  });
}

const getAllPending = () =>
  queueRequest("readonly", (store) => store.getAll());

const savePending = (item) =>
  queueRequest("readwrite", (store) => store.put(item));

const removePending = (id) =>
  queueRequest("readwrite", (store) => store.delete(id));

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime(value) {
  if (!value) return "—";

  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function OfflineInventoryRecovery() {
  const [items, setItems] = useState([]);
  const [ingredient, setIngredient] = useState("Tomato");
  const [quantity, setQuantity] = useState("5");
  const [unit, setUnit] = useState("kg");
  const [realOnline, setRealOnline] = useState(navigator.onLine);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");

  const [events, setEvents] = useState([
    {
      label: "Offline sync monitor ready",
      time: new Date().toISOString(),
      kind: "info",
    },
  ]);

  const syncingRef = useRef(false);
  const offline = !realOnline || simulateOffline;

  const addEvent = useCallback((label, kind = "info") => {
    setEvents((previous) =>
      [...previous, { label, kind, time: new Date().toISOString() }].slice(-30)
    );
  }, []);

  const refreshQueue = useCallback(async () => {
    try {
      const data = await getAllPending();

      setItems(
        (data || []).sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        )
      );
    } catch (error) {
      setNotice(`Local storage error: ${error.message}`);
    }
  }, []);

  const deletePendingItem = useCallback(
    async (operationId) => {
      const confirmed = window.confirm(
        "Remove this item from the local pending queue? This will not update MongoDB."
      );

      if (!confirmed) return;

      try {
        await removePending(operationId);
        await refreshQueue();

        addEvent("Pending queue item removed manually", "warning");
        setNotice("Queue item removed successfully.");
      } catch (error) {
        setNotice(`Delete failed: ${error.message}`);
      }
    },
    [refreshQueue, addEvent]
  );

  useEffect(() => {
    refreshQueue();

    const onlineHandler = () => {
      setRealOnline(true);
      addEvent("Network connection restored — automatic sync starting", "success");
    };

    const offlineHandler = () => {
      setRealOnline(false);
      addEvent(
        "Network connection lost — new entries will be queued",
        "warning"
      );
    };

    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);

    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, [refreshQueue, addEvent]);

  const pendingCount = useMemo(
    () => items.filter((item) => item.status !== "SYNCED").length,
    [items]
  );

  const syncQueue = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine || simulateOffline) {
      return;
    }

    syncingRef.current = true;
    setSyncing(true);
    setNotice("");

    try {
      const pending = (await getAllPending())
        .filter((item) => item.status !== "SYNCED")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        );

      if (pending.length === 0) {
        addEvent("Sync check complete — no pending inventory items", "success");
        setNotice("Queue is clear. No pending items to sync.");
        return;
      }

      addEvent(`Sync started for ${pending.length} pending item(s)`);

      for (const item of pending) {
        if (!navigator.onLine || simulateOffline) break;

        const attempt = {
          ...item,
          attempts: (item.attempts || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          status: "SYNCING",
        };

        await savePending(attempt);
        await refreshQueue();

        try {
          const response = await fetch(SYNC_ENDPOINT, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": item.operationId,
            },
            body: JSON.stringify({
              operationId: item.operationId,
              ingredientName: item.ingredientName,
              quantity: item.quantity,
              unit: item.unit,
              category: item.category || "Vegetables",
              minimumStock: item.minimumStock ?? 5,
              ingredientCode: item.ingredientCode || "",
              action: item.action,
              createdAt: item.createdAt,
            }),
          });

          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            if (response.status === 404) {
              throw new Error(
                `HTTP 404: Backend route ${SYNC_ENDPOINT} not found. Check your Express route.`
              );
            }

            throw new Error(
              payload.message || `Server returned HTTP ${response.status}`
            );
          }

          if (payload.success === false) {
            throw new Error(payload.message || "Server could not save the inventory item.");
          }

          // Remove the local entry only after the server confirms success.
          await removePending(item.operationId);

          // Notify the Ingredients page to fetch the latest database data.
          window.dispatchEvent(
            new CustomEvent("resilio:inventory-synced", {
              detail: {
                operationId: item.operationId,
                ingredientName: item.ingredientName,
                quantity: item.quantity,
                unit: item.unit,
                response: payload,
              },
            })
          );

          addEvent(
            `${item.ingredientName}: ${item.quantity} ${item.unit} synced successfully`,
            "success"
          );

          addEvent(
            "Database sync confirmed — Ingredients page refresh event sent",
            "success"
          );
        } catch (error) {
          await savePending({
            ...attempt,
            status: "PENDING",
            lastError: error.message,
          });

          addEvent(
            `${item.ingredientName} sync failed: ${error.message}`,
            "error"
          );

          setNotice(
            `Sync pending: ${error.message}. Item remains in the local queue.`
          );

          break;
        }

        await refreshQueue();
      }

      await refreshQueue();

      const remaining = (await getAllPending()).filter(
        (item) => item.status !== "SYNCED"
      ).length;

      if (remaining === 0) {
        setNotice("All queued entries synced successfully.");
        addEvent("Recovery complete — pending queue is empty", "success");
      } else {
        setNotice(
          `${remaining} item(s) still pending. Check the API connection and retry sync.`
        );
      }
    } catch (error) {
      setNotice(`Sync error: ${error.message}`);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [simulateOffline, refreshQueue, addEvent]);

  useEffect(() => {
    if (!offline) {
      syncQueue();
    }
  }, [offline, syncQueue]);

  async function addInventory(event) {
    event.preventDefault();

    const cleanName = ingredient.trim();
    const amount = Number(quantity);

    if (!cleanName || !Number.isFinite(amount) || amount <= 0) {
      setNotice("Ingredient name aur positive quantity enter karo.");
      return;
    }

    const entry = {
      operationId: makeId(),
      ingredientName: cleanName,
      quantity: amount,
      unit,
      action: "ADD_STOCK",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    try {
      await savePending(entry);
      await refreshQueue();

      setNotice(
        offline
          ? "Saved locally. Connection restore hone par sync hoga."
          : "Saved to offline queue. Sync starting..."
      );

      addEvent(
        `${cleanName}: ${amount} ${unit} saved to local queue`,
        "warning"
      );

      setQuantity("");

      if (!offline) {
        syncQueue();
      }
    } catch (error) {
      setNotice(`Save failed: ${error.message}`);
    }
  }

  return (
    <main className="oir-page">
      <header className="oir-header">
        <div>
          <p className="oir-eyebrow">RESILIO · SELF-HEALING SYSTEM</p>
          <h1>Offline Inventory Recovery</h1>
          <p className="oir-subtitle">
            Queue stock changes offline, then sync safely when the connection returns.
          </p>
        </div>

        <div className={`oir-status ${offline ? "is-offline" : "is-online"}`}>
          <span />
          {offline ? "OFFLINE MODE" : "CONNECTION ONLINE"}
        </div>
      </header>

      <section className="oir-stats">
        <article className="oir-stat">
          <span>Pending operations</span>
          <strong>{pendingCount}</strong>
          <small>Stored locally in IndexedDB</small>
        </article>

        <article className="oir-stat">
          <span>Connection</span>
          <strong className={offline ? "oir-purple" : "oir-green"}>
            {offline ? "Offline" : "Online"}
          </strong>
          <small>
            {realOnline ? "Browser network available" : "Browser network unavailable"}
          </small>
        </article>

        <article className="oir-stat">
          <span>Sync worker</span>
          <strong>{syncing ? "Running" : "Standby"}</strong>
          <small>
            {syncing ? "Sending queued operations" : "Waiting for pending work"}
          </small>
        </article>
      </section>

      <section className="oir-panel oir-simulation">
        <div>
          <h2>Failure simulation</h2>
          <p>
            Demo ke liye simulated offline mode on karo. Isse browser ka actual internet disconnect nahi hota.
          </p>
        </div>

        <button
          className={`oir-toggle ${simulateOffline ? "active" : ""}`}
          onClick={() => {
            const next = !simulateOffline;
            setSimulateOffline(next);

            addEvent(
              next ? "Simulated network failure injected" : "Simulated connection restored",
              next ? "warning" : "success"
            );
          }}
          type="button"
        >
          {simulateOffline ? "Restore Connection" : "Simulate Offline"}
        </button>
      </section>

      <div className="oir-columns">
        <section className="oir-panel">
          <h2>Add inventory while offline</h2>
          <p className="oir-muted">
            Entry is saved to this browser first, even when the network is unavailable.
          </p>

          <form onSubmit={addInventory} className="oir-form">
            <label>
              Ingredient name
              <input
                value={ingredient}
                onChange={(event) => setIngredient(event.target.value)}
                placeholder="e.g. Tomato"
                required
              />
            </label>

            <div className="oir-form-row">
              <label>
                Quantity
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="5"
                  required
                />
              </label>

              <label>
                Unit
                <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="litre">litre</option>
                  <option value="pcs">pcs</option>
                </select>
              </label>
            </div>

            <button className="oir-primary" type="submit">
              Save inventory entry
            </button>
          </form>

          {notice && (
            <div className="oir-notice" role="status">
              {notice}
            </div>
          )}

          <button
            className="oir-secondary"
            onClick={syncQueue}
            disabled={offline || syncing}
            type="button"
          >
            {syncing ? "Syncing..." : "Retry sync now"}
          </button>

          <p className="oir-footnote">
            Sync endpoint configured as <code>{SYNC_ENDPOINT}</code>. Your Express backend must implement this endpoint before queued data can reach MongoDB.
          </p>
        </section>

        <section className="oir-panel">
          <div className="oir-panel-heading">
            <h2>Pending inventory queue</h2>
            <button className="oir-text-button" onClick={refreshQueue} type="button">
              Refresh
            </button>
          </div>

          {items.length === 0 ? (
            <div className="oir-empty">
              <span>✓</span>
              <strong>Queue is clear</strong>
              <p>Offline entries yahan dikhengi.</p>
            </div>
          ) : (
            <div className="oir-queue">
              {items.map((item) => (
                <article className="oir-queue-item" key={item.operationId}>
                  <div>
                    <strong>{item.ingredientName}</strong>
                    <p>
                      {item.quantity} {item.unit} · {formatTime(item.createdAt)}
                    </p>
                    <small>{item.lastError || `Attempts: ${item.attempts || 0}`}</small>
                  </div>

                  <div className="oir-queue-item-actions">
                    <span className={`oir-chip ${item.status === "SYNCING" ? "syncing" : "pending"}`}>
                      {item.status === "SYNCING" ? "SYNCING" : "PENDING"}
                    </span>

                    <button
                      type="button"
                      className="oir-remove-button"
                      disabled={item.status === "SYNCING"}
                      onClick={() => deletePendingItem(item.operationId)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="oir-panel oir-timeline-panel">
        <div className="oir-panel-heading">
          <h2>Recovery timeline</h2>
          <span className="oir-muted">Actual event timestamps</span>
        </div>

        <div className="oir-timeline">
          {events.map((event, index) => (
            <div className={`oir-event ${event.kind}`} key={`${event.time}-${index}`}>
              <span className="oir-event-dot" />
              <div>
                <strong>{event.label}</strong>
                <time>{formatTime(event.time)}</time>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="oir-disclaimer">
        Safety note: this page queues stock-add operations only. The backend must validate ingredient identity, authenticate admin access, and use operationId for idempotency to prevent duplicate stock changes.
      </p>
    </main>
  );
}
