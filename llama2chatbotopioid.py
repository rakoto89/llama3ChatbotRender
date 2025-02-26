import os
import requests
import pdfplumber
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS  # Enable CORS for frontend compatibility

app = Flask(__name__, static_url_path='/static')
CORS(app)

# Load Llama 2 API endpoint and API key from environment variables
LLAMA2_ENDPOINT = os.environ.get("LLAMA2_ENDPOINT", "https://openrouter.ai/api/v1/chat/completions").strip()
LLAMA2_API_KEY = os.environ.get("LLAMA2_API_KEY", "").strip()  # Secure API key handling

# Path to the PDF document
PDF_PATH = os.path.join(os.path.dirname(__file__), "pdfs", "SAMHSA.pdf")

# Function to extract text from the PDF
def extract_text_from_pdf(pdf_path):
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            extracted_text = page.extract_text()
            if extracted_text:
                text += extracted_text + "\n"
    return text.strip()

# Extract the PDF text at startup
pdf_text = extract_text_from_pdf(PDF_PATH)

# List of relevant opioid-related keywords
relevant_topics = [
    "opioids", "addiction", "overdose", "withdrawal", "fentanyl", "heroin",
    "painkillers", "narcotics", "opioid crisis", "naloxone", "rehab"
]

def is_question_relevant(question):
    """Checks if the question contains opioid-related keywords"""
    return any(topic.lower() in question.lower() for topic in relevant_topics)

def get_llama2_response(question, context):
    """Sends a request to the OpenRouter Llama 2 API with API key authentication"""
    opioid_context = (
        "Assume the user is always asking about opioids or related topics like overdose, "
        "addiction, withdrawal, painkillers, fentanyl, heroin, and narcotics."
    )

    prompt = f"{opioid_context}\n\nHere is the document content:\n{context}\n\nQuestion: {question}"

    # Set up headers with API key
    headers = {
        "Authorization": f"Bearer {LLAMA2_API_KEY.strip()}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(
            LLAMA2_ENDPOINT,
            json={
                "model": "llama2opioidchatbot",  # Use the model name you set in OpenRouter
                "messages": [{"role": "user", "content": prompt}]
            },
            headers=headers,  # Pass API key
            timeout=10
        )
        response.raise_for_status()  # Raise an error for HTTP errors

        data = response.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content", "No response")

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Llama 2 API error: {str(e)}")  # Logs error in Render logs
        return f"ERROR: Failed to connect to Llama 2 instance. Details: {str(e)}"

@app.route("/")
def index():
    """Serves the chatbot HTML page with an introductory message"""
    intro_message = "Welcome to the AI Opioid Education Chatbot! Here you will learn all about opioids!"
    return render_template("index.html", intro_message=intro_message)

@app.route("/ask", methods=["POST"])
def ask():
    """Handles user questions and returns responses from Llama 2"""
    data = request.json  # Accept JSON input
    user_question = data.get("question", "").strip()

    if not user_question:
        return jsonify({"answer": "Please ask a valid question."})

    if is_question_relevant(user_question):
        answer = get_llama2_response(user_question, pdf_text)
    else:
        answer = "Sorry, I can only answer questions related to opioids, addiction, overdose, or withdrawal."

    return jsonify({"answer": answer})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Use the port assigned by Render
    app.run(host="0.0.0.0", port=port)
