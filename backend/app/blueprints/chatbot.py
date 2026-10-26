import os
import json
from flask import Blueprint, request
from backend.app.utils.responses import success_response, error_response

chatbot_bp = Blueprint("chatbot", __name__, url_prefix="/api/v1/chatbot")

@chatbot_bp.route("/query", methods=["POST"])
def chatbot_query():
    data = request.get_json(silent=True) or {}
    query_text = (data.get("query") or "").strip()
    user_role = data.get("role")

    if not query_text:
        return error_response(code="EMPTY_QUERY", message="Query string is required.", status_code=400)

    # Check for Gemini API key if present for server-side generative capabilities
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            import urllib.request
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {
                "system_instruction": {
                    "parts": [{
                        "text": (
                            "You are the Sai RMC Plant Copilot, an AI assistant for Sai Ready-Mix Concrete Plant located at Mulkhed, Pune. "
                            "You assist users with: plant operations, order planning, transit mixer dispatch, batching telemetry (CRB-75 and SP-30), "
                            "QA/QC cube testing (7-day >=70%, 28-day >=100% per IS 456), slump tests (IS 1199), raw material silos, driver incentives (₹350/trip), "
                            "and all 13 plant reports. Format answers with concise markdown bullet points and friendly professional guidance."
                        )
                    }]
                },
                "contents": [{
                    "role": "user",
                    "parts": [{"text": query_text}]
                }],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 600
                }
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                reply_text = result["candidates"][0]["content"]["parts"][0]["text"]
                return success_response({
                    "text": reply_text,
                    "source": "gemini-api"
                })
        except Exception:
            # Graceful fallback to server rule engine below
            pass

    # Built-in Server Knowledge Base Fallback
    q = query_text.lower()
    
    if "dispatch" in q or "plan" in q or "production" in q or "trip" in q:
        return success_response({
            "text": (
                "### 🚀 Dispatch & Production Workflow\n\n"
                "1. Go to **Dispatch Board** (`/dispatcher`).\n"
                "2. Click **'Plan Trips'** on any approved PO.\n"
                "3. Assign Transit Mixer (TM-01 to TM-12) & certified Driver.\n"
                "4. Tap **'Send to Production'** to transmit recipe parameters directly to the batching plant PLC.\n"
                "5. Monitor trip status: `BATCHING` ➔ `LOADED` ➔ `IN_TRANSIT` ➔ `AT_SITE`."
            ),
            "actions": [
                {"label": "🚀 Dispatch Board", "to": "/dispatcher"},
                {"label": "🏭 Production Telemetry", "to": "/production"}
            ],
            "followUps": [
                "What is the capacity of each Transit Mixer?",
                "How does the batch sheet generate?",
                "Where can I track delivery challans?"
            ],
            "source": "server-knowledge-base"
        })

    if "report" in q or "13" in q or "mpr" in q or "tm average" in q or "strength" in q:
        return success_response({
            "text": (
                "### 📊 Master Department Reports (13 Official Reports)\n\n"
                "* **Store Reports:** MPR Report, HR Report (Store), TM Average Report.\n"
                "* **Dispatch Reports:** Schedule & Production, Zone 02 Pump, Day Wise Production.\n"
                "* **HR Reports:** Staff Attendance, Sunday Working, MUL Attendance.\n"
                "* **QA/QC Reports:** Strength Data Since (7/28d), Consumption CRB-75, Consumption SP-30, Material Rejected.\n\n"
                "All reports support live date filtering and instant official Excel (.xlsx) / CSV exports."
            ),
            "actions": [
                {"label": "📊 Open 13 Reports", "to": "/reports"}
            ],
            "followUps": [
                "How do I export to Excel?",
                "Explain the MPR Store Report",
                "Explain Strength Data Since"
            ],
            "source": "server-knowledge-base"
        })

    if "qa" in q or "qc" in q or "cube" in q or "slump" in q or "test" in q:
        return success_response({
            "text": (
                "### 🧪 QA/QC Concrete Quality Control (IS 456 & IS 1199)\n\n"
                "* **Slump Check:** 120 ± 25 mm target at chute discharge before departure.\n"
                "* **Cube Casting:** Set of 6 cubes (150mm steel moulds) cured in 27°C water tank.\n"
                "* **7-Day Break:** Compressive strength must achieve ≥ 70% of characteristic grade.\n"
                "* **28-Day Break:** Compressive strength must achieve ≥ 100% of target (e.g. M25 ≥ 25 N/mm²).\n"
                "* **Rejection Rule:** Any load exceeding 2.5 hours transit or out-of-spec slump is logged in Material Rejected."
            ),
            "actions": [
                {"label": "🧪 Open QA/QC Lab", "to": "/qa"}
            ],
            "followUps": [
                "What happens if a 7-day cube test fails?",
                "How to record a new cube test result?"
            ],
            "source": "server-knowledge-base"
        })

    # Default General Guidance
    return success_response({
        "text": (
            "### 🤖 Sai RMC Plant Copilot\n\n"
            "Welcome to Sai ReadyMix Concrete Command Center. I can assist you with:\n"
            "* **Dispatch & Fleet:** Planning truck trips and sending to batching.\n"
            "* **Production:** CRB-75 and SP-30 batching telemetry and moisture adjustments.\n"
            "* **QA/QC:** IS 456 slump limits, cube testing protocols, and mix designs M15–M40.\n"
            "* **Store & Yard:** Cement silos, aggregate bins, and weighbridge operations.\n"
            "* **13 Reports:** Master operations, HR, commercial, and technical reports."
        ),
        "actions": [
            {"label": "🚀 Dispatch Board", "to": "/dispatcher"},
            {"label": "📊 View 13 Reports", "to": "/reports"},
            {"label": "🧪 QA/QC Lab", "to": "/qa"}
        ],
        "followUps": [
            "How do I plan a trip and send to production?",
            "Explain all 13 official plant reports",
            "How do QC cube tests work?"
        ],
        "source": "server-knowledge-base"
    })
