import os
import requests
import pdfplumber
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import logging

app = Flask(__name__, static_url_path='/static')
CORS(app)

LLAMA3_ENDPOINT = os.environ.get("LLAMA3_ENDPOINT", "https://openrouter.ai/api/v1/chat/completions").strip()
REN_API_KEY = os.environ.get("REN_API_KEY", "").strip()

conversation_history = []

# PDF extraction function
def extract_text_from_pdf(pdf_paths):
    text = ""
    with pdfplumber.open(pdf_paths) as pdf:
        for page in pdf.pages:
            extracted_text = page.extract_text()
            if extracted_text:
                text += extracted_text + "\n"
    return text.strip()

# Function to read PDFs in a folder
def read_pdfs_in_folder(folder_path):
    concatenated_text = ''
    for filename in os.listdir(folder_path):
        if filename.endswith('.pdf'):
            pdf_path = os.path.join(folder_path, filename)
            pdf_text = extract_text_from_pdf(pdf_path)
            concatenated_text += pdf_text + '\n\n'
    return concatenated_text

pdf_text = read_pdfs_in_folder('pdfs')

# Keywords related to opioids
relevant_topics = [
    "opioids", "addiction", "overdose", "withdrawal", "fentanyl", "heroin",
    "painkillers", "narcotics", "opioid crisis", "naloxone", "rehab", "opiates", "opium",
    "students", "teens", "adults", "substance abuse", "drugs", "tolerance", "help", "assistance",
    "support", "support for opioid addiction", "drug use", "email", "campus", "phone number",
    "BSU", "Bowie State University", "opioid use disorder", "opioid self-medication", "self medication",
    "number", "percentage", "symptoms", "signs", "opioid abuse", "opioid misuse", "physical dependence", "prescription",
    "medication-assistanted treatment", "medication assistanted treatment", "MAT", "opioid epidemic", "teen", 
    "dangers", "genetic", "environmental factors", "pain mangement", "socioeconomic factors", "consequences", "adult", "death",
    "semi-synthetic opioids", "neonatal abstinence syndrome", "NAS"
]

# Function to check if the question is related to opioids
def is_question_relevant(question):
    return any(topic.lower() in question.lower() for topic in relevant_topics)

# Function to get a response from Llama3 model
def get_llama3_response(question):
    conversation_history.append({"role": "user", "content": question})

    combined_text = pdf_text + "\n\n"  # Your PDF-based information
    messages = [
        {"role": "system", "content": f"You are an expert in opioid education. Use this knowledge to answer questions: {combined_text}"}
    ] + conversation_history[-5:]

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
        
        # Check for successful response
        response.raise_for_status()
        data = response.json()
        response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "No response").replace("*", "")
        conversation_history.append({"role": "assistant", "content": response_text})

        return format_response(response_text)

    except requests.exceptions.HTTPError as http_err:
        app.logger.error(f"HTTP error occurred: {http_err}")
        return jsonify({"answer": f"HTTP error occurred: {http_err}"})

    except requests.exceptions.RequestException as req_err:
        app.logger.error(f"Request error occurred: {req_err}")
        return jsonify({"answer": f"Request error occurred: {req_err}"})

    except Exception as e:
        app.logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"answer": f"Unexpected error: {str(e)}"})

# Format the response
def format_response(response_text, for_voice=False):
    formatted_text = response_text.strip().replace("brbr", "")
    return formatted_text.replace("<br>", " ").replace("\n", " ") if for_voice else formatted_text.replace("\n", "<br>")

@app.route("/ask", methods=["POST"])
def ask():
    data = request.json
    user_question = data.get("question", "").strip()

    if not user_question:
        return jsonify({"answer": "Please ask a valid question."})

    # Initial question check
    if not conversation_history:
        if not is_question_relevant(user_question):
            return jsonify({"answer": "Sorry, I can only answer questions related to opioids, addiction, overdose, or withdrawal."})

    # Follow-up question check (only relevant questions after an opioid-related question)
    if is_question_relevant(user_question) or (conversation_history and is_question_relevant(conversation_history[-1]["content"])):
        answer = get_llama3_response(user_question)
    else:
        return jsonify({"answer": "Sorry, I can only answer questions related to opioids, addiction, overdose, or withdrawal."})

    return jsonify({"answer": answer})

@app.route("/")
def index():
    intro_message = "🤖 Welcome to the Opioid Awareness Chatbot! Here you will learn all about opioids!"
    return render_template("index.html", intro_message=intro_message)

if __name__ == "__main__":
    app.run(debug=True)
