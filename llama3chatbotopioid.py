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

# === PDF and EXCEL TEXT EXTRACTION ===
def extract_text_from_pdf(pdf_path):
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            if page.extract_text():
                text += page.extract_text() + "\n"
    return text.strip()

def extract_tables_from_pdf(pdf_path):
    table_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    table_text += " | ".join(cell or "" for cell in row) + "\n"
    return table_text.strip()

def read_pdfs_in_folder(folder):
    output = ""
    for filename in os.listdir(folder):
        if filename.endswith(".pdf"):
            path = os.path.join(folder, filename)
            output += extract_text_from_pdf(path) + "\n\n"
            output += extract_tables_from_pdf(path) + "\n\n"
    return output

def extract_all_tables_first(folder):
    tables_output = ""
    for filename in os.listdir(folder):
        if filename.endswith(".pdf"):
            path = os.path.join(folder, filename)
            tables = extract_tables_from_pdf(path)
            if tables:
                tables_output += f"=== Tables from {filename} ===\n{tables}\n\n"
    return tables_output

def read_excel_as_text(excel_path):
    try:
        excel_data = pd.read_excel(excel_path, header=1, sheet_name=None)
        output = f"=== Excel File: {os.path.basename(excel_path)} ===\n"
        for sheet, df in excel_data.items():
            output += f"\n--- Sheet: {sheet} ---\n"
            output += df.to_string(index=False) + "\n"
        return output.strip()
    except Exception as e:
        return f"Error reading Excel: {str(e)}"

# === Load PDFs and Excel ===
pdf_folder = "pdfs"
excel_files = [
    "KFF_Opioid_Overdose_Deaths_2022.xlsx",
    "KFF_Opioid_Overdose_Deaths_by_Age_Group_2022.xlsx",
    "KFF_Opioid_Overdose_Deaths_by_Race_and_Ethnicity_2022.xlsx"
]

excel_text = ""
excel_df = None

for filename in excel_files:
    path = os.path.join(pdf_folder, filename)
    if os.path.exists(path):
        excel_text += read_excel_as_text(path) + "\n\n"
        df = pd.read_excel(path, header=1)
        if excel_df is None:
            excel_df = df
        else:
            excel_df = pd.concat([excel_df, df], ignore_index=True)

pdf_texts = read_pdfs_in_folder(pdf_folder)
all_table_text = extract_all_tables_first(pdf_folder)

combined_text = f"{excel_text}\n\n{pdf_texts}\n\n{all_table_text}"[:12000]

# === Keywords for Relevance Filter ===
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

def search_excel(question):
    if excel_df is not None:
        question_lower = question.lower()
        matches = []
        for col in excel_df.columns:
            if col.lower() in question_lower:
                matches.append(col)
        if matches:
            result = ""
            for match in matches:
                result += f"\n--- Column: {match} ---\n"
                result += excel_df[match].dropna().astype(str).to_string(index=False)[:12000]
            return result.strip()
    return None

# === Llama 3 API Call with Translation Support ===
def get_llama3_response(question, user_lang="en"):
    translator = Translator()

    try:
        translated_question = translator.translate(question, dest="en").text
    except Exception as e:
        print(f"Translation failed: {str(e)}")
        translated_question = question

    if not is_question_relevant(translated_question):
        return translator.translate(
            "Sorry, I can only answer questions about opioids, addiction, overdose, or treatment.",
            dest=user_lang
        ).text

    excel_result = search_excel(translated_question)
    if excel_result:
        return translator.translate(f"Based on the Excel data:\n\n{excel_result}", dest=user_lang).text

    conversation_history.append({"role": "user", "content": translated_question})

    system_prompt = """
You are an Opioid Awareness Chatbot created for Bowie State University.
Only answer questions related to opioids, addiction, overdose, and treatment using the provided data.
"""

    messages = [
        {"role": "system", "content": f"{system_prompt}\n\nContext:\n{combined_text}"},
        *conversation_history[-5:]
    ]

    headers = {
        "Authorization": f"Bearer {REN_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        res = requests.post(
            LLAMA3_ENDPOINT,
            headers=headers,
            json={"model": "meta-llama/llama-3-8b-instruct:free", "messages": messages},
            timeout=30
        )
        res.raise_for_status()
        data = res.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "No response.")
        conversation_history.append({"role": "assistant", "content": content})

        # ✅ Translate the final answer back to user's preferred language
        translated_response = translator.translate(content.strip(), dest=user_lang).text
        return translated_response

    except Exception as e:
        print(f"OpenRouter API Error: {str(e)}")
        return f"ERROR: {str(e)}"

# === Routes ===
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    question = data.get("question", "")
    lang = data.get("language", "en")  # ✅ Accept user's preferred language
    if not question:
        return jsonify({"error": "No question provided"}), 400
    answer = get_llama3_response(question, lang)
    return jsonify({"answer": answer})

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

@app.route("/env")
def check_env():
    return jsonify({
        "LLAMA3_ENDPOINT": LLAMA3_ENDPOINT,
        "REN_API_KEY_SET": bool(REN_API_KEY),
        "DATABASE_URL_SET": bool(DATABASE_URL)
    })

# === Run App ===
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
