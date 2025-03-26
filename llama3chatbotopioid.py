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

# Store conversation history
conversation_history = []


def extract_text_from_pdf(pdf_paths):
    text = ""
    with pdfplumber.open(pdf_paths) as pdf:
        for page in pdf.pages:
            extracted_text = page.extract_text()
            if extracted_text:
                text += extracted_text + "\n"
    return text.strip()


import PyPDF2

pdf_text = ''


def read_pdfs_in_folder(folder_path):
    concatenated_text = ''
    for filename in os.listdir(folder_path):
        if filename.endswith('.pdf'):
            pdf_path = os.path.join(folder_path, filename)
            pdf_text = extract_text_from_pdf(pdf_path)
            concatenated_text += pdf_text + '\n\n'
    return concatenated_text


pdf_text = read_pdfs_in_folder('pdfs')

# List of relevant opioid-related keywords
relevant_topics = [
    "opioids", "addiction", "overdose", "withdrawal", "fentanyl", "heroin",
    "painkillers", "narcotics", "opioid crisis", "naloxone", "rehab", "opiates", "opium",
    "students", "teens", "adults", "substance abuse", "drugs", "tolerance", "help", "assistance",
    "support", "support for opioid addiction", "drug use", "email", "campus", "phone number",
    "BSU", "Bowie State University", "opioid use disorder", "opioid self-medication", "self medication",
    "number", "percentage", "symptoms", "signs"
]


def is_question_relevant(question):
    """Checks if the question contains opioid-related keywords"""
    return any(topic.lower() in question.lower() for topic in relevant_topics)


def get_llama3_response(question):
    """Sends a request to the OpenRouter Llama 3 API with API key authentication"""

    # Append user message to conversation history
    conversation_history.append({"role": "user", "content": question})

    # Keep only the last 5 messages to stay within token limits
    messages = [
        {"role": "system", "content": "You are an expert in opioid education. Answer user questions as clearly as possible."}
    ] + conversation_history[-5:]

    # Set up headers with API key
    headers = {
        "Authorization": f"Bearer {REN_API_KEY.strip()}",
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

        response.raise_for_status()  # Raise an error for HTTP errors

        data = response.json()
        response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "No response").replace("*", "")

        # Append AI response to conversation history
        conversation_history.append({"role": "assistant", "content": response_text})

        # Process and format the response for HTML and voice
        formatted_response = format_response(response_text)

        return formatted_response

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Llama 3 API error: {str(e)}")
        return f"ERROR: Failed to connect to Llama 3 instance. Details: {str(e)}"


def format_response(response_text, for_voice=False):
    """Formats the AI response to a structured, readable format"""
    formatted_text = response_text.strip()

    # Remove unwanted "brbr" or similar placeholders
    formatted_text = formatted_text.replace("brbr", "")

    # If it's for voice output, remove any <br> tags
    if for_voice:
        formatted_text = formatted_text.replace("<br>", " ")  # Replace <br> with a space for voice
    else:
        # Convert newlines to <br> for HTML display
        formatted_text = formatted_text.replace("\n", "<br>")

    return formatted_text


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
        response_text = get_llama3_response(user_question)
    else:
        response_text = "Sorry, I can only answer questions related to opioids, addiction, overdose, or withdrawal."

    # Clean the response for HTML and voice separately
    html_response = format_response(response_text, for_voice=False)  # For HTML rendering
    voice_response = format_response(response_text, for_voice=True)  # For voice output

    # Send the response back as JSON, including the voice and HTML versions
    return jsonify({"answer": html_response, "voice_answer": voice_response})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Use the port assigned by Render
    app.run(host="0.0.0.0", port=port)
