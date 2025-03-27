import os
import requests
import pdfplumber
import asyncio
import aiohttp
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from collections import deque
import time

app = Flask(__name__, static_url_path='/static')
CORS(app)

# Load Llama 3 API endpoint and API key from environment variables
LLAMA3_ENDPOINT = os.environ.get("LLAMA3_ENDPOINT", "https://openrouter.ai/api/v1/chat/completions").strip()
REN_API_KEY = os.environ.get("REN_API_KEY", "").strip()

# Store conversation history
conversation_history = []


# ============================
# PDF Text Extraction
# ============================
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


# Pre-load PDF text once at startup
pdf_text = read_pdfs_in_folder('pdfs')


# ============================
# URL Crawling and Text Extraction
# ============================
def load_urls_from_file(file_path):
    urls = []
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            urls = [line.strip() for line in f if line.strip()]
    return urls


URLS_FILE_PATH = os.path.join(os.path.dirname(__file__), "data", "urls.txt")
URLS = load_urls_from_file(URLS_FILE_PATH)


def crawl_and_extract_text(base_urls, max_pages=20):
    visited = set()
    text_data = ""

    for base_url in base_urls:
        queue = deque([base_url])
        base_domain = urlparse(base_url).netloc
        pages_crawled = 0

        while queue and pages_crawled < max_pages:
            url = queue.popleft()

            if url in visited:
                continue

            visited.add(url)

            try:
                response = requests.get(url, timeout=10)
                if response.status_code != 200:
                    continue

                soup = BeautifulSoup(response.text, "html.parser")
                pages_crawled += 1

                for tag in soup.find_all(["p", "h1", "h2", "h3", "li"]):
                    text_data += tag.get_text().strip() + "\n"

                for link_tag in soup.find_all("a", href=True):
                    href = link_tag['href']
                    full_url = urljoin(url, href)
                    link_domain = urlparse(full_url).netloc

                    if base_domain == link_domain and full_url not in visited:
                        queue.append(full_url)

                time.sleep(0.5)

            except Exception as e:
                print(f"Error crawling {url}: {e}")

    return text_data.strip()


# Pre-crawl and cache results at startup
def update_urls_and_crawl():
    updated_urls = load_urls_from_file(URLS_FILE_PATH)
    return crawl_and_extract_text(updated_urls, max_pages=10)


# ============================
# Check Relevance of Questions
# ============================
relevant_topics = [
    "opioids", "addiction", "overdose", "withdrawal", "fentanyl", "heroin",
    "painkillers", "narcotics", "opioid crisis", "naloxone", "rehab", "opiates", "opium",
    "students", "teens", "adults", "substance abuse", "drugs", "tolerance", "help", "assistance",
    "support", "support for opioid addiction", "drug use", "email", "campus", "phone number",
    "BSU", "Bowie State University", "opioid use disorder", "opioid self-medication", "self medication",
    "number", "percentage", "symptoms", "signs"
]


def is_question_relevant(question):
    return any(topic.lower() in question.lower() for topic in relevant_topics)


# ============================
# Async API Call to Llama 3
# ============================
async def get_llama3_response_async(question):
    conversation_history.append({"role": "user", "content": question})

    combined_text = pdf_text + "\n\n" + update_urls_and_crawl()

    messages = [
        {"role": "system", "content": f"You are an expert in opioid education. Use this knowledge to answer questions: {combined_text}"}
    ] + conversation_history[-5:]

    headers = {
        "Authorization": f"Bearer {REN_API_KEY}",
        "Content-Type": "application/json"
    }

    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                LLAMA3_ENDPOINT,
                json={
                    "model": "meta-llama/llama-3.1-8b-instruct:free",
                    "messages": messages
                },
                headers=headers,
                timeout=20
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "No response").replace("*", "")
                    conversation_history.append({"role": "assistant", "content": response_text})
                    return format_response(response_text)
                else:
                    return f"ERROR: API returned status {response.status}"

        except Exception as e:
            app.logger.error(f"Llama 3 API error: {str(e)}")
            return f"ERROR: Failed to connect to Llama 3 instance. Details: {str(e)}"


# Wrapper to run async function synchronously
def get_llama3_response(question):
    # Run the async version and wait for result
    return asyncio.run(get_llama3_response_async(question))


# ============================
# Format Bot Response
# ============================
def format_response(response_text, for_voice=False):
    formatted_text = response_text.strip().replace("brbr", "")
    return formatted_text.replace("<br>", " ").replace("\n", " ") if for_voice else formatted_text.replace("\n", "<br>")


# ============================
# Flask Routes
# ============================
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


# ============================
# Run Flask Application
# ============================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
