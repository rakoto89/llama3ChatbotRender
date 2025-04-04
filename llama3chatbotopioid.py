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
import json  # Added for saving feedback

app = Flask(__name__, static_url_path='/static')
CORS(app)

LLAMA3_ENDPOINT = os.environ.get("LLAMA3_ENDPOINT", "https://openrouter.ai/api/v1/chat/completions").strip()
REN_API_KEY = os.environ.get("REN_API_KEY", "").strip()

conversation_history = []
conversation_context = {}

# Extract text from PDFs
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

pdf_text = read_pdfs_in_folder('pdfs')

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

# Load URLs from file
def load_urls_from_file(file_path):
    urls = []
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            urls = [line.strip() for line in f if line.strip()]
    return urls

URLS_FILE_PATH = os.path.join(os.path.dirname(__file__), "data", "urls.txt")

URLS = load_urls_from_file(URLS_FILE_PATH)

# Crawl and extract text from URLs
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

# Update URLs and crawl
def update_urls_and_crawl():
    updated_urls = load_urls_from_file(URLS_FILE_PATH)
    return asyncio.run(crawl_and_extract_text(updated_urls, max_pages=5))

# Function to check if the question is relevant
def is_question_relevant(question):
    """Checks if the question is opioid-related or appears in known content."""
    pronouns = ['it', 'they', 'this', 'that']
    
    # Check against known opioid keywords
    if any(topic.lower() in question.lower() for topic in relevant_topics):
        return True

    # Check for follow-up pronouns
    for pronoun in pronouns:
        if pronoun in question.lower():
            if conversation_context.get("last_topic"):
                return True

    # Check similarity to previous question
    if conversation_history:
        prev_interaction = conversation_history[-1]["content"]
        similarity_ratio = SequenceMatcher(None, prev_interaction.lower(), question.lower()).ratio()

        follow_up_triggers = ["What more", "Anything else", "What other things", "Is there anything more", "Any other thing", "Does that", "Anybody", "Anyone in particular", "is it", "what about", "other", "anymore", "what else", "more", "different", "anything else", "anyone else", "others", "too"]
        if similarity_ratio >= 0.5 or any(trigger in question.lower() for trigger in follow_up_triggers):
            return True

    # NEW: Check if the question text exists in PDFs or website crawl
    combined_text = pdf_text.lower() + update_urls_and_crawl().lower()
    if question.lower() in combined_text:
        return True

    return False

# Update conversation context
def update_conversation_context(question):
    keywords = [keyword for keyword in relevant_topics if keyword in question.lower()]
    if keywords:
        conversation_context['last_topic'] = keywords[-1]

# Get response from Llama3 model based on relevant content (PDF + crawled websites)
def get_llama3_response(question):
    update_conversation_context(question)
    conversation_history.append({"role": "user", "content": question})

    # Combine PDF content and crawled website content
    combined_text = pdf_text + "\n\n" + update_urls_and_crawl()

    # Feed the AI model only with relevant content
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

        response.raise_for_status()
        data = response.json()
        response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "No response").replace("*", "")
        conversation_history.append({"role": "assistant", "content": response_text})

        return format_response(response_text)

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Llama 3 API error: {str(e)}")
        return f"ERROR: Failed to connect to Llama 3 instance. Details: {str(e)}"

# Format response text
def format_response(response_text, for_voice=False):
    formatted_text = response_text.strip().replace("brbr", "")
    return formatted_text.replace("<br>", " ").replace("\n", " ") if for_voice else formatted_text.replace("\n", "<br>")

# Flask routes and server setup
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

# Feedback handling routes
FEEDBACK_FILE = os.path.join(os.path.dirname(__file__), "data", "feedback.json")
FEEDBACK_SECRET_KEY = os.environ.get("FEEDBACK_SECRET_KEY", "cDehbkli9985112sdnyyyeraqdmmopquip112!!")

if os.path.exists(FEEDBACK_FILE):
    with open(FEEDBACK_FILE, "r") as f:
        try:
            feedback_list = json.load(f)
        except json.JSONDecodeError:
            feedback_list = []
else:
    feedback_list = []

@app.route("/feedback", methods=["GET", "POST"])
def feedback():
    if request.method == "POST":
        feedback_text = request.form.get("feedback")
        rating = request.form.get("rate")
        if feedback_text or rating:
            feedback_entry = {
                "feedback": feedback_text,
                "rating": rating
            }
            feedback_list.append(feedback_entry)
            with open(FEEDBACK_FILE, "w") as f:
                json.dump(feedback_list, f, indent=2)
            return render_template("feedback.html", success=True)

    return render_template("feedback.html", success=False)

@app.route("/view_feedback", methods=["GET"])
def view_feedback():
    key = request.args.get("key", "")
    if key != FEEDBACK_SECRET_KEY:
        return jsonify({"error": "Unauthorized access"}), 401
    return jsonify({"feedback": feedback_list})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Port setting included here
    app.run(host="0.0.0.0", port=port)
