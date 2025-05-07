import os
import requests
import pdfplumber
import psycopg2
import urllib.parse as urlparse
import pandas as pd
from flask import Flask, request, render_template, jsonify
from flask_cors import CORS
from googletrans import Translator
import re

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
    "technology", "gaming", "tobacco", "alcohol", "Caffeine", "Nicotine", "Amphetamine",
    "Methylphenidate", "Cocaine", "Methamphetamine", "Benzodiazepines", "Z-drugs", "LSD (Acid)",
    "THC", "CBD", "synthethic cannabinoids", "SSRIs", "Antipsychotics", "antihistamines", "NSAIDs",
    "Acetaminophen"
]

relevant_topics = [
    "opioids", "addiction", "overdose", "withdrawal", "fentanyl", "heroin", "chronic pain", "pain",
    "painkillers", "narcotics", "opioid crisis", "naloxone", "rehab", "opiates", "opium", "scientists", "control group",
    "students", "teens", "adults", "substance abuse", "drugs", "tolerance", "help", "assistance", "scientific",
    "support", "support for opioid addiction", "drug use", "email", "campus", "phone number", "clinician", "evidence",
    "BSU", "Bowie State University", "opioid use disorder", "opioid self-medication", "self medication", "clinical",
    "risk factors", "disparity", "racism", "bias", "addict", "marginalized","challenges", "long-term factors",
    "short-term factors", "consequences", "disease", "cancer", "treatment-seeking", "stigma", "stigmas", "opioid users", "communities",
    "number", "percentage", "symptoms", "signs", "opioid abuse", "opioid misuse", "physical dependence", "prescription",
    "medication-assisted treatment", "MAT", "OUD", "opioid epidemic", "teen", "dangers", "genetic", "ethical", "ethics",
    "environmental factors", "pain management", "consequences", "prevention", "doctor", "physician",
    "adult", "death", "semi-synthetic opioids", "neonatal abstinence syndrome", "NAS", "pharmacology", "pharmacological",
    "brands", "treatment programs", "medication", "young people", "peer pressure", "socioeconomic factors", "DO", "MD", 
    "income inequality", "healthcare disparities", "psychological", "psychology", "screen"
]

def normalize_language_code(lang):
    zh_map = {'zh': 'zh-CN', 'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW'}
    return zh_map.get(lang.lower(), lang)

def is_question_relevant(question):
    question_lower = question.lower().strip()
    matched_irrelevant = [topic for topic in irrelevant_topics if topic in question_lower]
    matched_relevant = [topic for topic in relevant_topics if topic in question_lower]

    print("Question:", question_lower)
    print("Matched irrelevant topics:", matched_irrelevant)
    print("Matched relevant topics:", matched_relevant)

    if matched_irrelevant and not matched_relevant:
        return False

    if matched_relevant:
        return True

    recent_user_msgs = [msg["content"] for msg in reversed(conversation_history) if msg["role"] == "user"]
    for msg in recent_user_msgs[:5]:
        if any(topic in msg.lower() for topic in relevant_topics):
            return True

    return False

def load_combined_context():
    combined_text = ""
    actual_references = []
    data_folder = "pdf"  # updated folder name

    pdf_files = [f for f in os.listdir(data_folder) if f.lower().endswith(".pdf")]
    for filename in pdf_files:
        try:
            filepath = os.path.join(data_folder, filename)
            with pdfplumber.open(filepath) as pdf:
                for i, page in enumerate(pdf.pages, 1):
                    text = page.extract_text()
                    if text:
                        combined_text += f"\n\n[Source: {filename}, Page {i}]\n{text}\n"
                        actual_references.extend(re.findall(r'https?://\S+', text))
        except Exception as e:
            print(f"Failed to load {filename}: {str(e)}")

    excel_files = [f for f in os.listdir(data_folder) if f.lower().endswith(".xlsx")]
    for filename in excel_files:
        try:
            filepath = os.path.join(data_folder, filename)
            df = pd.read_excel(filepath)
            for index, row in df.iterrows():
                row_text = " ".join(str(cell) for cell in row)
                combined_text += f"\n\n[Source: {filename}, Row {index+1}]\n{row_text}\n"
                actual_references.extend(re.findall(r'https?://\S+', row_text))
        except Exception as e:
            print(f"Failed to load {filename}: {str(e)}")

    return combined_text.strip(), list(set(actual_references))

combined_text, known_references = load_combined_context()

def validate_links_in_response(text):
    def check_link(url):
        try:
            res = requests.head(url, timeout=5, allow_redirects=True)
            return res.status_code == 200
        except:
            return False

    links = re.findall(r'https?://\S+', text)
    for link in links:
        if not check_link(link):
            print(f"Removed broken or hallucinated link: {link}")
            text = text.replace(link, "[Broken or Invalid Link Removed]")
    return text

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

    system_prompt = """You are an educational chatbot specifically designed to provide accurate, factual, and age-appropriate
    information about opioids, including opioid use and misuse, addiction, overdose, prevention, pain management, treatment, risk factors, 
    and related topics. Your responses must stay strictly within opioid-related content. You may cite external references if they are real and 
    relevant to opioids. Prefer official sources like .gov, .edu, or .org when possible. Always cite sources at the end of your answers and never
    hallucinate or invent URLs. If no valid source exists, write 'No citation available.'"""

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
        res = requests.post(LLAMA3_ENDPOINT, headers=headers, json=payload, timeout=60)
        res.raise_for_status()
        print("Status Code:", res.status_code)
        print("Raw Response:", res.text)
        data = res.json()
        if "choices" in data and data["choices"]:
            message = data["choices"][0].get("message", {})
            content = message.get("content", "").strip()
            content = validate_links_in_response(content)
            if not content:
                content = "I'm here to help, but the response was unexpectedly empty. Please try again."
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
