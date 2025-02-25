from flask import Flask, request, jsonify, render_template
import os
import pdfplumber
import requests
from flask_cors import CORS  # Import CORS for cross-origin requests

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS

# Set the path to the PDF containing opioid information
PDF_PATH = os.path.join(os.path.dirname(__file__), "pdfs", "SAMHSA.pdf")

# Function to extract text from PDF
def extract_text_from_pdf(pdf_path):
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            extracted_text = page.extract_text()
            if extracted_text:
                text += extracted_text + "\n"
    return text.strip()

# Extract text from the PDF when the app starts
pdf_text = extract_text_from_pdf(PDF_PATH)

# Relevant opioid-related topics
relevant_topics = [
    "opioids", "addiction", "overdose", "withdrawal", "fentanyl", "heroin",
    "painkillers", "narcotics", "opioid crisis", "naloxone", "rehab"
]

def is_question_relevant(question):
    """ Checks if the question contains opioid-related keywords """
    return any(topic.lower() in question.lower() for topic in relevant_topics)

def get_llama2_response(question, context):
    """ Sends a request to a local Llama 2 instance running via Ollama """
    opioid_context = (
        "Assume the user is always asking about opioids or related topics like overdose, "
        "addiction, withdrawal, painkillers, fentanyl, heroin, and narcotics."
    )

    prompt = f"{opioid_context}\n\nHere is the document content:\n{context}\n\nQuestion: {question}"

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",  # Ollama default endpoint
            json={
                "model": "llama2",
                "prompt": prompt,
                "max_tokens": 2048,
                "temperature": 0.7
            }
        )
        response.raise_for_status()
        data = response.json()
        return data.get("response", "Sorry, I couldn't generate a valid response.")
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Llama 2 API call failed: {str(e)}")
        return "ERROR: Failed to connect to Llama 2 instance."

@app.route("/")
def index():
    """ Serves the chatbot HTML page with an introductory message """
    intro_message = "Welcome to the AI Opioid Education Chatbot! Here you will learn all about opioids!"
    return render_template("index.html", intro_message=intro_message)

@app.route("/ask", methods=["POST"])
def ask():
    """ Handles user questions and returns responses from Llama 2 """
    user_question = request.form.get("question", "").strip()

    if not user_question:
        return jsonify({"answer": "Please ask a valid question."})

    if is_question_relevant(user_question):
        answer = get_llama2_response(user_question, pdf_text)
    else:
        answer = "Sorry, I can only answer questions related to opioids, addiction, overdose, or withdrawal."

    return jsonify({"answer": answer})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Port is set by the cloud provider
    app.run(host="0.0.0.0", port=port)
