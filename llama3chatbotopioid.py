import os
import requests
import pdfplumber
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS  # Enable CORS for frontend compatibility

app = Flask(__name__, static_url_path='/static')
CORS(app)

# Load Llama 3 API endpoint and API key from environment variables
LLAMA3_ENDPOINT = os.environ.get("LLAMA3_ENDPOINT", "https://openrouter.ai/api/v1/chat/completions").strip()
REN_API_KEY = os.environ.get("REN_API_KEY", "").strip()  # Secure API key handling

def extract_text_from_pdf(pdf_paths):
    text = ""
    # for pdf_path in pdf_paths:
    with pdfplumber.open(pdf_paths) as pdf:
        for page in pdf.pages:
            extracted_text = page.extract_text()
            if extracted_text:
                text += extracted_text + "\n"
    return text.strip()
import PyPDF2
pdf_text=''
def read_pdfs_in_folder(folder_path):
    # Navigate through the folder
    concatenated_text = ''
    for filename in os.listdir(folder_path):
        print(filename)
        if filename.endswith('.pdf'):
            pdf_path = os.path.join(folder_path, filename)
            print(pdf_path)
            pdf_text=extract_text_from_pdf(pdf_path)
            #print(pdf_text)
            concatenated_text += pdf_text + '\n\n'
    return concatenated_text
pdf_text=read_pdfs_in_folder('pdfs')
print(pdf_text)

# List of relevant opioid-related keywords
relevant_topics = [
    "opioids", "addiction", "overdose", "withdrawal", "fentanyl", "heroin", 
    "painkillers", "narcotics", "opioid crisis", "naloxone", "rehab", "opiates", "opium", "substance abuse", "drugs", "tolerance", "opiates", "help", "assistance", "support", "support for opioid addiction", "support for opioid" "opium", "opiate", "drug" "email", "campus", "phone number", "BSU", "Bowie State University", "opioid", "use", "disorder", "opioid use", "opioid disorder", "opioid usage", "usage", "taking opioids", "taking", "recreational use", "opioid dependence", "opioid self-medication", "self medication"
]

def is_question_relevant(question):
    """Checks if the question contains opioid-related keywords"""
    return any(topic.lower() in question.lower() for topic in relevant_topics)

def get_llama3_response(question, context):
    """Sends a request to the OpenRouter Llama 3 API with API key authentication"""
    opioid_context = (
        "You are an expert in opioid education. Answer the user's question as clearly "
        "as possible using the document as reference, but NEVER mention the document, "
        "the source, or phrases like 'Based on the document' or 'According to the document'. "
        "Just provide a direct answer, as if you already knew the information."
    )

    prompt = f"Answer the question concisely and naturally without mentioning the document or saying 'Based on the document', 'provided text'. \n\nHere is the document content:\n{context}\n\nQuestion: {question}"

    # Set up headers with API key
    headers = {
        "Authorization": f"Bearer {REN_API_KEY.strip()}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(
            LLAMA3_ENDPOINT,
            json={
                "model": "meta-llama/llama-3.1-8b-instruct:free",  # Use the model name set in OpenRouter
                "messages": [{"role": "user", "content": prompt}]
            },
            headers=headers,  # Pass API key
            timeout=30
        )

        response.raise_for_status()  # Raise an error for HTTP errors

        data = response.json()
        response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "No response").replace("*", "")

        # List of unwanted phrases to remove
        unwanted_phrases = ["Based on the document", "According to the document", "From the document"]

        # Remove unwanted phrases from the response
        for phrase in unwanted_phrases:
            response_text = response_text.replace(phrase, "").strip()

        return response_text

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Llama 3 API error: {str(e)}")  # Logs error in Render logs
        return f"ERROR: Failed to connect to Llama 3 instance. Details: {str(e)}"

@app.route("/")
def index():
    """Serves the chatbot HTML page with an introductory message"""
    intro_message = "🤖 Welcome to the Opioid Awareness Chatbot! Here you will learn all about opioids!"
    return render_template("index.html", intro_message=intro_message)

@app.route("/ask", methods=["POST"])
def ask():
    """Handles user questions and returns responses from Llama 3"""
    data = request.json  # Accept JSON input
    user_question = data.get("question", "").strip()

    if not user_question:
        return jsonify({"answer": "Please ask a valid question."})

    if is_question_relevant(user_question):
        answer = get_llama3_response(user_question, pdf_text)
    else:
        answer = "Sorry, I can only answer questions related to opioids, addiction, overdose, or withdrawal."

    return jsonify({"answer": answer})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Use the port assigned by Render
    app.run(host="0.0.0.0", port=port)
