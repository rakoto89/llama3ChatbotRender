import os
import os
import requests
import pdfplumber
import psycopg2
import urllib.parse as urlparse
import pandas as pd
from flask import Flask, request, render_template, jsonify
from flask_cors import CORS
import json

app = Flask(__name__, static_url_path='/static')
CORS(app)

# ==== ENVIRONMENT CONFIG ====
LLAMA3_ENDPOINT = os.environ.get("LLAMA3_ENDPOINT", "https://openrouter.ai/api/v1/chat/completions").strip()
REN_API_KEY = os.environ.get("REN_API_KEY", "").strip()
FEEDBACK_SECRET_KEY = os.environ.get("FEEDBACK_SECRET_KEY", "test-key")

DATABASE_URL = os.environ.get("DATABASE_URL")
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

# ==== PDF Extraction ====
def extract_text_from_pdf(pdf_paths):
    text = ""
    with pdfplumber.open(pdf_paths) as pdf:
        for page in pdf.pages:
            extracted_text = page.extract_text()
            if extracted_text:
                text += extracted_text + "\n"
    return text.strip()

def extract_tables_from_pdf(pdf_path):
    table_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if row:
                        table_text += " | ".join(cell if cell else "" for cell in row) + "\n"
    return table_text.strip()

def read_pdfs_in_folder(folder_path):
    concatenated_text = ''
    for filename in os.listdir(folder_path):
        if filename.endswith('.pdf'):
            pdf_path = os.path.join(folder_path, filename)
            pdf_text = extract_text_from_pdf(pdf_path)
            table_text = extract_tables_from_pdf(pdf_path)
            concatenated_text += pdf_text + '\n\n'
            concatenated_text += table_text + '\n\n'
    return concatenated_text

def extract_all_tables_first(folder_path):
    combined_table_text = ""
    for filename in os.listdir(folder_path):
        if filename.endswith('.pdf'):
            pdf_path = os.path.join(folder_path, filename)
            table_text = extract_tables_from_pdf(pdf_path)
            if table_text.strip():
                combined_table_text += f"=== Tables from {filename} ===\n{table_text}\n\n"
    return combined_table_text.strip()

# === Excel Support ===
def read_excel_as_text(excel_path):
    try:
        excel_data = pd.read_excel(excel_path, header=1, sheet_name=None)
        full_text = "=== Excel Data ===\n"
        for sheet_name, df in excel_data.items():
            full_text += f"\n--- Sheet: {sheet_name} ---\n"
            full_text += df.to_string(index=False)
            full_text += "\n\n"
        return full_text.strip()
    except Exception as e:
        return f"Error reading Excel file: {str(e)}"

def get_excel_value(state, age_range):
    if excel_df is None:
        return "Excel file not found."
    try:
        value = excel_df.loc[excel_df["Location"].str.lower() == state.lower(), age_range].values[0]
        return str(value)
    except:
        return f"Sorry, I couldn't find data for {state} and category '{age_range}'."

# === COMBINE PDF + Excel ===
pdf_folder = 'pdfs'
excel_path = os.path.join(pdf_folder, "KFF_Opioid_Overdose_Deaths_by_Age_Group_2022.xlsx")

all_table_text = extract_all_tables_first(pdf_folder)
pdf_texts = read_pdfs_in_folder(pdf_folder)
excel_text = read_excel_as_text(excel_path) if os.path.exists(excel_path) else ""
excel_df = pd.read_excel(excel_path, header=1) if os.path.exists(excel_path) else None

# Prioritize Excel text in the context
pdf_text = (excel_text + "\n\n" + all_table_text + "\n\n" + pdf_texts)[:5000]

# ==== Keywords ====
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

# ==== Relevance & Context ====
def is_question_relevant(question):
    if any(topic.lower() in question.lower() for topic in relevant_topics):
        return True
    for i in range(len(conversation_history) - 2, -1, -2):
        user_msg = conversation_history[i]
        if any(topic.lower() in user_msg["content"].lower() for topic in relevant_topics):
            return True
    return False

def update_conversation_context(question):
    keywords = [keyword for keyword in relevant_topics if keyword in question.lower()]
    if keywords:
        conversation_context['last_topic'] = keywords[-1]

# ==== Llama 3 Call ====
def get_llama3_response(question):
    if not is_question_relevant(question):
        return "Sorry, I can only answer questions related to opioids, addiction, overdose, or withdrawal."

    update_conversation_context(question)
    conversation_history.append({"role": "user", "content": question})

    combined_text = pdf_text

    system_prompt = """
    You are an Opioid Awareness Chatbot developed for Bowie State University.
    You must ONLY answer questions related to opioids, opioid misuse, pain management, addiction, prevention, or recovery.

    You have access to data extracted from PDFs and Excel spreadsheets, which may include overdose deaths, rates, and trends by state and age group. Use this data to answer questions when relevant.

    Do NOT answer questions about celebrities, entertainment, politics, or anything outside of opioid awareness.
    """

    messages = [
        {"role": "system", "content": f"{system_prompt}\n\nUse this context: {combined_text}"},
        *conversation_history[-5:]
    ]

    headers = {
        "Authorization": f"Bearer {REN_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(
            LLAMA3_ENDPOINT,
            json={
                "model": "meta-llama/llama-3.1-8b-instruct:free",
                "messages": messages
            },
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "No response").replace("*", "")

        banned_terms = ["lady gaga", "michael jackson", "taylor swift", "elvis", "beyoncé", "celebrity"]
        if any(term in response_text.lower() for term in banned_terms):
            return "Sorry, I can only answer questions related to opioids, addiction, overdose, or withdrawal."

        conversation_history.append({"role": "assistant", "content": response_text})
        return format_response(response_text)

    except requests.exceptions.RequestException as e:
        return f"ERROR: Failed to connect to Llama 3. Details: {str(e)}"

def format_response(response_text, for_voice=False):
    formatted_text = response_text.strip().replace("brbr", "")
    return formatted_text.replace("<br>", " ").replace("\n", " ") if for_voice else formatted_text.replace("\n", "<br>")

# ==== Routes ====
@app.route("/")
def index():
    intro_message = "🤖 Welcome to the Opioid Awareness Chatbot! Here you will learn all about opioids!"
    return render_template("index.html", intro_message=intro_message)

@app.route("/ask", methods=["POST"])
def ask():
    data = request.json
    user_question = data.get("question", "").strip()
    if not user_question:
        return jsonify({"answer": "Please ask a valid question."})

    # Optional: direct lookup
    if "alaska" in user_question.lower() and ("0-24" in user_question or "0 to 24" in user_question):
        return jsonify({"answer": get_excel_value("Alaska", "Age 0-24")})

    if is_question_relevant(user_question):
        answer = get_llama3_response(user_question)
    else:
        answer = "Sorry, I can only answer questions related to opioids, addiction, overdose, or withdrawal."
    return jsonify({"answer": answer})

@app.route("/voice", methods=["POST"])
def voice_response():
    data = request.json
    user_question = data.get("question", "").strip()
    if not user_question:
        return jsonify({"answer": "Please ask a valid question."})
    if is_question_relevant(user_question):
        answer = get_llama3_response(user_question)
        clean_voice_response = format_response(answer, for_voice=True)
    else:
        clean_voice_response = "Sorry, I can only answer questions related to opioids, addiction, overdose, or withdrawal."
    return jsonify({"answer": clean_voice_response})

@app.route("/feedback", methods=["GET", "POST"])
def feedback():
    if request.method == "POST":
        feedback_text = request.form.get("feedback")
        rating = request.form.get("rate")
        user_id = request.remote_addr

        if feedback_text or rating:
            try:
                conn = psycopg2.connect(**db_config)
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO feedback (user_id, rating, comments)
                    VALUES (%s, %s, %s);
                """, (user_id, int(rating), feedback_text))
                conn.commit()
                cur.close()
                conn.close()
                return render_template("feedback.html", success=True)
            except Exception as e:
                app.logger.error(f"Database insert error: {e}")
                return render_template("feedback.html", success=False)
    return render_template("feedback.html", success=False)

@app.route("/view_feedback", methods=["GET"])
def view_feedback():
    key = request.args.get("key", "")
    if key != FEEDBACK_SECRET_KEY:
        return jsonify({"error": "Unauthorized access"}), 401

    try:
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        cur.execute("SELECT user_id, rating, comments, submitted_at FROM feedback ORDER BY submitted_at DESC;")
        rows = cur.fetchall()
        cur.close()
        conn.close()

        feedback_data = [
            {"user_id": row[0], "rating": row[1], "comments": row[2], "submitted_at": str(row[3])}
            for row in rows
        ]
        return jsonify({"feedback": feedback_data})
    except Exception as e:
        app.logger.error(f"Database fetch error: {e}")
        return jsonify({"error": "Could not fetch feedback"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
