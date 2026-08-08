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


# ============================================================
# FLASK APPLICATION
# ============================================================

app = Flask(__name__, static_url_path="/static")
CORS(app)


# ============================================================
# ENVIRONMENT VARIABLES
# ============================================================

LLAMA3_ENDPOINT = os.environ.get("LLAMA3_ENDPOINT", "")
REN_API_KEY = os.environ.get("REN_API_KEY", "")
FEEDBACK_SECRET_KEY = os.environ.get(
    "FEEDBACK_SECRET_KEY",
    "test-key"
)

DATABASE_URL = os.environ.get("DATABASE_URL", "")


# ============================================================
# DATABASE CONFIGURATION
# ============================================================

db_config = {}

if DATABASE_URL:
    try:
        parsed_db_url = urlparse.urlparse(DATABASE_URL)

        db_config = {
            "dbname": parsed_db_url.path[1:],
            "user": parsed_db_url.username,
            "password": parsed_db_url.password,
            "host": parsed_db_url.hostname,
            "port": parsed_db_url.port
        }

    except Exception as e:
        app.logger.error(f"Database configuration error: {e}")


# ============================================================
# DUCKDUCKGO FALLBACK SEARCH
# ============================================================

def duckduckgo_search(query, max_results=3):

    try:

        url = (
            f"https://duckduckgo.com/html/"
            f"?q={urlparse.quote_plus(query)}"
        )

        headers = {
            "User-Agent": "Mozilla/5.0"
        }

        res = requests.get(
            url,
            headers=headers,
            timeout=10
        )

        res.raise_for_status()

        soup = BeautifulSoup(
            res.text,
            "html.parser"
        )

        links = []

        for a in soup.select(".result__a[href]"):

            href = a["href"]

            match = re.search(
                r"u=(https?%3A%2F%2F[^&]+)",
                href
            )

            if match:

                decoded_url = urlparse.unquote(
                    match.group(1)
                )

            else:

                decoded_url = href

            decoded_url = (
                decoded_url
                .strip()
                .rstrip(">")
                .rstrip("/.")
            )

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

                except requests.RequestException:
                    continue

            if len(links) >= max_results:
                break

        return links

    except Exception as e:

        app.logger.error(
            f"DuckDuckGo search error: {e}"
        )

        return []


# ============================================================
# URL EXTRACTION
# ============================================================

def extract_urls_from_context(context_text):

    return set(
        re.findall(
            r'https?://[^\s<>"]+',
            context_text
        )
    )


# ============================================================
# TRUSTED GOVERNMENT DOMAINS
# ============================================================

ALLOWED_DOMAINS = [
    "nida.nih.gov",
    "samhsa.gov",
    "cdc.gov",
    "dea.gov",
    "nih.gov"
]


# ============================================================
# RESPONSE URL FILTER
# ============================================================

def filter_response_urls(
    response_text,
    valid_urls
):

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

            domain = (
                urlparse
                .urlparse(url)
                .netloc
            )

            response_text = (
                response_text
                .replace(
                    url,
                    domain
                )
            )

        except Exception:

            response_text = (
                response_text
                .replace(
                    url,
                    "trusted site"
                )
            )

    return response_text


# ============================================================
# CONVERSATION SETTINGS
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
    "opioid",
    "opioids",
    "addiction",
    "overdose",
    "pain",
    "treatment",
    "naloxone",
    "withdrawal",
    "rehab",
    "fentanyl",
    "heroin",
    "oxycodone",
    "hydrocodone",
    "morphine",
    "buprenorphine",
    "methadone"
]


# ============================================================
# LANGUAGE NORMALIZATION
# ============================================================

def normalize_language_code(lang):

    if not lang:
        return "en"

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
# QUESTION RELEVANCE
# ============================================================

def is_question_relevant(question):

    if not question:
        return False

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
# PDF TEXT EXTRACTION
# ============================================================

def extract_text_from_pdf(pdf_path):

    text = ""

    try:

        with pdfplumber.open(pdf_path) as pdf:

            for page in pdf.pages:

                try:

                    page_text = (
                        page.extract_text()
                    )

                    if page_text:
                        text += (
                            page_text + "\n"
                        )

                except Exception as e:

                    app.logger.warning(
                        f"Could not extract text "
                        f"from page in "
                        f"{pdf_path}: {e}"
                    )

    except Exception as e:

        app.logger.error(
            f"Could not open PDF "
            f"{pdf_path}: {e}"
        )

    return text.strip()


# ============================================================
# PDF TABLE EXTRACTION
# ============================================================

def extract_tables_from_pdf(pdf_path):

    table_text = ""

    try:

        with pdfplumber.open(pdf_path) as pdf:

            for page in pdf.pages:

                try:

                    tables = (
                        page.extract_tables()
                    )

                    for table in tables:

                        for row in table:

                            table_text += (
                                " | ".join(
                                    cell or ""
                                    for cell in row
                                )
                                + "\n"
                            )

                except Exception as e:

                    app.logger.warning(
                        f"Could not extract "
                        f"table from "
                        f"{pdf_path}: {e}"
                    )

    except Exception as e:

        app.logger.error(
            f"Could not open PDF "
            f"{pdf_path}: {e}"
        )

    return table_text.strip()


# ============================================================
# READ PDF FOLDER
# ============================================================

def read_pdfs_in_folder(folder):

    output = ""

    if not os.path.isdir(folder):

        app.logger.warning(
            f"PDF folder '{folder}' "
            f"does not exist."
        )

        return output

    try:

        filenames = os.listdir(folder)

    except Exception as e:

        app.logger.error(
            f"Unable to read PDF folder: {e}"
        )

        return output

    for filename in filenames:

        if filename.lower().endswith(".pdf"):

            path = os.path.join(
                folder,
                filename
            )

            app.logger.info(
                f"Loading PDF: {filename}"
            )

            text = extract_text_from_pdf(
                path
            )

            tables = extract_tables_from_pdf(
                path
            )

            if text:

                output += (
                    text + "\n\n"
                )

            if tables:

                output += (
                    tables + "\n\n"
                )

            # Prevent unnecessary processing
            # after enough context is collected.
            if len(output) >= 5000:
                break

    return output[:5000]


# ============================================================
# LAZY PDF LOADING
#
# IMPORTANT:
# PDFs are NOT processed while Gunicorn imports this file.
# This allows Render/Gunicorn to bind to PORT first.
# ============================================================

pdf_folder = "pdfs"

combined_text = None


def get_combined_text():

    global combined_text

    if combined_text is None:

        app.logger.info(
            "Loading opioid PDF context..."
        )

        combined_text = (
            read_pdfs_in_folder(
                pdf_folder
            )
        )

        app.logger.info(
            "PDF context loaded."
        )

    return combined_text


# ============================================================
# LLAMA RESPONSE
# ============================================================

def get_llama3_response(
    question,
    user_lang="en"
):

    user_lang = normalize_language_code(
        user_lang
    )

    translator = Translator()


    # --------------------------------------------------------
    # Translate incoming question to English
    # --------------------------------------------------------

    try:

        translated_question = (
            translator
            .translate(
                question,
                dest="en"
            )
            .text
        )

    except Exception as e:

        app.logger.warning(
            f"Question translation "
            f"failed: {e}"
        )

        translated_question = question


    # --------------------------------------------------------
    # Reject unrelated questions
    # --------------------------------------------------------

    if not is_question_relevant(
        translated_question
    ):

        message = (
            "Sorry, I can only answer "
            "questions about opioids, "
            "addiction, overdose, "
            "or treatment."
        )

        try:

            return (
                translator
                .translate(
                    message,
                    dest=user_lang
                )
                .text
            )

        except Exception:

            return message


    # --------------------------------------------------------
    # Load PDFs only when actually needed
    # --------------------------------------------------------

    context_text = get_combined_text()


    # --------------------------------------------------------
    # Conversation history
    # --------------------------------------------------------

    conversation_history.append(
        {
            "role": "user",
            "content":
                translated_question
        }
    )


    # --------------------------------------------------------
    # System prompt
    # --------------------------------------------------------

    system_prompt = (
        "Only use the provided PDF data "
        "to answer questions related to "
        "opioids. "
        "Never use hallucinated or "
        "unverified information. "
        "Do not respond to off-topic "
        "questions. "
        "Always prioritize reliable "
        "government sources such as "
        "NIDA, SAMHSA, CDC, NIH, and DEA."
    )


    messages = [

        {
            "role": "system",

            "content":
                f"{system_prompt}"
                f"\n\nContext:\n"
                f"{context_text}"
        },

        *conversation_history[-5:]

    ]


    # --------------------------------------------------------
    # Verify API configuration
    # --------------------------------------------------------

    if not LLAMA3_ENDPOINT:

        app.logger.error(
            "LLAMA3_ENDPOINT is not set."
        )

        return (
            "The chatbot AI service "
            "is not currently configured."
        )


    if not REN_API_KEY:

        app.logger.error(
            "REN_API_KEY is not set."
        )

        return (
            "The chatbot API key "
            "is not currently configured."
        )


    # --------------------------------------------------------
    # API request
    # --------------------------------------------------------

    headers = {

        "Authorization":
            f"Bearer {REN_API_KEY}",

        "Content-Type":
            "application/json"

    }


    payload = {

        "model":
            "meta-llama/Llama-3-8b-chat-hf",

        "messages":
            messages

    }


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

            content = (
                "No valid response "
                "was returned."
            )


    except requests.RequestException as e:

        app.logger.error(
            f"LLaMA request error: {e}"
        )

        content = (
            "Error getting response "
            "from LLaMA."
        )


    except Exception as e:

        app.logger.error(
            f"LLaMA response error: {e}"
        )

        content = (
            "Error processing response "
            "from LLaMA."
        )


    # --------------------------------------------------------
    # Save assistant response
    # --------------------------------------------------------

    conversation_history.append(
        {
            "role": "assistant",
            "content": content
        }
    )


    # --------------------------------------------------------
    # Validate URLs
    # --------------------------------------------------------

    valid_urls = (
        extract_urls_from_context(
            context_text
        )
    )


    filtered_content = (
        filter_response_urls(
            content,
            valid_urls
        )
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

        fallback_links = (
            duckduckgo_search(
                translated_question
            )
        )

        if fallback_links:

            fallback_sources = "\n".join(
                f"- {link}"
                for link
                in fallback_links
            )

            filtered_content += (
                "\n\n"
                "[Fallback sources via "
                "DuckDuckGo:]\n"
                f"{fallback_sources}"
            )


    # --------------------------------------------------------
    # Translate response
    # --------------------------------------------------------

    if user_lang.lower() in [
        "en",
        "en-us",
        "en-gb"
    ]:

        return filtered_content


    try:

        return (
            translator
            .translate(
                filtered_content,
                dest=user_lang
            )
            .text
        )

    except Exception as e:

        app.logger.warning(
            f"Response translation "
            f"failed: {e}"
        )

        return filtered_content


# ============================================================
# HOME PAGE
# ============================================================

@app.route("/")
def index():

    return render_template(
        "index.html"
    )


# ============================================================
# HEALTH CHECK
#
# Render can call this without triggering PDF loading.
# ============================================================

@app.route("/health")
def health():

    return jsonify(
        {
            "status": "ok"
        }
    ), 200


# ============================================================
# ASK CHATBOT
# ============================================================

@app.route(
    "/ask",
    methods=["POST"]
)
def ask():

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    question = data.get(
        "question",
        ""
    )


    lang = (
        normalize_language_code(
            data.get(
                "language",
                "en"
            )
        )
    )


    if not question:

        return jsonify(
            {
                "error":
                    "No question provided"
            }
        ), 400


    answer = (
        get_llama3_response(
            question,
            lang
        )
    )


    return jsonify(
        {
            "answer": answer
        }
    )


# ============================================================
# TRANSLATION ENDPOINT
# ============================================================

@app.route(
    "/translate",
    methods=["POST"]
)
def translate():

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    text = data.get(
        "text",
        ""
    )


    lang = (
        normalize_language_code(
            data.get(
                "target_lang",
                "en"
            )
        )
    )


    if not text:

        return jsonify(
            {
                "error":
                    "No text provided"
            }
        ), 400


    try:

        translation = (
            Translator()
            .translate(
                text,
                dest=lang
            )
        )


        return jsonify(
            {
                "translated_text":
                    translation.text
            }
        )


    except Exception as e:

        app.logger.error(
            f"Translation error: {e}"
        )


        return jsonify(
            {
                "error":
                    f"Translation error: "
                    f"{str(e)}"
            }
        ), 500


# ============================================================
# FEEDBACK ENDPOINT
# ============================================================

@app.route(
    "/feedback",
    methods=["GET", "POST"]
)
def feedback():

    if request.method == "POST":

        rating = (
            request.form.get(
                "rate"
            )
        )


        feedback_text = (
            request.form.get(
                "feedback"
            )
        )


        user_id = (
            request.remote_addr
        )


        if not DATABASE_URL:

            app.logger.error(
                "DATABASE_URL "
                "is not configured."
            )

            return render_template(
                "feedback.html",
                success=False
            )


        try:

            conn = psycopg2.connect(
                **db_config
            )


            cur = conn.cursor()


            cur.execute(

                """
                INSERT INTO feedback
                (
                    user_id,
                    rating,
                    comments
                )
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
# ENVIRONMENT CHECK
# ============================================================

@app.route("/env")
def check_env():

    return jsonify(
        {

            "LLAMA3_ENDPOINT_SET":
                bool(LLAMA3_ENDPOINT),

            "REN_API_KEY_SET":
                bool(REN_API_KEY),

            "DATABASE_URL_SET":
                bool(DATABASE_URL),

            "PDF_CONTEXT_LOADED":
                combined_text
                is not None

        }
    )


# ============================================================
# LOCAL DEVELOPMENT SERVER
#
# Render will normally use Gunicorn instead.
# ============================================================

if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            10000
        )
    )


    app.run(
        host="0.0.0.0",
        port=port
    )
