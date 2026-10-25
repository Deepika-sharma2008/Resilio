import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./OfflineInventoryRecovery.css";

const DB_NAME = "resilio-offline-inventory";
const STORE_NAME = "pending-operations";
const SYNC_ENDPOINT = "/api/admin/inventory/offline-sync";
const RETRY_INTERVAL = 5000;
const DEMO_RECOVERY_DELAY = 15000;

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
      reject(request.error || new Error("Could not open offline queue."));
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
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  const [realOnline, setRealOnline] = useState(
    () => navigator.onLine
  );

  const [simulateOffline, setSimulateOffline] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");

  const [events, setEvents] = useState([
    {
      label: "Automatic recovery monitor started",
      time: new Date().toISOString(),
      kind: "info",
    },
  ]);

  const syncingRef = useRef(false);
  const demoTimerRef = useRef(null);

  const offline = !realOnline || simulateOffline;

  const addEvent = useCallback((label, kind = "info") => {
    setEvents((previous) =>
      [
        ...previous,
        {
          label,
          kind,
          time: new Date().toISOString(),
        },
      ].slice(-30)
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

  const pendingCount = useMemo(
    () => items.filter((item) => item.status !== "SYNCED").length,
    [items]
  );

  const syncQueue = useCallback(async () => {
    if (
      syncingRef.current ||
      !navigator.onLine ||
      simulateOffline
    ) {
      return;
    }

    syncingRef.current = true;
    setSyncing(true);

    try {
      const pending = (await getAllPending())
        .filter((item) => item.status !== "SYNCED")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        );

      if (pending.length === 0) {
        return;
      }

      addEvent(
        `Automatic sync started for ${pending.length} pending item(s)`,
        "info"
      );

      for (const item of pending) {
        if (!navigator.onLine || simulateOffline) {
          break;
        }

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

          if (!response.ok || payload.success !== true) {
            throw new Error(
              payload.message ||
              `Server returned HTTP ${response.status}`
            );
          }

          await removePending(item.operationId);

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
        } catch (error) {
          await savePending({
            ...attempt,
            status: "PENDING",
            lastError: error.message,
          });

          addEvent(
            `${item.ingredientName}: sync failed — ${error.message}`,
            "error"
          );

          setNotice(
            `Sync failed. Automatic retry will run in ${RETRY_INTERVAL / 1000
            } seconds. ${error.message}`
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
        setNotice("Recovery verified: all queued entries were synced.");
        addEvent("Recovery complete — pending queue is empty", "success");
      } else {
        setNotice(
          `${remaining} item(s) remain pending. Automatic retry is enabled.`
        );
      }
    } catch (error) {
      setNotice(`Sync error: ${error.message}`);
      addEvent(`Recovery check failed: ${error.message}`, "error");
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [simulateOffline, refreshQueue, addEvent]);

  // Detect actual browser network changes.
  useEffect(() => {
    refreshQueue();

    const onlineHandler = () => {
      setRealOnline(true);

      addEvent(
        "Browser network restored — checking pending inventory",
        "success"
      );
    };

    const offlineHandler = () => {
      setRealOnline(false);

      addEvent(
        "Browser network lost — inventory will be queued locally",
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

  // Automatically retry pending items while online.
  useEffect(() => {
    if (offline) {
      return undefined;
    }

    syncQueue();

    const timer = window.setInterval(() => {
      if (navigator.onLine && !syncingRef.current) {
        syncQueue();
      }
    }, RETRY_INTERVAL);

    return () => window.clearInterval(timer);
  }, [offline, syncQueue]);

  // Clean up the demo timer if the component is closed.
  useEffect(() => {
    return () => {
      if (demoTimerRef.current) {
        window.clearTimeout(demoTimerRef.current);
      }
    };
  }, []);

  // Demonstrate automatic recovery without manually clicking Restore.
  async function runSelfHealingDemo() {
  if (demoRunning) return;

  setDemoRunning(true);
  setSimulateOffline(true);

  addEvent(
    "Failure detected — simulated network interruption",
    "warning"
  );

  addEvent(
    "Offline mode activated — inventory changes will be stored locally",
    "info"
  );

  try {
    const entry = {
      operationId: makeId(),
      ingredientName: "Recovery Demo Tomato",
      quantity: 1,
      unit: "kg",
      action: "ADD_STOCK",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    await savePending(entry);
    await refreshQueue();

    addEvent(
      "Offline data added to local queue — Recovery Demo Tomato: 1 kg",
      "warning"
    );

    setNotice(
      "Test inventory operation saved locally. Waiting for automatic recovery..."
    );
  } catch (error) {
    addEvent(
      `Local queue save failed: ${error.message}`,
      "error"
    );

    setNotice(`Could not save demo operation: ${error.message}`);
    setSimulateOffline(false);
    setDemoRunning(false);
    return;
  }

  demoTimerRef.current = window.setTimeout(() => {
    addEvent(
      "Connection restored — starting pending data synchronization",
      "success"
    );

    setSimulateOffline(false);

    setNotice(
      "Connection restored. Pending inventory synchronization starting..."
    );

    demoTimerRef.current = window.setTimeout(() => {
      addEvent(
        "Recovery verification — checking pending inventory queue",
        "info"
      );

      setDemoRunning(false);
      demoTimerRef.current = null;

      syncQueue();
    }, 1500);
  }, DEMO_RECOVERY_DELAY);
}


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
      // Store locally first so the entry survives a connection failure.
      await savePending(entry);

      await refreshQueue();

      setQuantity("");

      setNotice(
        offline
          ? "Entry locally saved. Connection restore hone par automatic sync hogi."
          : "Entry queued. Automatic sync starting..."
      );

      addEvent(
        `Offline data added to local queue — ${cleanName}: ${amount} ${unit}`,
        "warning"
      );


      if (!offline) {
        syncQueue();
      }
    } catch (error) {
      setNotice(`Save failed: ${error.message}`);
    }
  }

  async function deletePendingItem(operationId) {
    const confirmed = window.confirm(
      "Remove this local pending item? It will not be saved to MongoDB."
    );

    if (!confirmed) return;

    try {
      await removePending(operationId);
      await refreshQueue();

      addEvent("Pending item removed manually", "warning");
    } catch (error) {
      setNotice(`Delete failed: ${error.message}`);
    }
  }

  return (
    <main className="oir-page">
      <header className="oir-header">
        <div>
          <p className="oir-eyebrow">RESILIO · SELF-HEALING SYSTEM</p>
          <h1>Offline Inventory Recovery</h1>
          <p className="oir-subtitle">
            Automatically queue inventory changes and retry synchronization
            when the connection returns.
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
            {realOnline
              ? "Browser network available"
              : "Browser network unavailable"}
          </small>
        </article>

        <article className="oir-stat">
          <span>Sync worker</span>
          <strong>{syncing ? "Running" : "Standby"}</strong>
          <small>
            {syncing
              ? "Processing queued operations"
              : "Automatic retry monitor enabled"}
          </small>
        </article>
      </section>

      <section className="oir-panel oir-simulation">
        <div>
          <h2>Automatic Self-Healing Demo</h2>
          <p>
            Failure simulate hoga. {DEMO_RECOVERY_DELAY / 1000} seconds baad
            app automatically recovery start karega.
          </p>
          <p>
            {demoRunning
              ? "Failure detected — recovery in progress..."
              : "System demo ke liye ready hai."}
          </p>
        </div>

        <button
          className={`oir-toggle ${demoRunning ? "active" : ""}`}
          type="button"
          disabled={demoRunning}
          onClick={runSelfHealingDemo}
        >
          {demoRunning ? "Recovering..." : "Run Self-Healing Demo"}
        </button>
      </section>

      <div className="oir-columns">
        <section className="oir-panel">
          <h2>Add inventory while offline</h2>

          <p className="oir-muted">
            Entry is saved locally first. Automatic sync handles recovery.
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
                <select
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                >
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
            Endpoint: <code>{SYNC_ENDPOINT}</code>
          </p>
        </section>

        <section className="oir-panel">
          <div className="oir-panel-heading">
            <h2>Pending inventory queue</h2>

            <button
              className="oir-text-button"
              onClick={refreshQueue}
              type="button"
            >
              Refresh
            </button>
          </div>

          {items.length === 0 ? (
            <div className="oir-empty">
              <span>✓</span>
              <strong>Queue is clear</strong>
              <p>Pending offline entries yahan dikhenge.</p>
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

                    <small>
                      {item.lastError || `Attempts: ${item.attempts || 0}`}
                    </small>
                  </div>

                  <div className="oir-queue-item-actions">
                    <span
                      className={`oir-chip ${item.status === "SYNCING" ? "syncing" : "pending"
                        }`}
                    >
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
            <div
              className={`oir-event ${event.kind}`}
              key={`${event.time}-${index}`}
            >
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
        This demo simulates recovery inside the application. It does not
        physically disconnect or restore the laptop's Wi-Fi. A sync is
        successful only when the backend confirms the database operation.
      </p>
    </main>
  );
}
