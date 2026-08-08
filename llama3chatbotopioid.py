import os
import requests
import pdfplumber
import urllib.parse as urlparse
from flask import Flask, request, render_template, jsonify
from flask_cors import CORS
from googletrans import Translator
import re
from bs4 import BeautifulSoup
import psycopg2

print("STEP 1: Imports completed", flush=True)


# ============================================================
# DuckDuckGo fallback search
# ============================================================

def duckduckgo_search(query, max_results=3):
    try:
        url = f"https://duckduckgo.com/html/?q={urlparse.quote_plus(query)}"
        headers = {"User-Agent": "Mozilla/5.0"}

        res = requests.get(
            url,
            headers=headers,
            timeout=10
        )

        soup = BeautifulSoup(res.text, "html.parser")
        links = []

        for a in soup.select(".result__a[href]"):
            href = a["href"]

            match = re.search(
                r'u=(https?%3A%2F%2F[^&]+)',
                href
            )

            if match:
                decoded_url = urlparse.unquote(match.group(1))
            else:
                decoded_url = a["href"]

            decoded_url = decoded_url.strip().rstrip(">").rstrip("/.")

            if (
                decoded_url.startswith("http")
                and len(decoded_url.split("/")) > 3
            ):
                try:
                    response = requests.head(
                        decoded_url,
                        allow_redirects=True,
                        timeout=5
                    )

                    if response.status_code == 200:
                        links.append(decoded_url)

                except Exception:
                    continue

            if len(links) >= max_results:
                break

        return links

    except Exception as e:
        return [f"[DuckDuckGo search error: {e}]"]


# ============================================================
# Extract URLs from context
# ============================================================

def extract_urls_from_context(context_text):
    return set(
        re.findall(
            r'https?://[^\s<>"]+',
            context_text
        )
    )


# ============================================================
# Allowed domains
# ============================================================

ALLOWED_DOMAINS = [
    "nida.nih.gov",
    "samhsa.gov",
    "cdc.gov",
    "dea.gov",
    "nih.gov"
]


# ============================================================
# Filter response URLs
# ============================================================

def filter_response_urls(response_text, valid_urls):
    found_urls = re.findall(
        r'https?://[^\s<>"]+',
        response_text
    )

    for url in found_urls:

        if url in valid_urls:
            continue

        if any(
            domain in url
            for domain in ALLOWED_DOMAINS
        ):
            continue

        try:
            domain = urlparse.urlparse(url).netloc

            response_text = response_text.replace(
                url,
                domain
            )

        except Exception:

            response_text = response_text.replace(
                url,
                "trusted site"
            )

    return response_text


# ============================================================
# Flask application
# ============================================================

app = Flask(
    __name__,
    static_url_path="/static"
)

CORS(app)

print("STEP 2: Flask app created", flush=True)


# ============================================================
# Environment variables
# ============================================================

LLAMA3_ENDPOINT = os.environ.get(
    "LLAMA3_ENDPOINT",
    ""
)

REN_API_KEY = os.environ.get(
    "REN_API_KEY",
    ""
)

FEEDBACK_SECRET_KEY = os.environ.get(
    "FEEDBACK_SECRET_KEY",
    "test-key"
)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    ""
)


# ============================================================
# Database configuration
# ============================================================

url = urlparse.urlparse(DATABASE_URL)

db_config = {
    "dbname": url.path[1:],
    "user": url.username,
    "password": url.password,
    "host": url.hostname,
    "port": url.port
}


# ============================================================
# Conversation history and topic configuration
# ============================================================

conversation_history = []

irrelevant_topics = [
    "singer",
    "actor",
    "movie",
    "music",
    "pop culture",
    "celebrity",
    "weather",
    "food",
    "games"
]

relevant_topics = [
    "opioids",
    "addiction",
    "overdose",
    "pain",
    "treatment",
    "naloxone",
    "withdrawal",
    "rehab"
]


# ============================================================
# Normalize language codes
# ============================================================

def normalize_language_code(lang):
    zh_map = {
        "zh": "zh-CN",
        "zh-cn": "zh-CN",
        "zh-tw": "zh-TW"
    }

    return zh_map.get(
        lang.lower(),
        lang
    )


# ============================================================
# Check question relevance
# ============================================================

def is_question_relevant(question):
    q = question.lower()

    if any(
        topic in q
        for topic in relevant_topics
    ):
        return True

    if any(
        topic in q
        for topic in irrelevant_topics
    ):
        return False

    return False


# ============================================================
# Extract text from PDF
# ============================================================

def extract_text_from_pdf(pdf_path):
    text = ""

    with pdfplumber.open(pdf_path) as pdf:

        for page in pdf.pages:

            page_text = page.extract_text()

            if page_text:
                text += page_text + "\n"

    return text.strip()


# ============================================================
# Extract tables from PDF
# ============================================================

def extract_tables_from_pdf(pdf_path):
    table_text = ""

    with pdfplumber.open(pdf_path) as pdf:

        for page in pdf.pages:

            tables = page.extract_tables()

            for table in tables:

                for row in table:

                    table_text += (
                        " | ".join(
                            cell or ""
                            for cell in row
                        )
                        + "\n"
                    )

    return table_text.strip()


# ============================================================
# Read PDFs in folder
# ============================================================

def read_pdfs_in_folder(folder):
    output = ""

    for filename in os.listdir(folder):

        if filename.endswith(".pdf"):

            path = os.path.join(
                folder,
                filename
            )

            output += (
                extract_text_from_pdf(path)
                + "\n\n"
            )

            output += (
                extract_tables_from_pdf(path)
                + "\n\n"
            )

    return output


# ============================================================
# Load PDF knowledge
# ============================================================

print(
    "STEP 3: About to process PDFs",
    flush=True
)

pdf_folder = "pdfs"

combined_text = read_pdfs_in_folder(
    pdf_folder
)[:5000]

print(
    "STEP 4: PDF processing completed",
    flush=True
)


# ============================================================
# Get response from LLaMA
# ============================================================

def get_llama3_response(
    question,
    user_lang="en"
):

    user_lang = normalize_language_code(
        user_lang
    )

    translator = Translator()

    try:

        translated_question = translator.translate(
            question,
            dest="en"
        ).text

    except Exception:

        translated_question = question


    # --------------------------------------------------------
    # Reject unrelated questions
    # --------------------------------------------------------

    if not is_question_relevant(
        translated_question
    ):

        try:

            return translator.translate(
                "Sorry, I can only answer questions about opioids, addiction, overdose, or treatment.",
                dest=user_lang
            ).text

        except Exception:

            return (
                "Sorry, I can only answer questions "
                "about opioids, addiction, overdose, "
                "or treatment."
            )


    # --------------------------------------------------------
    # Add question to conversation history
    # --------------------------------------------------------

    conversation_history.append({
        "role": "user",
        "content": translated_question
    })


    # --------------------------------------------------------
    # System prompt
    # --------------------------------------------------------

    system_prompt = """
Only use PDF data to answer questions related to opioids.
Never use hallucinated or external info.
Do not respond to off-topic questions.
Always prioritize government sources like nida.nih.gov or samhsa.gov.
"""


    # --------------------------------------------------------
    # Messages sent to LLaMA
    # --------------------------------------------------------

    messages = [
        {
            "role": "system",
            "content":
                f"{system_prompt}\n\n"
                f"Context:\n{combined_text}"
        },

        *conversation_history[-5:]
    ]


    # --------------------------------------------------------
    # API headers
    # --------------------------------------------------------

    headers = {
        "Authorization":
            f"Bearer {REN_API_KEY}",

        "Content-Type":
            "application/json"
    }


    # --------------------------------------------------------
    # API payload
    # --------------------------------------------------------

    payload = {
        "model":
            "meta-llama/Llama-3-8b-chat-hf",

        "messages":
            messages
    }


    # --------------------------------------------------------
    # Call LLaMA endpoint
    # --------------------------------------------------------

    try:

        res = requests.post(
            LLAMA3_ENDPOINT,
            headers=headers,
            json=payload,
            timeout=60
        )

        res.raise_for_status()

        data = res.json()

        if data.get("choices"):

            content = (
                data["choices"][0]
                ["message"]
                ["content"]
                .strip()
            )

        else:

            content = "No valid response."


    except Exception:

        content = (
            "Error getting response from LLaMA."
        )


    # --------------------------------------------------------
    # Add response to conversation history
    # --------------------------------------------------------

    conversation_history.append({
        "role": "assistant",
        "content": content
    })


    # --------------------------------------------------------
    # Validate URLs
    # --------------------------------------------------------

    valid_urls = extract_urls_from_context(
        combined_text
    )

    filtered_content = filter_response_urls(
        content,
        valid_urls
    )


    # --------------------------------------------------------
    # DuckDuckGo fallback
    # --------------------------------------------------------

    if (
        "[URL removed" in filtered_content
        or
        "no valid source"
        in filtered_content.lower()
    ):

        fallback_links = duckduckgo_search(
            translated_question
        )

        fallback_sources = "\n".join(
            f"- {link}"
            for link in fallback_links
        )

        filtered_content += (
            "\n\n"
            "[Fallback sources via DuckDuckGo:]\n"
            f"{fallback_sources}"
        )


    # --------------------------------------------------------
    # Translate response
    # --------------------------------------------------------

    try:

        return translator.translate(
            filtered_content,
            dest=user_lang
        ).text

    except Exception:

        return filtered_content


# ============================================================
# Home page
# ============================================================

@app.route("/")
def index():

    return render_template(
        "index.html"
    )


# ============================================================
# Ask endpoint
# ============================================================

@app.route(
    "/ask",
    methods=["POST"]
)
def ask():

    data = request.get_json()

    question = data.get(
        "question",
        ""
    )

    lang = normalize_language_code(
        data.get(
            "language",
            "en"
        )
    )


    if not question:

        return jsonify({
            "error":
                "No question provided"
        }), 400


    answer = get_llama3_response(
        question,
        lang
    )


    return jsonify({
        "answer": answer
    })


# ============================================================
# Translation endpoint
# ============================================================

@app.route(
    "/translate",
    methods=["POST"]
)
def translate():

    data = request.json

    text = data.get(
        "text",
        ""
    )

    lang = normalize_language_code(
        data.get(
            "target_lang",
            "en"
        )
    )


    try:

        translation = Translator().translate(
            text,
            dest=lang
        )

        return jsonify({
            "translated_text":
                translation.text
        })


    except Exception as e:

        return jsonify({
            "error":
                f"Translation error: {str(e)}"
        }), 500


# ============================================================
# Feedback endpoint
# ============================================================

@app.route(
    "/feedback",
    methods=["GET", "POST"]
)
def feedback():

    if request.method == "POST":

        rating = request.form.get(
            "rate"
        )

        feedback_text = request.form.get(
            "feedback"
        )

        user_id = request.remote_addr


        try:

            conn = psycopg2.connect(
                **db_config
            )

            cur = conn.cursor()


            cur.execute(
                """
                INSERT INTO feedback
                (user_id, rating, comments)
                VALUES (%s, %s, %s);
                """,
                (
                    user_id,
                    int(rating),
                    feedback_text
                )
            )


            conn.commit()

            cur.close()

            conn.close()


            return render_template(
                "feedback.html",
                success=True
            )


        except Exception as e:

            app.logger.error(
                f"DB Error: {e}"
            )

            return render_template(
                "feedback.html",
                success=False
            )


    return render_template(
        "feedback.html",
        success=False
    )


# ============================================================
# Environment diagnostic endpoint
# ============================================================

@app.route("/env")
def check_env():

    return jsonify({

        "LLAMA3_ENDPOINT":
            LLAMA3_ENDPOINT,

        "REN_API_KEY_SET":
            bool(REN_API_KEY),

        "DATABASE_URL_SET":
            bool(DATABASE_URL)

    })


# ============================================================
# Startup diagnostic
# ============================================================

print(
    "STEP 5: Module initialization completed",
    flush=True
)


# ============================================================
# Flask startup
#
# When running locally:
#     python llama3chatbotopioid.py
#
# When running on Render:
#     Gunicorn imports the Flask "app" object above.
# ============================================================

if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            5000
        )
    )

    app.run(
        host="0.0.0.0",
        port=port
    )
