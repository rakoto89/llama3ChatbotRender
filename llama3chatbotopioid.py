
import os
import re
import requests
import pdfplumber
import psycopg2
import urllib.parse as urlparse
import pandas as pd
from flask import Flask, request, render_template, jsonify
from flask_cors import CORS
from googletrans import Translator
from bs4 import BeautifulSoup

# === [DuckDuckGo fallback search] ===
def duckduckgo_search(query):
    try:
        url = f"https://duckduckgo.com/html/?q={urlparse.quote_plus(query)}"
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")
        links = [a['href'] for a in soup.select(".result__a[href]")]
        return links[:3]
    except Exception as e:
        return [f"[DuckDuckGo search error: {e}]"]

# === [URL filtering] ===
def extract_urls_from_context(context_text):
    return set(re.findall(r'https?://[^\s<>"]+', context_text))

ALLOWED_DOMAINS = ["nida.nih.gov", "samhsa.gov", "cdc.gov", "dea.gov", "nih.gov"]

def filter_response_urls(response_text, valid_urls, query=None):
    found_urls = re.findall(r'https?://[^\s<>"]+', response_text)
    for url in found_urls:
        if url in valid_urls:
            continue
        if any(domain in url for domain in ALLOWED_DOMAINS):
            continue
        # Replace fake URL with fallback
        if query:
            fallback_links = duckduckgo_search(query)
            if fallback_links:
                response_text = response_text.replace(url, fallback_links[0])
            else:
                response_text = response_text.replace(url, "[No valid source found]")
        else:
            response_text = response_text.replace(url, "[URL removed: not found in source]")
    return response_text

# === Flask App Setup ===
app = Flask(__name__, static_url_path='/static')
CORS(app)

LLAMA3_ENDPOINT = os.environ.get("LLAMA3_ENDPOINT", "https://api.together.xyz/v1/chat/completions").strip()
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

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    question = data.get("question", "")
    if not question:
        return jsonify({"error": "No question provided"}), 400

    context = "Opioids are substances that act on opioid receptors to produce morphine-like effects. Commonly used for pain relief..."
    valid_urls = extract_urls_from_context(context)

    prompt = f"""
    You are an educational chatbot specifically focused on opioids and opioid awareness. 
    You must cite only real sources. Do not make up URLs. If no URL is available from the documents, 
    you are required to search DuckDuckGo and retrieve a valid URL from one of these trusted domains:
    nida.nih.gov, samhsa.gov, cdc.gov, dea.gov, or nih.gov.
    """

    messages = [
        {"role": "system", "content": f"{prompt}

Context:
{context}"},
        {"role": "user", "content": question}
    ]

    headers = {
        "Authorization": f"Bearer {REN_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "meta-llama/Llama-3-8b-chat-hf",
        "messages": messages
    }

    try:
        res = requests.post(LLAMA3_ENDPOINT, headers=headers, json=payload)
        res.raise_for_status()
        data = res.json()
        answer = data["choices"][0]["message"]["content"]
    except:
        answer = "Error getting response from model."

    final_answer = filter_response_urls(answer, valid_urls, query=question)
    return jsonify({"answer": final_answer})

@app.route("/")
def index():
    return "Chatbot is running."

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
