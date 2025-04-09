import os
import requests
import pdfplumber
import psycopg2
import urllib.parse as urlparse
from flask import Flask, request, render_template, jsonify
from flask_cors import CORS
from googletrans import Translator

app = Flask(__name__, static_url_path='/static')
CORS(app)

# === ENVIRONMENT VARIABLES ===
LLAMA3_ENDPOINT = os.environ.get("LLAMA3_ENDPOINT", "https://openrouter.ai/api/v1/chat/completions").strip()
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

# === PDF TEXT EXTRACTION ===
def extract_text_from_pdf(pdf_path):
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            if page.extract_text():
                text += page.extract_text() + "\n"
    return text.strip()

def extract_text_from_pdf(pdf_paths):
    text = ""
    with pdfplumber.open(pdf_paths) as pdf:
        for page in pdf.pages:
            extracted_text = page.extract_text()
            if extracted_text:
                text += extracted_text + "\n"
    return text.strip()

def read_pdfs_in_folder(folder_path):
    concatenated_text = ''
    for filename in os.listdir(folder_path):
        if filename.endswith('.pdf'):
            pdf_path = os.path.join(folder_path, filename)
            pdf_text = extract_text_from_pdf(pdf_path)
            concatenated_text += pdf_text + '\n\n'
    return concatenated_text

# === Load PDFs ===
pdf_folder = "pdfs"
pdf_texts = read_pdfs_in_folder(pdf_folder)

# === Relevance Keywords ===
relevant_topics = [
    "opioids", "addiction", "overdose", "withdrawal", "fentanyl", "heroin",
    "painkillers", "narcotics", "opioid crisis", "naloxone", "rehab", "opiates", "opium",
    "students", "teens", "adults", "substance abuse", "drugs", "tolerance", "help", "assistance",
    "support", "support for opioid addiction", "drug use", "email", "campus", "phone number",
    "BSU", "Bowie State University", "opioid use disorder", "opioid self-medication", "self medication",
    "number", "percentage", "symptoms", "signs", "opioid abuse", "opioid misuse", "physical dependence", "prescription",
    "medication-assisted treatment", "MAT", "opioid epidemic", "teen", "dangers", "genetic", 
    "environmental factors", "pain management", "socioeconomic factors", "consequences", 
    "adult", "death", "semi-synthetic opioids", "neonatal abstinence syndrome", "NAS", 
    "brands", "treatment programs", "medication", "young people", "peer pressure"
]

def is_question_relevant(question):
    return any(topic in question.lower() for topic in relevant_topics)

# === Llama 3 API Call ===
def get_llama3_response(question):
    print("QUESTION:", question)  # Debugging

    if not is_question_relevant(question):
        return "Sorry, I can only answer questions about opioids, addiction, overdose, or treatment."

    conversation_history.append({"role": "user", "content": question})

    system_prompt = """
You are an Opioid Awareness Chatbot created for Bowie State University.
Only answer questions related to opioids, addiction, overdose, and treatment using the provided data.
"""

    messages = [
        {"role": "system", "content": f"{system_prompt}\n\nContext:\n{pdf_texts}"},
        *conversation_history[-5:]
    ]

    headers = {
        "Authorization": f"Bearer {REN_API_KEY}",
        "Content-Type": "application/json"
    }

    print("REN_API_KEY:", REN_API_KEY)  # Debugging – Remove in production

    try:
        res = requests.post(
            LLAMA3_ENDPOINT,
            headers=headers,
            json={"model": "meta-llama/llama-3.1-8b-instruct:free", "messages": messages},
            timeout=25
        )
        res.raise_for_status()
        data = res.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "No response.")
        print("API RESPONSE:", content)  # Debugging
        conversation_history.append({"role": "assistant", "content": content})
        return content.strip()
    except Exception as e:
        print("API ERROR:", str(e))  # Debugging
        return f"ERROR: {str(e)}"

# === Flask Routes ===
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    question = data.get("question", "")
    if not question:
        return jsonify({"error": "No question provided"}), 400
    answer = get_llama3_response(question)
    return jsonify({"response": answer})  # Correct key

@app.route("/translate", methods=["POST"])
def translate():
    data = request.json
    text = data.get("text", "")
    lang = data.get("target_lang", "en")
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

# === Run App ===
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
