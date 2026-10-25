
import { useEffect, useRef, useState } from "react";
import {
  WifiOff,
  RefreshCw,
  Activity,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  History,
  LoaderCircle,
  Server,
  ShieldCheck,
  ArrowLeft,
  Circle,
  RotateCcw,
} from "lucide-react";

const API = "/api/admin/failures";

const failureTypes = [
  {
    type: "expired-stock",
    title: "Expired Stock Detection",
    description:
      "Detect expired stock batches, isolate unusable stock.",
    icon: CalendarClock,
    service: "Inventory Expiry Service",
    endpoint: `${API}/expired-stock`,
  },
];

const stageDefinitions = [
  {
    id: "request",
    title: "Request Started",
    description: "Sending the expiry validation request to the backend.",
  },
  {
    id: "failure",
    title: "Failure Detection",
    description: "Checking stock batches for expired ingredients.",
  },
  {
    id: "healing",
    title: "Self-Healing in Progress",
    description: "Isolating expired batches and recalculating usable stock.",
  },
  {
    id: "verify",
    title: "Recovery Verification",
    description: "Verifying the updated inventory and recovery result.",
  },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const theme = {
  page: "bg-[#F7F4EC] text-[#173D35]",
  primary: "bg-[#173D35] text-white hover:bg-[#245448]",
  secondary:
    "border border-[#DCE5D8] bg-white text-[#173D35] hover:bg-[#DCE5D8]/50",
};

export default function SelfHealingMonitor({ onNavigate }) {
  const [loading, setLoading] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeSimulation, setActiveSimulation] = useState(null);
  const [activeStage, setActiveStage] = useState(-1);
  const [simulationState, setSimulationState] = useState("IDLE");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentIncident, setCurrentIncident] = useState(null);

  const startedAt = useRef(null);
  const timerRef = useRef(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!loading || !startedAt.current) return;

    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt.current);
    }, 100);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [loading]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  function openSimulation(failure) {
    setError("");
    setNotice("");
    setActiveSimulation(failure);
    setCurrentIncident(null);
    setActiveStage(-1);
    setSimulationState("IDLE");
    setElapsedMs(0);
  }

  function returnToMonitor() {
    runIdRef.current += 1;

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }

    setLoading("");
    setActiveSimulation(null);
    setCurrentIncident(null);
    setActiveStage(-1);
    setSimulationState("IDLE");
    setElapsedMs(0);
    setError("");
    setNotice("");
  }

  function addIncidentToHistory(incident) {
    setIncidents((previous) => [
      incident,
      ...previous.filter((item) => item.id !== incident.id),
    ]);
  }

  function updateStage(index, message, status = "RUNNING") {
    setActiveStage(index);

    setCurrentIncident((previous) => {
      if (!previous) return previous;

      const steps = [...(previous.steps || [])];

      steps[index] = {
        message,
        time: new Date().toISOString(),
        status,
      };

      return { ...previous, steps };
    });
  }

  async function generateFailure(type) {
    const failure = failureTypes.find((item) => item.type === type);

    if (!failure || loading) return;

    const runId = ++runIdRef.current;
    const startTime = Date.now();

    startedAt.current = startTime;

    setLoading(type);
    setError("");
    setNotice("");
    setElapsedMs(0);
    setActiveStage(0);
    setSimulationState("PROCESSING");

    setCurrentIncident({
      id: `LOCAL-${startTime}`,
      title: failure.title,
      type,
      status: "PROCESSING",
      failureDetected: false,
      recoveryVerified: false,
      failureLocation: "StockBatch Expiry Validation",
      failureCause:
        "The inventory may contain expired batches that are still counted as usable stock.",
      recoveryAction: "Waiting for backend recovery details.",
      verificationResult: "Waiting for backend verification.",
      steps: [
        {
          message: "Preparing expiry validation request.",
          time: new Date().toISOString(),
          status: "RUNNING",
        },
      ],
      alerts: [],
    });

    try {
      const responsePromise = fetch(failure.endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      updateStage(
        0,
        "Sending expiry validation request to the backend.",
        "RUNNING"
      );

      await wait(900);
      if (runId !== runIdRef.current) return;

      updateStage(0, "Request sent successfully.", "DONE");

      updateStage(
        1,
        "Checking stock batches and their expiry dates.",
        "RUNNING"
      );

      await wait(1100);
      if (runId !== runIdRef.current) return;

      const response = await responsePromise;
      const data = await response.json().catch(() => ({}));

      if (runId !== runIdRef.current) return;

      const payload = data.incident || data;

      if (!response.ok || data.success === false) {
        throw new Error(
          data.message ||
            payload.message ||
            `Expiry validation failed (${response.status}).`
        );
      }

      updateStage(
        1,
        payload.failureDetected
          ? "Expired stock was detected."
          : "Expiry check completed. No expired stock was found.",
        "DONE"
      );

      updateStage(
        2,
        payload.failureDetected
          ? "Expired batches isolated and usable inventory recalculated."
          : "No stock correction was required.",
        "RUNNING"
      );

      await wait(1000);
      if (runId !== runIdRef.current) return;

      updateStage(
        2,
        payload.message || data.message || "Inventory recovery completed.",
        "DONE"
      );

      updateStage(
        3,
        "Checking the backend recovery verification result.",
        "RUNNING"
      );

      await wait(700);
      if (runId !== runIdRef.current) return;

      const verified = Boolean(payload.recoveryVerified);
      const finalStatus = payload.status || (verified ? "RECOVERED" : "HEALTHY");
      const resultAt = Date.now();

      const backendSteps = Array.isArray(payload.steps)
        ? payload.steps
        : [];

      const incident = {
        id: payload.id || payload.incidentId || `EXP-${resultAt}`,
        type,
        title: payload.title || payload.failureType || failure.title,
        status: finalStatus,
        failureDetected: Boolean(payload.failureDetected),
        recoveryVerified: verified,
        detectionTimeMs: payload.detectionTimeMs ?? null,
        recoveryTimeMs:
          payload.recoveryTimeMs ??
          payload.totalRecoveryTimeMs ??
          (resultAt - startTime),
        failureLocation:
          payload.failureLocation ||
          payload.component ||
          "StockBatch Expiry Validation",
        failureCause:
          payload.failureCause ||
          "Expired batches must not be counted as usable inventory.",
        recoveryAction:
          payload.recoveryAction ||
          payload.healingAction ||
          "Expired batches isolated and usable stock recalculated.",
        verificationResult:
          payload.verificationResult ||
          (verified
            ? "Backend confirmed that recovery was verified."
            : "Backend did not confirm recovery verification."),
        message:
          payload.message ||
          data.message ||
          "Expiry validation request completed.",
        alerts: Array.isArray(data.alerts)
          ? data.alerts
          : Array.isArray(payload.alerts)
            ? payload.alerts
            : [],
        steps:
          backendSteps.length > 0
            ? backendSteps
            : [
                {
                  message: "Expiry validation request completed.",
                  time: new Date(startTime).toISOString(),
                  status: "DONE",
                },
                {
                  message: "Backend recovery result received.",
                  time: new Date(resultAt).toISOString(),
                  status: "DONE",
                },
              ],
      };

      updateStage(
        3,
        verified
          ? "Inventory recovery verification successful."
          : "The backend response did not confirm recovery verification.",
        verified ? "DONE" : "FAILED"
      );

      setCurrentIncident(incident);
      addIncidentToHistory(incident);
      setSimulationState(
        incident.status === "FAILED"
          ? "FAILED"
          : verified
            ? "RECOVERED"
            : incident.status === "HEALTHY"
              ? "HEALTHY"
              : "COMPLETED"
      );

      setNotice(incident.message);
    } catch (err) {
      if (runId !== runIdRef.current) return;

      const failedIncident = {
        id: `ERR-${Date.now()}`,
        type,
        title: failure.title,
        status: "FAILED",
        failureDetected: false,
        recoveryVerified: false,
        failureLocation: "Expired Stock Detection API",
        failureCause: err.message || "Unable to contact the backend.",
        recoveryAction: "No verified recovery result received.",
        verificationResult:
          "Check the backend route and its database connection.",
        message:
          "Verify that the backend is running and POST /api/admin/failures/expired-stock exists.",
        alerts: [],
        steps: [
          {
            message: err.message || "Expiry validation request failed.",
            time: new Date().toISOString(),
            status: "FAILED",
          },
        ],
      };

      setCurrentIncident(failedIncident);
      addIncidentToHistory(failedIncident);
      setSimulationState("FAILED");
      setActiveStage(3);
      setError(failedIncident.failureCause);
    } finally {
      if (runId === runIdRef.current) {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
        }
        setLoading("");
      }
    }
  }

  const detectedCount = incidents.filter(
    (item) => item.failureDetected
  ).length;

  const recoveredCount = incidents.filter(
    (item) => item.recoveryVerified && item.status !== "FAILED"
  ).length;

  const timedIncidents = incidents.filter(
    (item) => item.recoveryTimeMs != null
  );

  const averageTime = timedIncidents.length
    ? Math.round(
        timedIncidents.reduce(
          (total, item) => total + Number(item.recoveryTimeMs),
          0
        ) / timedIncidents.length
      )
    : null;

  if (activeSimulation) {
    const Icon = activeSimulation.icon;
    const running = Boolean(loading);
    const successful =
      currentIncident?.recoveryVerified &&
      currentIncident?.status !== "FAILED";
    const failed = simulationState === "FAILED";

    return (
      <div className={`min-h-full space-y-6 p-4 sm:p-6 lg:p-8 ${theme.page}`}>
        <button
          type="button"
          onClick={returnToMonitor}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${theme.secondary}`}
        >
          <ArrowLeft size={17} />
          Back to Self-Healing Monitor
        </button>

        <section className="rounded-2xl border border-[#DCE5D8] bg-gradient-to-r from-[#DCE5D8] to-[#F7F4EC] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#78877C]">
                <Activity size={16} />
                LIVE INVENTORY VALIDATION
              </p>

              <h1 className="mt-3 text-2xl font-bold text-[#173D35] sm:text-3xl">
                {activeSimulation.title}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78877C]">
                Follow the expiry check, detection, healing and verification
                stages.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-[#DCE5D8] bg-white p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DCE5D8] text-[#173D35]">
                <Icon size={22} />
              </div>
              <div>
                <p className="text-xs text-[#78877C]">SERVICE</p>
                <p className="font-semibold text-[#173D35]">
                  {activeSimulation.service}
                </p>
                <p className="mt-1 text-xs text-[#78877C]">
                  {running ? `${elapsedMs} ms elapsed` : simulationState}
                </p>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Expiry check could not complete</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          </div>
        )}

        {notice && !error && !running && (
          <div className="rounded-xl border border-[#DCE5D8] bg-white p-4 text-sm text-[#173D35]">
            {notice}
          </div>
        )}

        <section className="rounded-2xl border border-[#DCE5D8] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold text-[#173D35]">
                Execution Timeline
              </h2>
              <p className="mt-1 text-sm text-[#78877C]">
                Each stage updates as the request progresses.
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${
                running
                  ? "bg-[#D8C6A5]/40 text-[#765B2D]"
                  : successful
                    ? "bg-[#DCE5D8] text-[#173D35]"
                    : failed
                      ? "bg-red-50 text-red-700"
                      : "bg-[#F7F4EC] text-[#173D35]"
              }`}
            >
              {running
                ? "PROCESSING"
                : successful
                  ? "RECOVERED"
                  : failed
                    ? "FAILED"
                    : simulationState}
            </span>
          </div>

          <div className="mt-7">
            {stageDefinitions.map((stage, index) => {
              const stageIncident = currentIncident?.steps?.[index];

              const done =
                stageIncident?.status === "DONE" ||
                (activeStage > index && !running);

              const current =
                activeStage === index &&
                running &&
                stageIncident?.status !== "DONE";

              const waiting = activeStage < index || !stageIncident;

              return (
                <div key={stage.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                        done
                          ? "border-[#DCE5D8] bg-[#DCE5D8] text-[#173D35]"
                          : current
                            ? "border-[#D8C6A5] bg-[#D8C6A5]/30 text-[#765B2D]"
                            : stageIncident?.status === "FAILED"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-[#DCE5D8] bg-[#F7F4EC] text-[#78877C]"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 size={20} />
                      ) : current ? (
                        <LoaderCircle size={20} className="animate-spin" />
                      ) : stageIncident?.status === "FAILED" ? (
                        <AlertTriangle size={19} />
                      ) : (
                        <Circle size={18} />
                      )}
                    </div>

                    {index < stageDefinitions.length - 1 && (
                      <div
                        className={`my-1 min-h-10 w-px ${
                          done ? "bg-[#173D35]/40" : "bg-[#DCE5D8]"
                        }`}
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pb-7">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[#173D35]">
                        {stage.title}
                      </h3>

                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                          done
                            ? "bg-[#DCE5D8] text-[#173D35]"
                            : stageIncident?.status === "FAILED"
                              ? "bg-red-50 text-red-700"
                              : current
                                ? "bg-[#D8C6A5]/30 text-[#765B2D]"
                                : "bg-[#F7F4EC] text-[#78877C]"
                        }`}
                      >
                        {done
                          ? "Complete"
                          : stageIncident?.status === "FAILED"
                            ? "Failed"
                            : current
                              ? "In Progress"
                              : "Waiting"}
                      </span>
                    </div>

                    <p className="mt-1 text-sm leading-6 text-[#78877C]">
                      {stageIncident?.message ||
                        (waiting
                          ? "Waiting for previous step to complete..."
                          : stage.description)}
                    </p>

                    {stageIncident?.time && (
                      <p className="mt-1 text-xs text-[#78877C]">
                        {new Date(stageIncident.time).toLocaleTimeString()}
                      </p>
                    )}

                    {current && (
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#DCE5D8]">
                        <div className="h-full w-2/3 animate-pulse rounded-full bg-[#173D35]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {running && (
            <div className="rounded-xl border border-[#D8C6A5] bg-[#F7F4EC] p-4 text-sm text-[#173D35]">
              <div className="flex items-center gap-2 font-semibold">
                <LoaderCircle size={17} className="animate-spin" />
                Processing expiry validation
              </div>
              <p className="mt-1 text-[#78877C]">
                Waiting for the backend to check stock batches and return its
                recovery result.
              </p>
            </div>
          )}

          {currentIncident && !running && (
            <div className="mt-5 rounded-xl border border-[#DCE5D8] bg-[#F7F4EC] p-4">
              <h3 className="font-bold text-[#173D35]">Simulation Result</h3>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label="Incident ID" value={currentIncident.id || "N/A"} />
                <Metric
                  label="Failure Detected"
                  value={currentIncident.failureDetected ? "Yes" : "No"}
                />
                <Metric
                  label="Recovery Verified"
                  value={currentIncident.recoveryVerified ? "Yes" : "No"}
                />
                <Metric
                  label="Detection Time"
                  value={
                    currentIncident.detectionTimeMs != null
                      ? `${currentIncident.detectionTimeMs} ms`
                      : "N/A"
                  }
                />
                <Metric
                  label="Recovery Time"
                  value={
                    currentIncident.recoveryTimeMs != null
                      ? `${currentIncident.recoveryTimeMs} ms`
                      : "N/A"
                  }
                />
                <Metric
                  label="Failure Location"
                  value={currentIncident.failureLocation || "N/A"}
                />
              </div>

              <div className="mt-4 rounded-lg border border-[#DCE5D8] bg-white p-4">
                <h4 className="font-bold text-[#173D35]">Failure Analysis</h4>
                <p className="mt-2 text-sm text-[#78877C]">
                  <strong className="text-[#173D35]">Cause:</strong>{" "}
                  {currentIncident.failureCause || "Not provided"}
                </p>
                <p className="mt-2 text-sm text-[#78877C]">
                  <strong className="text-[#173D35]">Recovery Action:</strong>{" "}
                  {currentIncident.recoveryAction || "Not provided"}
                </p>
                <p className="mt-2 text-sm text-[#78877C]">
                  <strong className="text-[#173D35]">Verification:</strong>{" "}
                  {currentIncident.verificationResult || "Not provided"}
                </p>
              </div>

              {currentIncident.alerts?.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <h4 className="font-bold text-[#173D35]">
                    Expired Stock Alerts
                  </h4>

                  {currentIncident.alerts.map((alert, index) => (
                    <div
                      key={`${alert.batchCode}-${alert.ingredientId || index}`}
                      className="rounded-xl border border-[#D8C6A5] bg-white p-4"
                    >
                      <p className="font-semibold text-[#173D35]">
                        <AlertTriangle size={16} className="mr-2 inline" />
                        {alert.ingredientName || "Unknown ingredient"}
                      </p>

                      <p className="mt-2 text-sm text-[#78877C]">
                        Ingredient Code: {alert.ingredientCode || "—"}
                      </p>
                      <p className="mt-1 text-sm text-[#78877C]">
                        Batch: {alert.batchCode || "—"}
                      </p>
                      <p className="mt-1 text-sm text-[#78877C]">
                        Expiry Date:{" "}
                        {alert.expiryDate
                          ? new Date(alert.expiryDate).toLocaleDateString()
                          : "—"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#173D35]">
                        Expired Quantity: {alert.expiredQuantity ?? "—"}
                      </p>
                      <p className="mt-2 text-sm text-[#173D35]">
                        {alert.message || "Expired stock detected."}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-[#DCE5D8] bg-white p-4 text-sm text-[#173D35]">
                  No expired-stock alerts were returned by the backend.
                </div>
              )}

              <div className="mt-4">
                <h4 className="mb-3 font-bold text-[#173D35]">
                  Recovery Timeline
                </h4>
                <div className="space-y-3">
                  {currentIncident.steps?.map((step, index) => (
                    <div key={`${step.time || "step"}-${index}`} className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DCE5D8] text-xs font-semibold text-[#173D35]">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-sm text-[#173D35]">
                          {typeof step === "string"
                            ? step
                            : step?.message || JSON.stringify(step)}
                        </p>
                        {typeof step === "object" && step?.time && (
                          <p className="mt-1 text-xs text-[#78877C]">
                            {new Date(step.time).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-4 break-words text-sm text-[#78877C]">
                <strong className="text-[#173D35]">Final Response:</strong>{" "}
                {currentIncident.message || "No response message"}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {!running && (
              <button
                type="button"
                onClick={() => generateFailure(activeSimulation.type)}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition ${theme.primary}`}
              >
                <RotateCcw size={16} />
                Run Test Again
              </button>
            )}

            <button
              type="button"
              onClick={returnToMonitor}
              className={`rounded-lg px-5 py-3 text-sm font-semibold transition ${theme.secondary}`}
            >
              Back to Monitor
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`min-h-full space-y-6 p-4 sm:p-6 lg:p-8 ${theme.page}`}>
      <section className="flex flex-col justify-between gap-5 rounded-2xl border border-[#DCE5D8] bg-gradient-to-r from-[#DCE5D8] to-[#F7F4EC] p-6 sm:flex-row sm:items-center sm:p-8">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#78877C]">
            <ShieldCheck size={18} />
            RESILIO PROTECTION
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#173D35] sm:text-4xl">
            Self-Healing Monitor
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#78877C] sm:text-base">
            Run inventory recovery checks and review failure detection,
            recovery actions and verification results.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-[#DCE5D8] bg-white p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DCE5D8] text-[#173D35]">
            <Activity size={23} />
          </div>
          <div>
            <p className="text-xs text-[#78877C]">MONITOR</p>
            <p className="mt-1 font-semibold text-[#173D35]">Recovery Control</p>
            <p className="mt-1 text-xs text-[#78877C]">On-demand testing</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#DCE5D8] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#DCE5D8] bg-[#DCE5D8] text-[#173D35]">
              <WifiOff size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#173D35] sm:text-xl">
                Offline Inventory Recovery
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78877C]">
                Save inventory operations while offline, sync pending records
                when the connection returns, and verify recovery.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-[#DCE5D8] bg-[#F7F4EC] px-3 py-1.5 text-[#173D35]">
                  Offline Queue
                </span>
                <span className="rounded-full border border-[#DCE5D8] bg-[#F7F4EC] px-3 py-1.5 text-[#173D35]">
                  Auto Sync
                </span>
                <span className="rounded-full border border-[#DCE5D8] bg-[#F7F4EC] px-3 py-1.5 text-[#173D35]">
                  Recovery Verification
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.("Offline Inventory Recovery")}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${theme.primary}`}
          >
            <RefreshCw size={17} />
            Open Recovery
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#DCE5D8] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#DCE5D8] bg-[#DCE5D8] text-[#173D35]">
            <CalendarClock size={24} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-[#173D35] sm:text-xl">
                  Expired Stock Detection
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78877C]">
                  Check real stock batch expiry dates, isolate expired batches,
                </p>
                <span className="mt-3 inline-flex rounded-full border border-[#DCE5D8] bg-[#F7F4EC] px-3 py-1.5 text-xs text-[#173D35]">
                  Inventory Expiry Validation
                </span>
              </div>

              <button
                type="button"
                onClick={() => openSimulation(failureTypes[0])}
                className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${theme.primary}`}
              >
                <CalendarClock size={17} />
                Generate &amp; Test
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#DCE5D8] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-2 text-[#78877C]">
          <History size={18} />
          <span className="text-xs font-semibold uppercase tracking-[0.16em]">
            INCIDENT ACTIVITY
          </span>
        </div>

        <h2 className="mt-2 text-xl font-bold text-[#173D35] sm:text-2xl">
          Recovery History
        </h2>
        <p className="mt-2 text-sm text-[#78877C]">
          Expiry validation results from tests performed in this session.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Incidents Recorded" value={incidents.length} />
          <Metric label="Failures Detected" value={detectedCount} />
          <Metric
            label="Verified Recoveries"
            value={`${recoveredCount}${averageTime != null ? ` · Avg ${averageTime} ms` : ""}`}
          />
        </div>

        {!incidents.length ? (
          <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-[#DCE5D8] bg-[#F7F4EC] px-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#DCE5D8] text-[#173D35]">
              <History size={25} />
            </div>
            <h3 className="mt-4 font-semibold text-[#173D35]">
              No incidents recorded
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#78877C]">
              Open the expiry test to check real stock data and view its
              detection and recovery result here.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {incidents.map((incident, index) => {
              const recovered =
                incident.recoveryVerified && incident.status !== "FAILED";

              return (
                <article
                  key={incident.id || `${incident.type}-${index}`}
                  className="overflow-hidden rounded-xl border border-[#DCE5D8] bg-white"
                >
                  <div className="flex flex-col justify-between gap-3 border-b border-[#DCE5D8] p-4 sm:flex-row sm:items-center sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#DCE5D8] text-[#173D35]">
                        <Server size={21} />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#173D35]">
                          {incident.title || "Expired Stock Detection"}
                        </h3>
                        <p className="mt-1 break-all text-xs text-[#78877C]">
                          Incident ID: {incident.id || "N/A"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${
                        recovered
                          ? "bg-[#DCE5D8] text-[#173D35]"
                          : incident.status === "FAILED"
                            ? "bg-red-50 text-red-700"
                            : "bg-[#D8C6A5]/40 text-[#765B2D]"
                      }`}
                    >
                      {incident.status || "UNKNOWN"}
                    </span>
                  </div>

                  <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
                    <Metric
                      label="Failure Detected"
                      value={incident.failureDetected ? "Yes" : "No"}
                    />
                    <Metric
                      label="Recovery Verified"
                      value={incident.recoveryVerified ? "Yes" : "No"}
                    />
                    <Metric
                      label="Recovery Time"
                      value={
                        incident.recoveryTimeMs != null
                          ? `${incident.recoveryTimeMs} ms`
                          : "N/A"
                      }
                    />
                  </div>

                  <div className="mx-4 mb-4 rounded-lg border border-[#DCE5D8] bg-[#F7F4EC] p-4 sm:mx-5">
                    <h4 className="font-bold text-[#173D35]">
                      Failure Analysis
                    </h4>
                    <p className="mt-3 text-sm text-[#78877C]">
                      <strong className="text-[#173D35]">Location:</strong>{" "}
                      {incident.failureLocation || "Not provided"}
                    </p>
                    <p className="mt-2 text-sm text-[#78877C]">
                      <strong className="text-[#173D35]">Cause:</strong>{" "}
                      {incident.failureCause || "Not provided"}
                    </p>
                    <p className="mt-2 text-sm text-[#78877C]">
                      <strong className="text-[#173D35]">Recovery:</strong>{" "}
                      {incident.recoveryAction || "Not provided"}
                    </p>
                    <p className="mt-2 text-sm text-[#78877C]">
                      <strong className="text-[#173D35]">Verification:</strong>{" "}
                      {incident.verificationResult || "Not provided"}
                    </p>
                  </div>

                  {incident.message && (
                    <div className="mx-4 mb-4 rounded-lg border border-[#DCE5D8] bg-[#F7F4EC] p-3 text-sm text-[#78877C] sm:mx-5">
                      {incident.message}
                    </div>
                  )}

                  {incident.alerts?.length > 0 && (
                    <div className="mx-4 mb-4 space-y-3 sm:mx-5">
                      <h4 className="font-bold text-[#173D35]">
                        Expired Stock Alerts
                      </h4>
                      {incident.alerts.map((alert, alertIndex) => (
                        <div
                          key={`${alert.batchCode}-${alert.ingredientId || alertIndex}`}
                          className="rounded-xl border border-[#D8C6A5] bg-[#F7F4EC] p-4"
                        >
                          <p className="font-semibold text-[#173D35]">
                            <AlertTriangle size={16} className="mr-2 inline" />
                            {alert.ingredientName || "Unknown ingredient"}
                          </p>
                          <p className="mt-2 text-sm text-[#78877C]">
                            Batch: {alert.batchCode || "—"}
                          </p>
                          <p className="mt-1 text-sm text-[#78877C]">
                            Expiry Date:{" "}
                            {alert.expiryDate
                              ? new Date(alert.expiryDate).toLocaleDateString()
                              : "—"}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#173D35]">
                            Expired Quantity: {alert.expiredQuantity ?? "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {incident.steps?.length > 0 && (
                    <div className="px-4 pb-5 sm:px-5">
                      <h4 className="mb-4 text-sm font-bold text-[#173D35]">
                        Recovery Timeline
                      </h4>
                      <div className="space-y-4">
                        {incident.steps.map((step, stepIndex) => (
                          <div key={stepIndex} className="flex gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#DCE5D8] bg-[#DCE5D8] text-xs font-semibold text-[#173D35]">
                              {stepIndex + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="break-words text-sm text-[#173D35]">
                                {typeof step === "string"
                                  ? step
                                  : step?.message || JSON.stringify(step)}
                              </p>
                              {typeof step === "object" && step?.time && (
                                <p className="mt-1 text-xs text-[#78877C]">
                                  {new Date(step.time).toLocaleTimeString()}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#DCE5D8] bg-white p-3">
      <p className="text-xs text-[#78877C]">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-[#173D35]">
        {value}
      </p>
    </div>
  );
}
