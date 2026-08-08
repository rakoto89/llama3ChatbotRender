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
# FLASK APP
# ============================================================

app = Flask(__name__, static_url_path="/static")
CORS(app)


# ============================================================
# ENVIRONMENT VARIABLES
# ============================================================

LLAMA3_ENDPOINT = os.environ.get(
    "LLAMA3_ENDPOINT",
    "https://api.together.xyz/v1/chat/completions"
)

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
        db_url = urlparse.urlparse(DATABASE_URL)

        db_config = {
            "dbname": db_url.path[1:],
            "user": db_url.username,
            "password": db_url.password,
            "host": db_url.hostname,
            "port": db_url.port
        }

    except Exception as e:
        print("Database URL parsing error:", e)


# ============================================================
# DUCKDUCKGO FALLBACK SEARCH
# ============================================================

def duckduckgo_search(query, max_results=3):

    try:

        search_url = (
            f"https://duckduckgo.com/html/"
            f"?q={urlparse.quote_plus(query)}"
        )

        headers = {
            "User-Agent": "Mozilla/5.0"
        }

        res = requests.get(
            search_url,
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

                except Exception:
                    continue

            if len(links) >= max_results:
                break

        return links

    except Exception as e:

        print("DuckDuckGo search error:", e)

        return [
            f"[DuckDuckGo search error: {e}]"
        ]


# ============================================================
# EXTRACT URLS FROM PDF CONTEXT
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
# FILTER RESPONSE URLS
# ============================================================

def filter_response_urls(response_text, valid_urls):

    found_urls = re.findall(
        r'https?://[^\s<>"]+',
        response_text
    )

    for found_url in found_urls:

        if found_url in valid_urls:
            continue

        if any(
            domain in found_url
            for domain in ALLOWED_DOMAINS
        ):
            continue

        try:

            domain = urlparse.urlparse(
                found_url
            ).netloc

            response_text = response_text.replace(
                found_url,
                domain
            )

        except Exception:

            response_text = response_text.replace(
                found_url,
                "trusted site"
            )

    return response_text


# ============================================================
# CONVERSATION HISTORY
# ============================================================

conversation_history = []


# ============================================================
# RELEVANT / IRRELEVANT TOPICS
# ============================================================

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
    "codeine",
    "drug",
    "drugs"
]


# ============================================================
# NORMALIZE LANGUAGE CODE
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
# CHECK QUESTION RELEVANCE
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
# EXTRACT TEXT FROM PDF
# ============================================================

def extract_text_from_pdf(pdf_path):

    text = ""

    try:

        with pdfplumber.open(pdf_path) as pdf:

            for page in pdf.pages:

                page_text = page.extract_text()

                if page_text:
                    text += page_text + "\n"

    except Exception as e:

        print(
            f"Error reading PDF {pdf_path}:",
            e
        )

    return text.strip()


# ============================================================
# EXTRACT TABLES FROM PDF
# ============================================================

def extract_tables_from_pdf(pdf_path):

    table_text = ""

    try:

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

    except Exception as e:

        print(
            f"Error extracting tables from {pdf_path}:",
            e
        )

    return table_text.strip()


# ============================================================
# READ ALL PDF FILES
# ============================================================

def read_pdfs_in_folder(folder):

    output = ""

    if not os.path.exists(folder):

        print(
            f"PDF folder '{folder}' was not found."
        )

        return output

    try:

        for filename in os.listdir(folder):

            if filename.lower().endswith(".pdf"):

                path = os.path.join(
                    folder,
                    filename
                )

                print(
                    "Reading PDF:",
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

    except Exception as e:

        print(
            "Error reading PDF folder:",
            e
        )

    return output


# ============================================================
# LOAD PDF INFORMATION
# ============================================================

pdf_folder = "pdfs"

try:

    # Keep the amount of context relatively small while testing.
    combined_text = read_pdfs_in_folder(
        pdf_folder
    )[:5000]

    print(
        "PDF context characters loaded:",
        len(combined_text)
    )

except Exception as e:

    print(
        "PDF loading error:",
        e
    )

    combined_text = ""


# ============================================================
# TRANSLATION HELPER
# ============================================================

def translate_text(text, destination):

    if destination == "en":
        return text

    try:

        translator = Translator()

        translation = translator.translate(
            text,
            dest=destination
        )

        return translation.text

    except Exception as e:

        print(
            "Translation error:",
            e
        )

        return text


# ============================================================
# GET LLAMA RESPONSE
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
    # Translate incoming question into English
    # --------------------------------------------------------

    try:

        translated_question = (
            translator.translate(
                question,
                dest="en"
            ).text
        )

    except Exception as e:

        print(
            "Question translation error:",
            e
        )

        translated_question = question


    # --------------------------------------------------------
    # Reject unrelated questions
    # --------------------------------------------------------

    if not is_question_relevant(
        translated_question
    ):

        message = (
            "Sorry, I can only answer questions "
            "about opioids, addiction, overdose, "
            "or treatment."
        )

        if user_lang == "en":
            return message

        try:

            return translator.translate(
                message,
                dest=user_lang
            ).text

        except Exception:

            return message


    # --------------------------------------------------------
    # Add question to conversation history
    # --------------------------------------------------------

    conversation_history.append(
        {
            "role": "user",
            "content": translated_question
        }
    )


    # --------------------------------------------------------
    # SYSTEM PROMPT
    # --------------------------------------------------------

    system_prompt = """
You are an Opioid Awareness Chatbot.

Answer questions about opioids, opioid addiction,
overdose, naloxone, withdrawal, pain management,
treatment, rehabilitation, and related opioid topics.

Use the supplied PDF context as your primary source.

Do not invent facts.

If the context contains relevant information, use it
to answer the question.

Keep answers clear, educational, and easy to understand.

Do not answer unrelated questions.

Prioritize reliable government health information,
including sources such as NIDA, NIH, SAMHSA, CDC,
and DEA.
"""


    # --------------------------------------------------------
    # BUILD MESSAGES
    # --------------------------------------------------------

    messages = [
        {
            "role": "system",
            "content":
                f"{system_prompt}\n\n"
                f"PDF CONTEXT:\n"
                f"{combined_text}"
        },
        *conversation_history[-5:]
    ]


    # --------------------------------------------------------
    # TOGETHER AI HEADERS
    # --------------------------------------------------------

    headers = {
        "Authorization":
            f"Bearer {REN_API_KEY}",

        "Content-Type":
            "application/json"
    }


    # --------------------------------------------------------
    # TOGETHER AI PAYLOAD
    # --------------------------------------------------------

    payload = {

        "model":
            "meta-llama/llama-3.1-8b-instruct:free",

        "messages":
            messages,

        "max_tokens":
            500,

        "temperature":
            0.3
    }


    # --------------------------------------------------------
    # DEBUG INFORMATION
    # --------------------------------------------------------

    print(
        "======================================"
    )

    print(
        "Sending request to Together AI"
    )

    print(
        "Endpoint:",
        LLAMA3_ENDPOINT
    )

    print(
        "API key present:",
        bool(REN_API_KEY)
    )

    print(
        "Model:",
        payload["model"]
    )

    print(
        "Question:",
        translated_question
    )

    print(
        "PDF context length:",
        len(combined_text)
    )

    print(
        "======================================"
    )


    # --------------------------------------------------------
    # CALL TOGETHER AI
    # --------------------------------------------------------

    try:

        res = requests.post(
            LLAMA3_ENDPOINT,
            headers=headers,
            json=payload,
            timeout=60
        )

        # VERY IMPORTANT:
        # These lines show us Together's actual error.

        print(
            "Together status:",
            res.status_code
        )

        print(
            "Together response:",
            res.text
        )

        res.raise_for_status()

        data = res.json()


        # ----------------------------------------------------
        # READ RESPONSE
        # ----------------------------------------------------

        if (
            data.get("choices")
            and len(data["choices"]) > 0
        ):

            content = (
                data["choices"][0]
                ["message"]
                ["content"]
                .strip()
            )

        else:

            print(
                "No choices returned:",
                data
            )

            content = (
                "No valid response was returned "
                "from the AI service."
            )


    except requests.exceptions.Timeout:

        print(
            "Together AI request timed out."
        )

        content = (
            "The AI service took too long to respond. "
            "Please try again."
        )


    except requests.exceptions.HTTPError as e:

        print(
            "LLaMA HTTP error:",
            str(e)
        )

        try:

            print(
                "Together error body:",
                res.text
            )

        except Exception:
            pass

        content = (
            "Error getting response from LLaMA."
        )


    except requests.exceptions.RequestException as e:

        print(
            "LLaMA request error:",
            str(e)
        )

        content = (
            "Error connecting to the LLaMA service."
        )


    except Exception as e:

        print(
            "Unexpected LLaMA error:",
            repr(e)
        )

        content = (
            "Error getting response from LLaMA."
        )


    # --------------------------------------------------------
    # SAVE ASSISTANT RESPONSE
    # --------------------------------------------------------

    conversation_history.append(
        {
            "role": "assistant",
            "content": content
        }
    )


    # --------------------------------------------------------
    # FILTER URLS
    # --------------------------------------------------------

    valid_urls = extract_urls_from_context(
        combined_text
    )

    filtered_content = filter_response_urls(
        content,
        valid_urls
    )


    # --------------------------------------------------------
    # FALLBACK SEARCH
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
    # TRANSLATE ANSWER BACK TO USER LANGUAGE
    # --------------------------------------------------------

    if user_lang == "en":
        return filtered_content

    try:

        return translator.translate(
            filtered_content,
            dest=user_lang
        ).text

    except Exception as e:

        print(
            "Response translation error:",
            e
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
# ASK ENDPOINT
# ============================================================

@app.route(
    "/ask",
    methods=["POST"]
)
def ask():

    data = request.get_json(
        silent=True
    ) or {}

    question = data.get(
        "question",
        ""
    ).strip()

    lang = normalize_language_code(
        data.get(
            "language",
            "en"
        )
    )

    if not question:

        return jsonify(
            {
                "error":
                    "No question provided"
            }
        ), 400


    answer = get_llama3_response(
        question,
        lang
    )


    return jsonify(
        {
            "answer":
                answer
        }
    )


# ============================================================
# TRANSLATE ENDPOINT
# ============================================================

@app.route(
    "/translate",
    methods=["POST"]
)
def translate():

    data = request.get_json(
        silent=True
    ) or {}

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

        return jsonify(
            {
                "translated_text":
                    translation.text
            }
        )

    except Exception as e:

        print(
            "Translation endpoint error:",
            e
        )

        return jsonify(
            {
                "error":
                    f"Translation error: {str(e)}"
            }
        ), 500


# ============================================================
# FEEDBACK PAGE
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


        # ----------------------------------------------------
        # DATABASE URL NOT CONFIGURED
        # ----------------------------------------------------

        if not DATABASE_URL:

            app.logger.error(
                "DATABASE_URL is not configured."
            )

            return render_template(
                "feedback.html",
                success=False
            )


        # ----------------------------------------------------
        # SAVE FEEDBACK
        # ----------------------------------------------------

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
# ENVIRONMENT CHECK
# ============================================================

@app.route("/env")
def check_env():

    return jsonify(
        {
            "LLAMA3_ENDPOINT":
                LLAMA3_ENDPOINT,

            "REN_API_KEY_SET":
                bool(REN_API_KEY),

            "DATABASE_URL_SET":
                bool(DATABASE_URL),

            "PDF_CONTEXT_LENGTH":
                len(combined_text)
        }
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health")
def health():

    return jsonify(
        {
            "status": "ok"
        }
    ), 200


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            10000
        )
    )

    print(
        f"Starting Flask application on port {port}"
    )

    app.run(
        host="0.0.0.0",
        port=port
    )
