import os
import requests
import pdfplumber
from flask import Flask, request, render_template, jsonify, redirect, url_for
from flask_cors import CORS
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from collections import deque
import time
import asyncio
import aiohttp
from difflib import SequenceMatcher
import json
import threading

app = Flask(__name__, static_url_path='/static')
CORS(app)

LLAMA3_ENDPOINT = os.environ.get("LLAMA3_ENDPOINT", "https://openrouter.ai/api/v1/chat/completions").strip()
REN_API_KEY = os.environ.get("REN_API_KEY", "").strip()

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

# ==== PDF Chunk Indexing (Option B) ====
pdf_chunks = []

def chunk_pdf_text(text, chunk_size=800):
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]

def index_pdf_chunks(folder_path):
    global pdf_chunks
    for filename in os.listdir(folder_path):
        if filename.endswith('.pdf'):
            pdf_path = os.path.join(folder_path, filename)
            full_text = extract_text_from_pdf(pdf_path)
            chunks = chunk_pdf_text(full_text)
            pdf_chunks.extend(chunks)

index_pdf_chunks('pdfs')

def find_relevant_chunks(question, max_chunks=5):
    matches = []
    for chunk in pdf_chunks:
        score = SequenceMatcher(None, chunk.lower(), question.lower()).ratio()
        matches.append((score, chunk))
    matches.sort(reverse=True, key=lambda x: x[0])
    top_chunks = [chunk for score, chunk in matches[:max_chunks]]
    return '\n'.join(top_chunks)

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
    "semi-synthetic opioids", "neonatal abstinence syndrome", "NAS", "brands", "treatment programs"
]

# ==== URL Loading ====
def load_urls_from_file(file_path):
    urls = []
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            urls = [line.strip() for line in f if line.strip()]
    return urls

URLS_FILE_PATH = os.path.join(os.path.dirname(__file__), "data", "urls.txt")
URLS = load_urls_from_file(URLS_FILE_PATH)

# ==== Async Crawler ====
async def fetch_url(session, url, visited, base_domain, text_data, queue):
    if url in visited:
        return
    visited.add(url)

    try:
        async with session.get(url, timeout=10) as response:
            if response.status != 200:
                return

            soup = BeautifulSoup(await response.text(), "html.parser")

            page_text = soup.get_text().lower()
            if not any(keyword in page_text for keyword in relevant_topics):
                return

            for tag in soup.find_all(["p", "h1", "h2", "h3", "li"]):
                text_data.append(tag.get_text() + "\n")

            for link_tag in soup.find_all("a", href=True):
                href = link_tag['href']
                full_url = urljoin(url, href)
                link_domain = urlparse(full_url).netloc

                if base_domain in link_domain and full_url not in visited:
                    queue.append(full_url)

            await asyncio.sleep(0.5)
    except Exception as e:
        print(f"Error crawling {url}: {e}")

async def crawl_and_extract_text(base_urls, max_pages=5):
    visited = set()
    text_data = []
    queue = deque(base_urls)

    async with aiohttp.ClientSession() as session:
        tasks = []
        while queue and len(visited) < max_pages:
            url = queue.popleft()
            tasks.append(fetch_url(session, url, visited, urlparse(url).netloc, text_data, queue))
            if len(tasks) >= 10:
                await asyncio.gather(*tasks)
                tasks = []

        if tasks:
            await asyncio.gather(*tasks)

    return ''.join(text_data).strip()

# ==== Background Crawling ====
latest_crawled_text = ""

def background_crawl():
    global latest_crawled_text
    updated_urls = load_urls_from_file(URLS_FILE_PATH)
    latest_crawled_text = asyncio.run(crawl_and_extract_text(updated_urls, max_pages=5))
    app.logger.info("Background crawl finished.")

# Run crawl at startup
threading.Thread(target=background_crawl, daemon=True).start()

# ==== Relevance & Context ====
def is_question_relevant(question):
    if any(topic.lower() in question.lower() for topic in relevant_topics):
        return True
    if conversation_history:
        prev_interaction = conversation_history[-1]["content"]
        similarity_ratio = SequenceMatcher(None, prev_interaction.lower(), question.lower()).ratio()
        triggers = ["what else", "anything else", "other", "too", "more"]
        if similarity_ratio >= 0.5 or any(trigger in question.lower() for trigger in triggers):
            return True
    return False

def update_conversation_context(question):
    keywords = [keyword for keyword in relevant_topics if keyword in question.lower()]
    if keywords:
        conversation_context['last_topic'] = keywords[-1]

# ==== Llama 3 Call with Chunked PDF Support ====
def get_llama3_response(question):
    update_conversation_context(question)
    conversation_history.append({"role": "user", "content": question})

    relevant_pdf_chunks = find_relevant_chunks(question, max_chunks=5)
    combined_text = (relevant_pdf_chunks + "\n\n" + latest_crawled_text)[:5000]

    messages = [
        {"role": "system", "content": f"You are an expert in opioid education. Use this knowledge to answer questions: {combined_text}"}
    ] + conversation_history[-5:]

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
        conversation_history.append({"role": "assistant", "content": response_text})

        return response_text.replace("\n", "<br>")

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Llama 3 API error: {str(e)}")
        return f"ERROR: Failed to connect to Llama 3 instance. Details: {str(e)}"


# ==== Flask App Entrypoint ====
@app.route("/")
def index():
    return "Opioid Awareness Chatbot is running."

@app.route("/ask", methods=["POST"])
def ask():
    data = request.json
    user_question = data.get("question", "").strip()
    if not user_question:
        return jsonify({"answer": "Please ask a valid question."})
    if is_question_relevant(user_question):
        answer = get_llama3_response(user_question)
    else:
        answer = "Sorry, I can only answer questions related to opioids, addiction, overdose, or withdrawal."
    return jsonify({"answer": answer})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
