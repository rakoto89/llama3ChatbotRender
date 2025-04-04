from flask import Flask, render_template, request, jsonify
import requests
import os
from PyPDF2 import PdfReader
from crawler import update_urls_and_crawl

app = Flask(__name__)
REN_API_KEY = os.getenv("REN_API_KEY")  # Make sure this is set in your environment

# Summarization helper function
def summarize_text(text, max_chars):
    text = text.strip().replace("\n", " ")
    return text[:max_chars] + "..." if len(text) > max_chars else text

def get_llama3_response(user_question):
    # Load and summarize PDF content
    pdf_folder = "pdfs"
    pdf_text = ""
    for filename in os.listdir(pdf_folder):
        if filename.endswith(".pdf"):
            pdf_path = os.path.join(pdf_folder, filename)
            with open(pdf_path, "rb") as f:
                pdf_reader = PdfReader(f)
                for page in pdf_reader.pages:
                    pdf_text += page.extract_text()

    # Limit to first 2000 characters to avoid token overload
    pdf_summary = summarize_text(pdf_text, 2000)

    # Summarize crawled site content
    site_text = update_urls_and_crawl()
    site_summary = summarize_text(site_text, 1000)

    combined_text = pdf_summary + "\n\n" + site_summary

    headers = {
        "Authorization": f"Bearer {REN_API_KEY}",
        "Content-Type": "application/json",
    }

    data = {
        "model": "meta-llama/llama-3.1-8b-instruct:free",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful health chatbot trained on opioid safety, awareness, and addiction recovery. Base your answers only on the context provided."
            },
            {
                "role": "user",
                "content": f"Context:\n{combined_text}\n\nQuestion:\n{user_question}"
            },
        ],
    }

    response = requests.post("https://api.runpod.ai/v2/chat/completions", headers=headers, json=data)
    response.raise_for_status()
    data = response.json()
    response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "No response")

    return response_text

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/ask", methods=["POST"])
def ask():
    user_message = request.json.get("message")
    response_text = get_llama3_response(user_message)
    return jsonify({"message": response_text})

if __name__ == "__main__":
    app.run(debug=True)
