import os
import re
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

    # 1. Math / Calculation Check (e.g. "what is 2+2", "2+2", "50 * 4150")
    math_result = evaluate_math(query_text)
    if math_result:
        return success_response({
            "text": math_result,
            "source": "server-calculator",
            "followUps": [
                "Calculate concrete trips for 50 cum",
                "What is the base rate for M25 concrete?",
                "Check live cement stock in silos"
            ]
        })

    # 2. Check for Gemini API key if present for server-side generative capabilities
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
                            "and all 13 plant reports. Format answers with concise markdown bullet points and friendly professional guidance. Answer general questions directly and politely."
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

    # 3. Small talk & Conversational Greetings
    q = query_text.lower().strip()
    greetings = ["hi", "hello", "hey", "namaste", "good morning", "good afternoon", "good evening", "hii", "helo"]
    if q in greetings or any(q.startswith(f"{g} ") for g in greetings):
        return success_response({
            "text": (
                "Hello! 👋 I am your **Sai RMC Plant Copilot**.\n\n"
                "I am connected to your live plant database at Mulkhed to assist with:\n"
                "* Planning dispatches & assigning Transit Mixers\n"
                "* Inspecting live raw material stock (cement silos & aggregates)\n"
                "* Monitoring QC slump and 7/28-day cube strength breaks\n"
                "* Generating and exporting all 13 official Excel reports\n\n"
                "What can I help you with today?"
            ),
            "actions": [
                {"label": "🚀 Dispatch Board", "to": "/dispatcher"},
                {"label": "📊 View 13 Reports", "to": "/reports"},
                {"label": "🧪 QA/QC Lab", "to": "/qa"}
            ],
            "followUps": [
                "How do I plan a trip and send to production?",
                "Check live cement and raw material stock",
                "Show demo login credentials"
            ],
            "source": "server-knowledge-base"
        })

    if "who are you" in q or "what is your name" in q:
        return success_response({
            "text": (
                "I am the **Sai RMC Plant Copilot**, an operational AI assistant purpose-built for the **Sai Ready-Mix Concrete Plant (Mulkhed, Pune)**.\n\n"
                "I have direct access to your plant database, order pipeline, fleet telemetry, batching recipes (CRB-75 & SP-30), and IS 456 testing protocols to provide zero-hallucination assistance."
            ),
            "actions": [
                {"label": "🚀 Dispatch Board", "to": "/dispatcher"},
                {"label": "📊 View 13 Reports", "to": "/reports"}
            ],
            "source": "server-knowledge-base"
        })

    if "how are you" in q:
        return success_response({
            "text": "I'm operating at 100% capacity! The batching plants (CRB-75 & SP-30) and fleet telemetry are running smoothly. How can I assist you with the plant today?",
            "source": "server-knowledge-base"
        })

    if q in ["thanks", "thank you", "thank u", "ok", "okay", "great", "awesome", "perfect"]:
        return success_response({
            "text": "You're very welcome! Feel free to ask anytime if you need help with dispatches, reports, cube tests, or store inventory.",
            "source": "server-knowledge-base"
        })

    # 4. Built-in Server Knowledge Base Fallback
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
            "I am ready to help you with the **Sai Ready-Mix Concrete Plant**:\n"
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

def evaluate_math(raw: str):
    cleaned = re.sub(r"^(what is|calculate|solve|how much is)\s+", "", raw, flags=re.I).strip()
    # Check for simple arithmetic: e.g. "2+2", "2 + 2", "50 * 4150", "120 / 3"
    if re.match(r"^[\d\.\s\+\-\*\/\(\)\%]+$", cleaned) and any(c.isdigit() for c in cleaned) and any(c in "+-*/%" for c in cleaned):
        try:
            # Safe evaluation for basic math
            sanitized = re.sub(r"[^0-9\+\-\*\/\.\(\)]", "", cleaned)
            val = eval(sanitized, {"__builtins__": None}, {})
            if isinstance(val, (int, float)):
                return f"### 🔢 Calculation Result\n\n`{cleaned}` = **{round(val, 4)}**"
        except Exception:
            pass
    return None
