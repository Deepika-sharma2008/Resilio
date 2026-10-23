import { useEffect, useRef, useState } from "react";
import {
  WifiOff,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  LoaderCircle,
  Server,
  ShieldCheck,
  Zap,
  ArrowLeft,
  Circle,
  RotateCcw,
} from "lucide-react";

const API = "/api/admin/simulator";
const PYTHON_API = "http://127.0.0.1:8000";

const failureTypes = [
  {
    type: "api",
    title: "Order Processing Timeout",
    description:
      "Create a controlled timeout, detect HTTP 504, and verify the recovery response from the Python test service.",
    icon: Zap,
    service: "Python Worker",
    endpoint: `${PYTHON_API}/self-heal/order-timeout`,
  },
  {
    type: "configuration",
    title: "API Configuration Failure",
    description:
      "Inject an invalid demo configuration and restore the known-good value.",
    icon: ShieldCheck,
    service: "Node.js Backend",
    endpoint: `${API}/configuration`,
  },
];

const stageDefinitions = [
  {
    id: "request",
    title: "Request Started",
    description: "Sending a test request to the selected service.",
  },
  {
    id: "failure",
    title: "Failure Detection",
    description: "Waiting for the timeout or failure signal.",
  },
  {
    id: "healing",
    title: "Self-Healing in Progress",
    description: "Running the recovery action and checking the fallback response.",
  },
  {
    id: "verify",
    title: "Recovery Verification",
    description: "Checking whether the service returned a successful response.",
  },
];

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const theme = {
  page: "bg-[#F7F4EC] text-[#173D35]",
  card: "border-[#DCE5D8] bg-white",
  muted: "text-[#78877C]",
  border: "border-[#DCE5D8]",
  soft: "bg-[#DCE5D8]",
  primary: "bg-[#173D35] text-white hover:bg-[#245448]",
  secondary:
    "border border-[#DCE5D8] bg-white text-[#173D35] hover:bg-[#DCE5D8]/50",
};

export default function SelfHealingMonitor({ onNavigate }) {
  const [loading, setLoading] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [error, setError] = useState("");
  const [activeSimulation, setActiveSimulation] = useState(null);
  const [activeStage, setActiveStage] = useState(-1);
  const [simulationState, setSimulationState] = useState("IDLE");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentIncident, setCurrentIncident] = useState(null);

  const startedAt = useRef(null);
  const timerRef = useRef(null);
  const stageTimersRef = useRef([]);

  useEffect(() => {
    if (!loading || !startedAt.current) return undefined;

    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt.current);
    }, 100);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [loading]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      stageTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function clearStageTimers() {
    stageTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    stageTimersRef.current = [];
  }

  function openSimulation(failure) {
    setError("");
    setActiveSimulation(failure);
    setCurrentIncident(null);
    setActiveStage(-1);
    setSimulationState("IDLE");
    setElapsedMs(0);
  }

  function returnToMonitor() {
    clearStageTimers();

    if (timerRef.current) window.clearInterval(timerRef.current);

    setLoading("");
    setActiveSimulation(null);
    setCurrentIncident(null);
    setActiveStage(-1);
    setSimulationState("IDLE");
    setError("");
  }

  function addIncidentToHistory(incident) {
    // Newest incident always appears at the TOP of Recovery History.
    setIncidents((previous) => [
      incident,
      ...previous.filter((item) => item.id !== incident.id),
    ]);
  }

  async function generateFailure(type) {
    const failure = failureTypes.find((item) => item.type === type);

    if (!failure || loading) return;

    clearStageTimers();
    setLoading(type);
    setError("");
    setActiveStage(0);
    setSimulationState("PROCESSING");

    const startTime = Date.now();
    startedAt.current = startTime;
    setElapsedMs(0);

    setCurrentIncident({
      id: `LOCAL-${startTime}`,
      title: failure.title,
      type,
      status: "PROCESSING",
      failureDetected: false,
      recoveryVerified: false,
      failureLocation:
        type === "api"
          ? "Python Order Processing Test Service"
          : "Admin API Configuration",
      failureCause:
        type === "api"
          ? "The test operation intentionally exceeds the configured timeout."
          : "The demo API configuration is intentionally invalid.",
      recoveryAction: "Waiting for backend recovery details.",
      verificationResult: "Waiting for response verification.",
      steps: [
        {
          message: "Request started",
          time: new Date(startTime).toISOString(),
          status: "DONE",
        },
      ],
    });

    function addTimelineStep(index, message, status = "RUNNING") {
      setActiveStage(index);

      setCurrentIncident((previous) => {
        if (!previous) return previous;

        const steps = [...(previous.steps || [])];

        steps[index] = {
          message,
          time: new Date().toISOString(),
          status,
        };

        return {
          ...previous,
          status:
            index === 1
              ? "FAILURE_DETECTION"
              : index === 2
                ? "HEALING"
                : previous.status,
          steps,
        };
      });
    }

    addTimelineStep(0, "Sending test request to the service...", "RUNNING");

    try {
      const responsePromise = fetch(failure.endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      stageTimersRef.current.push(
        window.setTimeout(() => {
          addTimelineStep(
            1,
            "Request is still pending; waiting for service timeout result",
            "RUNNING"
          );
        }, 2200)
      );

      stageTimersRef.current.push(
        window.setTimeout(() => {
          addTimelineStep(
            2,
            "Waiting for the recovery result from the service",
            "RUNNING"
          );
        }, 3200)
      );

      await wait(1800);
      addTimelineStep(0, "Request accepted by service", "DONE");

      addTimelineStep(1, "Failure detection in progress...", "RUNNING");
      await wait(3500);

      addTimelineStep(1, "Failure detection result pending", "RUNNING");
      addTimelineStep(2, "Waiting for self-healing result...", "RUNNING");

      const response = await responsePromise;
      const data = await response.json().catch(() => ({}));

      const payload =
        data.detail && typeof data.detail === "object"
          ? data.detail
          : data;

      if (!response.ok) {
        const message =
          typeof data.detail === "string"
            ? data.detail
            : payload?.message ||
              data.message ||
              `Simulation failed (${response.status})`;

        throw new Error(`${response.status}: ${message}`);
      }

      addTimelineStep(2, "Recovery action result received", "DONE");
      addTimelineStep(3, "Verifying recovery response...", "RUNNING");

      await wait(1000);

      let incident;

      if (type === "configuration") {
        incident = {
          id: payload.incidentId || `CFG-${Date.now()}`,
          type,
          title: payload.failureType || failure.title,
          status: payload.status || "UNKNOWN",
          failureDetected: Boolean(payload.failureDetected),
          recoveryVerified:
            payload.status === "RECOVERED" && Boolean(payload.success),
          recoveryTimeMs:
            payload.recoveryTimeMs ?? payload.totalRecoveryTimeMs,
          detectionTimeMs: payload.detectionTimeMs,
          failureLocation: payload.component || "Admin API Configuration",
          failureCause: payload.failureDetected
            ? "The demo API configuration was invalid."
            : "The invalid configuration was not detected.",
          recoveryAction: payload.healingAction || "No healing action reported",
          verificationResult: payload.success
            ? "Restored configuration passed validation."
            : "Configuration recovery could not be verified.",
          message: payload.message || "Configuration simulation completed.",
          steps: Array.isArray(payload.stages)
            ? payload.stages.map((stage) => ({
                message: String(stage).replaceAll("_", " "),
                time: new Date().toISOString(),
                status: "DONE",
              }))
            : [],
        };
      } else {
        incident = {
          id: payload.incidentId || `ORD-HEAL-${Date.now()}`,
          type,
          title: failure.title,
          status: payload.status || "UNKNOWN",
          failureDetected: Boolean(payload.failureDetected),
          recoveryVerified: Boolean(payload.recoveryVerified),
          recoveryTimeMs:
            payload.totalRecoveryTimeMs ?? payload.recoveryTimeMs,
          detectionTimeMs: payload.detectionTimeMs,
          failureLocation:
            payload.component || "Python Order Processing Service",
          failureCause:
            "The primary test operation exceeded its configured timeout limit.",
          recoveryAction:
            payload.healingAction ||
            "No recovery action reported by the Python service.",
          verificationResult: payload.recoveryVerified
            ? payload.response || "Recovery response verified."
            : "Recovery response could not be verified.",
          message: payload.response || "Python simulation completed.",
          steps: [
            {
              message: "Test request sent to Python Worker",
              time: new Date(startTime).toISOString(),
              status: "DONE",
            },
            {
              message: payload.failureDetected
                ? `Timeout detected (${payload.detectionTimeMs ?? "N/A"} ms)`
                : "No timeout was detected",
              time: new Date().toISOString(),
              status: payload.failureDetected ? "DONE" : "INFO",
            },
            {
              message: payload.healingAction || "Recovery action completed",
              time: new Date().toISOString(),
              status: "DONE",
            },
            {
              message: payload.recoveryVerified
                ? "Recovery response verified successfully"
                : "Recovery verification was not successful",
              time: new Date().toISOString(),
              status: payload.recoveryVerified ? "DONE" : "FAILED",
            },
          ],
        };
      }

      const resultAt = Date.now();

      incident.steps = [
        {
          message: "Test request sent to service",
          time: new Date(startTime).toISOString(),
          status: "DONE",
        },
        {
          message: incident.failureDetected
            ? `Failure detected${
                incident.detectionTimeMs != null
                  ? ` in ${incident.detectionTimeMs} ms`
                  : ""
              }`
            : "Failure detection result received",
          time: new Date(
            Math.min(resultAt, startTime + 2100)
          ).toISOString(),
          status: "DONE",
        },
        {
          message: incident.recoveryAction || "Recovery result received",
          time: new Date(
            Math.min(resultAt, startTime + 3000)
          ).toISOString(),
          status: "DONE",
        },
        {
          message: incident.recoveryVerified
            ? "Recovery response verified successfully"
            : incident.verificationResult ||
              "Recovery verification result received",
          time: new Date(resultAt).toISOString(),
          status: incident.recoveryVerified ? "DONE" : "FAILED",
        },
      ];

      setCurrentIncident(incident);
      addIncidentToHistory(incident);
      setActiveStage(3);

      setSimulationState(
        incident.status === "RECOVERED" && incident.recoveryVerified
          ? "RECOVERED"
          : incident.status === "HEALTHY"
            ? "HEALTHY"
            : "COMPLETED"
      );
    } catch (err) {
      const failedIncident = {
        id: `ERR-${Date.now()}`,
        type,
        title: failure.title,
        status: "FAILED",
        failureDetected: false,
        recoveryVerified: false,
        failureLocation: failure.service,
        failureCause:
          err.message || "Unable to connect to the simulation service.",
        recoveryAction: "No recovery result received.",
        verificationResult: "Backend response could not be verified.",
        message:
          type === "api"
            ? "Check that the Python Worker is running on port 8000 and the endpoint exists."
            : "Check that the Node.js backend is running and the configuration route is mounted.",
        steps: [
          {
            message:
              "Request failed before a verified recovery result was received",
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
      clearStageTimers();
      setLoading("");
    }
  }

  const detectedCount = incidents.filter(
    (item) => item.failureDetected
  ).length;

  const recoveredCount = incidents.filter(
    (item) => item.status === "RECOVERED" && item.recoveryVerified
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
      currentIncident?.status === "RECOVERED" &&
      currentIncident?.recoveryVerified;

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
                LIVE FAILURE SIMULATION
              </p>

              <h1 className="mt-3 text-2xl font-bold text-[#173D35] sm:text-3xl">
                {activeSimulation.title}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78877C]">
                Follow the request, detection, recovery and verification
                stages below.
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
              <p className="font-semibold">Simulation could not complete</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-[#DCE5D8] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-bold text-[#173D35]">
                Execution Timeline
              </h2>
              <p className="mt-1 text-sm text-[#78877C]">
                Stage indicators update while the backend request is running.
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
                      : "bg-[#DCE5D8] text-[#173D35]"
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

          <div className="mt-7 space-y-0">
            {stageDefinitions.map((stage, index) => {
              const stageIncident = currentIncident?.steps?.[index];

              const done =
                stageIncident?.status === "DONE" ||
                (activeStage > index && !running);

              const current =
                activeStage === index &&
                running &&
                stageIncident?.status !== "DONE";

              const waiting =
                activeStage < index || (!stageIncident && running);

              return (
                <div key={stage.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                        done
                          ? "border-[#DCE5D8] bg-[#DCE5D8] text-[#173D35]"
                          : current
                            ? "border-[#D8C6A5] bg-[#D8C6A5]/30 text-[#765B2D]"
                            : "border-[#DCE5D8] bg-[#F7F4EC] text-[#78877C]"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 size={20} />
                      ) : current ? (
                        <LoaderCircle size={20} className="animate-spin" />
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

                      {current && (
                        <span className="rounded-full bg-[#D8C6A5]/30 px-2 py-1 text-[10px] font-bold uppercase text-[#765B2D]">
                          In progress
                        </span>
                      )}

                      {done && (
                        <span className="rounded-full bg-[#DCE5D8] px-2 py-1 text-[10px] font-bold uppercase text-[#173D35]">
                          Complete
                        </span>
                      )}

                      {waiting && (
                        <span className="rounded-full bg-[#F7F4EC] px-2 py-1 text-[10px] font-bold uppercase text-[#78877C]">
                          Waiting
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm leading-6 text-[#78877C]">
                      {stageIncident?.message ||
                        (waiting
                          ? "Waiting for previous step to complete..."
                          : stage.description)}
                    </p>

                    {stageIncident?.time && (
                      <p className="mt-1 text-xs text-[#78877C]">
                        {new Date(stageIncident.time).toLocaleTimeString()} ·{" "}
                        {stageIncident.status === "DONE"
                          ? "Completed"
                          : stageIncident.status === "FAILED"
                            ? "Failed"
                            : "In progress"}
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
                Processing request — please wait
              </div>
              <p className="mt-1 text-[#78877C]">
                The final status will be shown when the Python/Node service
                responds.
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

              <p className="mt-3 break-words text-sm text-[#78877C]">
                <strong className="text-[#173D35]">Recovery action:</strong>{" "}
                {currentIncident.recoveryAction || "N/A"}
              </p>

              <p className="mt-2 break-words text-sm text-[#78877C]">
                <strong className="text-[#173D35]">Final response:</strong>{" "}
                {currentIncident.message ||
                  currentIncident.verificationResult ||
                  "No response message"}
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
              className="rounded-lg border border-[#DCE5D8] bg-white px-5 py-3 text-sm font-semibold text-[#173D35] transition hover:bg-[#F7F4EC]"
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
            Run controlled failures and watch request processing, detection,
            healing and recovery verification.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-[#DCE5D8] bg-white p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DCE5D8] text-[#173D35]">
            <Activity size={23} />
          </div>

          <div>
            <p className="text-xs text-[#78877C]">MONITOR</p>
            <p className="mt-1 font-semibold text-[#173D35]">
              Recovery Control
            </p>
            <p className="mt-1 text-xs text-[#78877C]">
              On-demand testing
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tests Run"
          value={incidents.length}
          subtitle="Current session"
          icon={Activity}
          iconBg="bg-[#DCE5D8]"
          iconColor="text-[#173D35]"
        />

        <StatCard
          title="Failures Detected"
          value={detectedCount}
          subtitle="Detection events"
          icon={AlertTriangle}
          iconBg="bg-[#D8C6A5]/40"
          iconColor="text-[#765B2D]"
        />

        <StatCard
          title="Successfully Recovered"
          value={recoveredCount}
          subtitle="Verified recoveries"
          icon={CheckCircle2}
          iconBg="bg-[#DCE5D8]"
          iconColor="text-[#173D35]"
        />

        <StatCard
          title="Average Recovery"
          value={averageTime == null ? "—" : `${averageTime} ms`}
          subtitle="Across timed tests"
          icon={Clock3}
          iconBg="bg-[#F7F4EC]"
          iconColor="text-[#78877C]"
        />
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
                when the connection returns, and verify recovery through a live
                timeline.
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
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173D35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245448]"
          >
            <RefreshCw size={17} />
            Open Recovery
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#DCE5D8] bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#78877C]">
            SYSTEM OPERATIONS
          </p>

          <h2 className="mt-2 text-xl font-bold text-[#173D35] sm:text-2xl">
            Failure Simulator
          </h2>

          <p className="mt-2 text-sm text-[#78877C]">
            Choose a scenario. A dedicated live monitoring screen opens when
            you click Generate &amp; Test.
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Last test could not complete</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {failureTypes.map((failure) => {
            const Icon = failure.icon;

            return (
              <article
                key={failure.type}
                className="rounded-xl border border-[#DCE5D8] bg-white p-5 transition hover:border-[#78877C] hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#DCE5D8] bg-[#DCE5D8] text-[#173D35]">
                    <Icon size={23} />
                  </div>

                  <span className="rounded-full border border-[#DCE5D8] bg-[#F7F4EC] px-3 py-1.5 text-xs font-medium text-[#78877C]">
                    {failure.service}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold text-[#173D35]">
                  {failure.title}
                </h3>

                <p className="mt-2 min-h-10 text-sm leading-6 text-[#78877C]">
                  {failure.description}
                </p>

                <button
                  type="button"
                  onClick={() => openSimulation(failure)}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#173D35] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#245448]"
                >
                  <Zap size={16} />
                  Generate &amp; Test
                </button>
              </article>
            );
          })}
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
          Results from simulations performed in this session. The newest
          incident appears first.
        </p>

        {!incidents.length ? (
          <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-[#DCE5D8] bg-[#F7F4EC] px-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#DCE5D8] text-[#173D35]">
              <History size={25} />
            </div>

            <h3 className="mt-4 font-semibold text-[#173D35]">
              No incidents recorded
            </h3>

            <p className="mt-2 max-w-sm text-sm leading-6 text-[#78877C]">
              Run a failure simulation to view detection status, recovery steps
              and recovery time here.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {incidents.map((incident, index) => {
              const recovered =
                incident.status === "RECOVERED" &&
                incident.recoveryVerified;

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
                          {incident.title || `${incident.type} Failure`}
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
                          : incident.status === "HEALTHY"
                            ? "bg-[#F7F4EC] text-[#173D35]"
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

                  {incident.message && (
                    <div className="mx-4 mb-4 rounded-lg border border-[#DCE5D8] bg-[#F7F4EC] p-3 text-sm text-[#78877C] sm:mx-5">
                      {incident.message}
                    </div>
                  )}

                  <div className="mx-4 mb-4 space-y-3 sm:mx-5">
                    <div className="rounded-lg border border-[#DCE5D8] bg-[#F7F4EC] p-4">
                      <h4 className="font-bold text-[#173D35]">
                        Failure Analysis
                      </h4>
                      <p className="mt-3 text-sm text-[#78877C]">
                        <strong className="text-[#173D35]">
                          Failure Location:
                        </strong>{" "}
                        {incident.failureLocation || "Not provided"}
                      </p>
                      <p className="mt-2 text-sm text-[#78877C]">
                        <strong className="text-[#173D35]">
                          Failure Cause:
                        </strong>{" "}
                        {incident.failureCause || "Not provided"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-[#DCE5D8] bg-[#F7F4EC] p-4">
                      <h4 className="font-bold text-[#173D35]">
                        Self-Healing Action
                      </h4>
                      <p className="mt-3 text-sm text-[#78877C]">
                        <strong className="text-[#173D35]">
                          Recovery Method:
                        </strong>{" "}
                        {incident.recoveryAction || "Not provided"}
                      </p>
                      <p className="mt-2 text-sm text-[#78877C]">
                        <strong className="text-[#173D35]">
                          Verification:
                        </strong>{" "}
                        {incident.verificationResult || "Not provided"}
                      </p>
                    </div>
                  </div>

                  {Array.isArray(incident.steps) &&
                    incident.steps.length > 0 && (
                      <div className="px-4 pb-5 sm:px-5">
                        <h4 className="mb-4 text-sm font-bold text-[#173D35]">
                          Recovery Timeline
                        </h4>

                        <div className="space-y-4">
                          {incident.steps.map((step, stepIndex) => (
                            <div key={stepIndex} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#DCE5D8] bg-[#DCE5D8] text-xs font-semibold text-[#173D35]">
                                  {stepIndex + 1}
                                </div>

                                {stepIndex < incident.steps.length - 1 && (
                                  <div className="mt-1 h-full min-h-4 w-px bg-[#DCE5D8]" />
                                )}
                              </div>

                              <div className="min-w-0 pb-1">
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

function addIncidentToHistory(incident) {
  setIncidents((previous) => [
    incident,
    ...previous.filter((item) => item.id !== incident.id),
  ]);
}

function StatCard({ title, value, subtitle, icon: Icon, iconBg, iconColor }) {
  return (
    <div className="rounded-xl border border-[#DCE5D8] bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[#78877C]">{title}</p>
          <p className="mt-3 text-3xl font-bold text-[#173D35]">{value}</p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}
        >
          <Icon size={22} />
        </div>
      </div>

      <p className="mt-3 text-xs text-[#78877C]">{subtitle}</p>
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