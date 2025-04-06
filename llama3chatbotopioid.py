import os
import psycopg2
import requests
import pdfplumber
from flask import Flask, request, render_template, jsonify, redirect, url_for
from flask_cors import CORS
from difflib import SequenceMatcher
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__, static_url_path='/static')
CORS(app)

# Fetch environment variables
LLAMA3_ENDPOINT = os.environ.get("LLAMA3_ENDPOINT", "https://openrouter.ai/api/v1/chat/completions").strip()
REN_API_KEY = os.environ.get("REN_API_KEY", "").strip()
PDF_FOLDER = os.environ.get("PDF_FOLDER", "pdfs")
FEEDBACK_SECRET_KEY = os.environ.get("FEEDBACK_SECRET_KEY", "")

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

def read_pdfs_in_folder(folder_path):
    concatenated_text = ''
    for filename in os.listdir(folder_path):
        if filename.endswith('.pdf'):
            pdf_path = os.path.join(folder_path, filename)
            pdf_text = extract_text_from_pdf(pdf_path)
            concatenated_text += pdf_text + '\n\n'
    return concatenated_text

# Read PDFs from the folder
pdf_text = read_pdfs_in_folder(PDF_FOLDER)

# ==== Keywords ====
relevant_topics = [
    "opioids", "addiction", "overdose", "withdrawal", "fentanyl", "heroin",
    "painkillers", "narcotics", "opioid crisis", "naloxone", "rehab", "opiates", "opium",
    "students", "teens", "adults", "substance abuse", "drugs", "tolerance", "help", "assistance",
    "support", "support for opioid addiction", "drug use", "email", "campus", "phone number",
    "BSU", "Bowie State University", "opioid use disorder", "opioid self-medication", "self medication",
    "number", "percentage", "symptoms", "signs", "opioid abuse", "opioid misuse", "physical dependence", "prescription",
    "medication-assisted treatment", "medication assistantedtreatment", "MAT", "opioid epidemic", "teen",
    "dangers", "genetic", "environmental factors", "pain management", "socioeconomic factors", "consequences", "adult", "death",
    "semi-synthetic opioids", "neonatal abstinence syndrome", "NAS", "brands", "treatment programs", "medication", "young people", 
    "percentage", "peer pressure"
]

# ==== Relevance & Context ====
def is_question_relevant(question):
    if len(conversation_history) < 2:
        return False
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
    # Strict filter: block irrelevant questions immediately
    if not is_question_relevant(question):
        return "Sorry, I can only discuss topics related to opioid addiction, misuse, prevention, or recovery."

    update_conversation_context(question)
    conversation_history.append({"role": "user", "content": question})

    combined_text = pdf_text[:5000]

    system_prompt = """
    You are an Opioid Awareness Chatbot developed for Bowie State University.
    You must ONLY answer questions related to opioids, opioid misuse, pain management, addiction, prevention, or recovery.
    Do NOT answer questions about celebrities, entertainment, politics, or anything outside of opioid awareness.
    If the question is off-topic, respond with:
    'Sorry, I can only discuss topics related to opioid addiction, misuse, prevention, or recovery.'
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
        app.logger.info(f"Sending request to Llama 3 with {len(messages)} messages")
        response = requests.post(
            LLAMA3_ENDPOINT,
            json={
                "model": "meta-llama/llama-3.1-8b-instruct:free",
                "messages": messages
            },
            headers=headers,
            timeout=30
        )
        app.logger.info(f"Status: {response.status_code}")
        app.logger.info(f"Body: {response.text}")

        response.raise_for_status()
        data = response.json()
        response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "No response").replace("*", "")

        # Optional: final guard — overwrite off-topic responses that slip through
        banned_terms = ["lady gaga", "michael jackson", "taylor swift", "elvis", "beyoncé", "celebrity", "musician", "singer", "actor", "entertainer"]
        if any(term in response_text.lower() for term in banned_terms):
            return "Sorry, I can only discuss topics related to opioid addiction, misuse, prevention, or recovery."

        conversation_history.append({"role": "assistant", "content": response_text})

        return format_response(response_text)

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Llama 3 API error: {str(e)}")
        return f"ERROR: Failed to connect to Llama 3 instance. Details: {str(e)}"

def format_response(response_text, for_voice=False):
    formatted_text = response_text.strip().replace("brbr", "")
    return formatted_text.replace("<br>", " ").replace("\n", " ") if for_voice else formatted_text.replace("\n", "<br>")

# ==== PostgreSQL Database Connection ====
def get_db_connection():
    connection = psycopg2.connect(
        host=os.environ.get("DB_HOST", ""),  # Using environment variables
        database=os.environ.get("DB_NAME", ""),  # Your database name
        user=os.environ.get("DB_USER", ""),  # Your user
        password=os.environ.get("DB_PASSWORD", "")  # Your password
    )
    return connection

# ==== Routes ====
@app.route("/feedback", methods=["GET", "POST"])
def feedback():
    if request.method == "POST":
        feedback_text = request.form.get("feedback")
        rating = request.form.get("rate")
        if feedback_text or rating:
            # Connect to PostgreSQL and insert feedback
            try:
                conn = get_db_connection()
                cursor = conn.cursor()

                # Insert feedback into the database
                cursor.execute("""
                    INSERT INTO feedback (feedback_text, rating) 
                    VALUES (%s, %s)
                """, (feedback_text, rating))
                
                # Commit the transaction
                conn.commit()
                
                # Close the cursor and connection
                cursor.close()
                conn.close()
                
                return render_template("feedback.html", success=True)
            except Exception as e:
                app.logger.error(f"Error saving feedback to database: {e}")
                return render_template("feedback.html", success=False)
    return render_template("feedback.html", success=False)

@app.route("/view_feedback", methods=["GET"])
def view_feedback():
    key = request.args.get("key", "")
    if key != FEEDBACK_SECRET_KEY:
        return jsonify({"error": "Unauthorized access"}), 401

    try:
        # Connect to the PostgreSQL database
        conn = get_db_connection()
        cursor = conn.cursor()

        # Retrieve feedback data
        cursor.execute("SELECT feedback_text, rating FROM feedback;")
        feedback_data = cursor.fetchall()

        # Format feedback data as a list of dictionaries
        feedback_list = []
        for row in feedback_data:
            feedback_dict = {
                "feedback": row[0],  # feedback text
                "rating": row[1]     # rating
            }
            feedback_list.append(feedback_dict)

        # Close the cursor and connection
        cursor.close()
        conn.close()

        # Return the feedback as JSON
        return jsonify({"feedback": feedback_list})

    except Exception as e:
        app.logger.error(f"Error retrieving feedback: {str(e)}")
        return jsonify({"error": "Error retrieving feedback"}), 500

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
    if is_question_relevant(user_question):
        answer = get_llama3_response(user_question)
    else:
        answer = "Sorry, I can only discuss topics related to opioid addiction, misuse, prevention, or recovery."
    return jsonify({"answer": answer})

@app.route("/voice", methods=["POST"])
def voice_input():
    data = request.json
    user_question = data.get("question", "").strip()
    if not user_question:
        return jsonify({"answer": "Please ask a valid question."})
    if is_question_relevant(user_question):
        answer = get_llama3_response(user_question)
    else:
        answer = "Sorry, I can only discuss topics related to opioid addiction, misuse, prevention, or recovery."
    return jsonify({"answer": answer})

if __name__ == "__main__":
    app.run(debug=True)
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
