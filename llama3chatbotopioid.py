import os
import requests
import pdfplumber
import psycopg2
import urllib.parse as urlparse
import pandas as pd
from flask import Flask, request, render_template, jsonify
from flask_cors import CORS
from googletrans import Translator

app = Flask(__name__, static_url_path='/static')
CORS(app)

LLAMA3_ENDPOINT = os.environ.get("LLAMA3_ENDPOINT", "https://api.together.xyz/v1/chat/completions").strip()
REN_API_KEY = os.environ.get("REN_API_KEY", "").strip()
FEEDBACK_SECRET_KEY = os.environ.get("FEEDBACK_SECRET_KEY", "test-key")

DATABASE_URL = os.environ.get("DATABASE_URL", "")
url = urlparse.urlparse(DATABASE_URL)
db_config = {
    "dbname": url.path[1:],
    "user": url.username,
    "password": url.password,
    "host": url.hostname,
    "port": url.port
}

conversation_history = []
conversation_context = {}

irrelevant_topics = [
    "singer", "actor", "actress", "movie", "pop culture", "music", "sports",
    "nature", "celebrity", "tv show", "fashion", "entertainment", "politics",
    "history", "geography", "animal", "weather", "food", "recipe", "finance",
    "technology", "gaming"
]

relevant_topics = [
    "opioids", "addiction", "overdose", "withdrawal", "fentanyl", "heroin",
    "painkillers", "narcotics", "opioid crisis", "naloxone", "rehab", "opiates", "opium",
    "students", "teens", "adults", "substance abuse", "drugs", "tolerance", "help", "assistance",
    "support", "support for opioid addiction", "drug use", "email", "campus", "phone number",
    "BSU", "Bowie State University", "opioid use disorder", "opioid self-medication", "self medication",
    "number", "percentage", "symptoms", "signs", "opioid abuse", "opioid misuse", "physical dependence", "prescription",
    "medication-assisted treatment", "MAT", "OUD", "opioid epidemic", "teen", "dangers", "genetic", 
    "environmental factors", "pain management", "socioeconomic factors", "consequences", 
    "adult", "death", "semi-synthetic opioids", "neonatal abstinence syndrome", "NAS", "pharmacology", "pharmacological"
    "brands", "treatment programs", "medication", "young people", "peer pressure", "socioeconomic factors", 
    "socio-economic factors", "income inequality", "healthcare disparities", "pychological", "psychology", "screen"
]

def normalize_language_code(lang):
    zh_map = {'zh': 'zh-CN', 'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW'}
    return zh_map.get(lang.lower(), lang)

def is_question_relevant(question):
    question_lower = question.lower()

    if any(irrelevant in question_lower for irrelevant in irrelevant_topics):
        return False

    if any(topic in question_lower for topic in relevant_topics):
        return True

    recent_user_msgs = [msg["content"] for msg in reversed(conversation_history) if msg["role"] == "user"]
    for msg in recent_user_msgs[:5]:
        if any(topic in msg.lower() for topic in relevant_topics):
            return True

    return False

def load_combined_context():
    combined_text = ""

    # Load text from PDF
    try:
        with pdfplumber.open("data/your_pdf_file.pdf") as pdf:
            for page in pdf.pages:
                combined_text += page.extract_text() + "\n"
    except Exception as e:
        print(f"Failed to load PDF: {str(e)}")

    # Load text from Excel
    try:
        df = pd.read_excel("data/your_excel_file.xlsx")
        combined_text += "\n".join(df.astype(str).apply(lambda row: " ".join(row), axis=1))
    except Exception as e:
        print(f"Failed to load Excel: {str(e)}")

    return combined_text.strip()

# Load context from PDF and Excel at startup
combined_text = load_combined_context()

def get_llama3_response(question, user_lang="en"):
    user_lang = normalize_language_code(user_lang)
    translator = Translator()

    try:
        translated_question = translator.translate(question, dest="en").text
    except Exception as e:
        print(f"Translation failed: {str(e)}")
        translated_question = question

    if not is_question_relevant(translated_question):
        try:
            return translator.translate(
                "Sorry, I can only answer questions about opioids, addiction, overdose, or treatment.",
                dest=user_lang
            ).text
        except Exception as e:
            print(f"Translation fallback failed: {str(e)}")
            return "Sorry, I can only answer questions about opioids, addiction, overdose, or treatment."

    conversation_history.append({"role": "user", "content": translated_question})

    system_prompt = """You are an educational Opioid Awareness Chatbot created for Bowie State University.
You are an educational chatbot designed to provide safe, factual, and age-appropriate information specifically about opioids, including topics such as opioid use and misuse, addiction,
 overdose, prevention, pain management, and treatment. You must only answer questions directly related to opioid awareness and are strictly prohibited from discussing unrelated topics
 such as celebrities, entertainment, politics, or general health. Even if users ask multiple times, you are not allowed to provide any information outside the scope of opioid education. 
You can understand and respond to follow-up questions by using the context from previous messages, but all responses must be based solely on the educational data provided to you. You may also
discuss health disparities. You are required to discusses issues about socioeconomic, racial disparites are factors related to opioid abuse and opioid use disorder. You are also required to
discuss the ethical, pyschological implications, challenges and consequences that come with opioid addiction"""

    messages = [
        {"role": "system", "content": f"{system_prompt}\n\nContext:\n{combined_text}"},
        *conversation_history[-5:]
    ]

    headers = {
        "Authorization": f"Bearer {REN_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "meta-llama/Llama-3-8b-chat-hf",
        "messages": messages
    }

    try:
        res = requests.post(
            LLAMA3_ENDPOINT,
            headers=headers,
            json=payload,
            timeout=60
        )
        res.raise_for_status()

        print("Status Code:", res.status_code)
        print("Raw Response:", res.text)

        data = res.json()

        if "choices" in data and data["choices"]:
            message = data["choices"][0].get("message", {})
            content = message.get("content", "").strip()
            if not content:
                content = "I’m here to help, but the response was unexpectedly empty. Please try again."
        else:
            content = "I'm having trouble getting a valid response right now. Please try again or rephrase your question."

    except requests.exceptions.Timeout:
        content = "The server took too long to respond. Please try again shortly."

    except requests.exceptions.HTTPError as e:
        content = f"Server returned an HTTP error: {str(e)}"

    except Exception as e:
        print("Unhandled error:", str(e))
        content = "Our apologies, a technical error occurred. Please reach out to our system admin at akotor0621@students.bowiestate.edu."

    conversation_history.append({"role": "assistant", "content": content})

    try:
        return translator.translate(content, dest=user_lang).text
    except Exception as e:
        print(f"Response translation failed: {str(e)}")
        return content

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    question = data.get("question", "")
    lang = normalize_language_code(data.get("language", "en"))
    if not question:
        return jsonify({"error": "No question provided"}), 400
    answer = get_llama3_response(question, lang)
    return jsonify({"answer": answer})

@app.route("/translate", methods=["POST"])
def translate():
    data = request.json
    text = data.get("text", "")
    lang = normalize_language_code(data.get("target_lang", "en"))
    try:
        translation = Translator().translate(text, dest=lang)
        return jsonify({"translated_text": translation.text})
    except Exception as e:
        return jsonify({"error": f"Translation error: {str(e)}"}), 500

@app.route("/feedback", methods=["GET", "POST"])
def feedback():
    if request.method == "POST":
        rating = request.form.get("rate")
        feedback_text = request.form.get("feedback")
        user_id = request.remote_addr
        try:
            conn = psycopg2.connect(**db_config)
            cur = conn.cursor()
            cur.execute("INSERT INTO feedback (user_id, rating, comments) VALUES (%s, %s, %s);",
                        (user_id, int(rating), feedback_text))
            conn.commit()
            cur.close()
            conn.close()
            return render_template("feedback.html", success=True)
        except Exception as e:
            app.logger.error(f"DB Error: {e}")
            return render_template("feedback.html", success=False)
    return render_template("feedback.html", success=False)

@app.route("/env")
def check_env():
    return jsonify({
        "LLAMA3_ENDPOINT": LLAMA3_ENDPOINT,
        "REN_API_KEY_SET": bool(REN_API_KEY),
        "DATABASE_URL_SET": bool(DATABASE_URL)
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
