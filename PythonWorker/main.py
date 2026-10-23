
from fastapi import FastAPI, HTTPException
import asyncio
import time
from datetime import datetime

app = FastAPI(title="RESILIO Failure Simulator")

@app.get("/")
def home():
    return {
        "project": "RESILIO",
        "service": "Order Processing Failure Simulator",
        "status": "RUNNING"
    }

@app.post("/simulate/order-timeout")
async def simulate_order_timeout():
    started = time.perf_counter()
    incident_id = f"ORD-FAIL-{int(time.time())}"

    print("\n========== FAILURE INJECTED ==========")
    print("Incident ID:", incident_id)
    print("Component: Order Processing Service")
    print("Failure: Order processing timeout")
    print("Cause: Simulated service delay")
    print("Status: PROCESSING")

    await asyncio.sleep(5)

    elapsed_ms = round((time.perf_counter() - started) * 1000)

    print("Status: FAILED")
    print("Failure duration:", elapsed_ms, "ms")
    print("Effect: Order confirmation delayed")
    print("Healing: NOT IMPLEMENTED")
    print("======================================\n")

    raise HTTPException(
        status_code=504,
        detail={
            "incidentId": incident_id,
            "failureType": "ORDER_PROCESSING_TIMEOUT",
            "component": "Order Processing Service",
            "status": "FAILED",
            "failureCause": "Order processing exceeded the allowed response time",
            "simulatedDelayMs": elapsed_ms,
            "businessImpact": "Order confirmation delayed",
            "healing": "Not implemented yet"
        }
    )



@app.post("/monitor/order-timeout")
async def monitor_order_timeout():
    started = time.perf_counter()
    incident_id = f"ORD-MON-{int(time.time())}"

    async def process_test_order():
        print("Order Processing Service: request started")
        await asyncio.sleep(5)
        return "Order processed"

    print("\n========== MONITORING STARTED ==========")
    print("Incident ID:", incident_id)
    print("Monitoring timeout: 5 seconds")

    try:
        result = await asyncio.wait_for(
            process_test_order(),
            timeout=2
        )

        elapsed_ms = round((time.perf_counter() - started) * 1000)

        return {
            "incidentId": incident_id,
            "status": "HEALTHY",
            "message": result,
            "durationMs": elapsed_ms
        }

    except asyncio.TimeoutError:
        elapsed_ms = round((time.perf_counter() - started) * 1000)

        print("FAILURE DETECTED: Order processing timeout")
        print("Detection time:", elapsed_ms, "ms")
        print("Business impact: Order confirmation delayed")
        print("Healing: NOT IMPLEMENTED")
        print("========================================\n")

        raise HTTPException(
            status_code=504,
            detail={
                "incidentId": incident_id,
                "failureType": "ORDER_PROCESSING_TIMEOUT",
                "status": "FAILURE_DETECTED",
                "detectionTimeMs": elapsed_ms,
                "timeoutLimitMs": 2000,
                "simulatedProcessingTimeMs": 5000,
                "businessImpact": "Order confirmation delayed",
                "healing": "Not implemented yet"
            }
        )



@app.post("/self-heal/order-timeout")
async def self_heal_order_timeout():
    started = time.perf_counter()
    incident_id = f"ORD-HEAL-{int(time.time())}"

    timeout_limit = 2

    print("\n========== RESILIO SELF-HEALING ==========")
    print("Incident ID:", incident_id)
    print("Stage 1: Starting test order operation")

    async def primary_order_service():
        print("Primary service: Processing...")
        await asyncio.sleep(5)
        return {"message": "Primary service completed"}

    async def recovery_order_service():
        print("Recovery service: Processing test request...")
        await asyncio.sleep(0.2)
        return {
            "message": "Test order response from recovery service"
        }

    failure_detected = False

    try:
        result = await asyncio.wait_for(
            primary_order_service(),
            timeout=timeout_limit
        )

        elapsed_ms = round((time.perf_counter() - started) * 1000)

        return {
            "success": True,
            "incidentId": incident_id,
            "status": "HEALTHY",
            "failureDetected": False,
            "response": result["message"],
            "totalTimeMs": elapsed_ms
        }

    except asyncio.TimeoutError:
        failure_detected = True
        detection_ms = round((time.perf_counter() - started) * 1000)

        print("Stage 2: TIMEOUT DETECTED")
        print("Failure: Primary service exceeded timeout")
        print("Detection time:", detection_ms, "ms")

    print("Stage 3: SELF-HEALING STARTED")
    print("Action: Using healthy recovery handler")

    try:
        result = await asyncio.wait_for(
            recovery_order_service(),
            timeout=3
        )

        total_ms = round((time.perf_counter() - started) * 1000)

        print("Stage 4: RECOVERY VERIFIED")
        print("Recovery response:", result["message"])
        print("Total recovery time:", total_ms, "ms")
        print("==========================================\n")

        return {
            "success": True,
            "incidentId": incident_id,
            "failureType": "ORDER_PROCESSING_TIMEOUT",
            "component": "Python Order Processing Service",
            "status": "RECOVERED",
            "failureDetected": failure_detected,
            "detectionTimeMs": detection_ms,
            "healingAction": "Timed-out test operation cancelled; recovery handler used",
            "recoveryVerified": True,
            "response": result["message"],
            "totalRecoveryTimeMs": total_ms,
            "businessImpact": "Primary test operation timed out; recovery response succeeded"
        }

    except asyncio.TimeoutError:
        total_ms = round((time.perf_counter() - started) * 1000)

        print("Stage 4: RECOVERY FAILED")
        print("Total time:", total_ms, "ms")
        print("==========================================\n")

        raise HTTPException(
            status_code=504,
            detail={
                "success": False,
                "incidentId": incident_id,
                "status": "HEALING_FAILED",
                "failureDetected": failure_detected,
                "totalRecoveryTimeMs": total_ms
            }
        )
