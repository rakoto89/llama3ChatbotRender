import os
import requests
import pdfplumber
import psycopg2
import urllib.parse as urlparse
import pandas as pd
from flask import Flask, request, render_template, jsonify
from flask_cors import CORS
from googletrans import Translator
import re
from bs4 import BeautifulSoup  # [ADDED for DuckDuckGo fallback]

# === [DuckDuckGo fallback search] ===
def duckduckgo_search(query, max_results=3):
    try:
        url = f"https://duckduckgo.com/html/?q={urlparse.quote_plus(query)}"
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")

        links = []
        for a in soup.select(".result__a[href]"):
            href = a["href"]

            # Extract and decode the actual URL
            match = re.search(r'u=(https?%3A%2F%2F[^&]+)', href)
            if match:
                decoded_url = urlparse.unquote(match.group(1))
            else:
                decoded_url = a["href"]

            # Clean up extra encoding artifacts
            decoded_url = decoded_url.strip().rstrip(">").rstrip("/.")

            # Ensure it's an actual page, not just a domain root
            if decoded_url.startswith("http") and len(decoded_url.split("/")) > 3:
                try:
                    # Optional: Check if page exists (HTTP 200 only)
                    response = requests.head(decoded_url, allow_redirects=True, timeout=5)
                    if response.status_code == 200:
                        links.append(decoded_url)
                except:
                    continue  # skip bad links

            if len(links) >= max_results:
                break

        return links
    except Exception as e:
        return [f"[DuckDuckGo search error: {e}]"]


# === [URL filtering] ===
def extract_urls_from_context(context_text):
    return set(re.findall(r'https?://[^\s<>"]+', context_text))

# === [ADDED: allow trusted fallback domains to show full URL] ===
ALLOWED_DOMAINS = ["nida.nih.gov", "samhsa.gov", "cdc.gov", "dea.gov", "nih.gov", "kff.org", "bowiestate.edu", "hopkinsmedicine.org", "medlineplus.gov", "www.naccho.org", "getsmartaboutdrugs.org"]

def filter_response_urls(response_text, valid_urls):
    found_urls = re.findall(r'https?://[^\s<>\"]+', response_text)
    for url in found_urls:
        if url in valid_urls:
            continue  # URL is in local context
        if any(domain in url for domain in ALLOWED_DOMAINS):
            continue  # Trusted fallback domain
        # Replace the full URL with just the domain name (e.g., "cdc.gov")
        try:
            domain = urlparse.urlparse(url).netloc
            response_text = response_text.replace(url, domain)
        except:
            response_text = response_text.replace(url, "trusted site")
    return response_text
# === [END ADDITION] ===

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
conversation_context = {}

irrelevant_topics = [
    "singer", "actor", "actress", "movie", "pop culture", "music", "sports", "literature", "state", "country", "continent",
    "nature", "celebrity", "tv show", "fashion", "entertainment", "politics", "school", "science", "cities",
    "history", "geography", "animal", "weather", "food", "recipes", "how to make food", "how to make drinks", "how to bake",
    "drink", "recipe", "finance", "education", "academia",
    "technology", "gaming", "tobacco", "alcohol", "Caffeine", "Nicotine", "Amphetamine", "physical education",
    "Methylphenidate", "Cocaine", "Methamphetamine", "Benzodiazepines", "Z-drugs", "LSD (Acid)", "art", 
    "THC", "CBD", "synthetic cannabinoids", "SSRIs", "Antipsychotics", "antihistamines", "NSAIDs",
    "Acetaminophen"
]

relevant_topics = [
    "opioids", "addiction", "overdose", "withdrawal", "fentanyl", "heroin", "chronic pain", "pain",
    "painkillers", "narcotics", "opioid crisis", "naloxone", "rehab", "opiates", "opium", "scientists", "control group",
    "students", "teens", "adults", "substance abuse", "drugs", "tolerance", "help", "assistance", "scientific",
    "support", "support for opioid addiction", "drug use", "email", "campus", "phone number", "clinician", "evidence",
    "BSU", "Bowie State University", "opioid use disorder", "opioid self-medication", "self medication", "clinical",
    "risk factors", "disparity", "racism", "bias", "addict", "marginalized","challenges", "long-term factors",
    "short-term factors", "consequences", "disease", "cancer", "treatment-seeking", "stigma", "stigmas", "opioid users", "communities",
    "number", "percentage", "symptoms", "signs", "opioid abuse", "opioid misuse", "physical dependence", "prescription",
    "medication-assisted treatment", "MAT", "OUD", "opioid epidemic", "teen", "dangers", "genetic", "ethical", "ethics",
    "environmental factors", "pain management", "consequences", "prevention", "doctor", "physician",
    "adult", "death", "semi-synthetic opioids", "neonatal abstinence syndrome", "NAS", "pharmacology", "pharmacological",
    "brands", "treatment programs", "medication", "young people", "peer pressure", "socioeconomic factors", "DO", "MD", 
    "income inequality", "healthcare disparities", "psychological", "psychology", "screen"
]

def normalize_language_code(lang):
    zh_map = {'zh': 'zh-CN', 'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW'}
    return zh_map.get(lang.lower(), lang)

def is_question_relevant(question):
    question_lower = question.lower().strip()
    if any(topic in question_lower for topic in relevant_topics):
        return True  # Allow if any relevant topic is present
    if any(topic in question_lower for topic in irrelevant_topics):
        return False  # Block only if irrelevant and no relevant topic found
    # Optionally check recent messages if needed
    return False

def extract_text_from_pdf(pdf_path):
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            if page.extract_text():
                text += page.extract_text() + "\n"
    return text.strip()

def extract_tables_from_pdf(pdf_path):
    table_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    table_text += " | ".join(cell or "" for cell in row) + "\n"
    return table_text.strip()

def read_pdfs_in_folder(folder):
    output = ""
    for filename in os.listdir(folder):
        if filename.endswith(".pdf"):
            path = os.path.join(folder, filename)
            output += extract_text_from_pdf(path) + "\n\n"
            output += extract_tables_from_pdf(path) + "\n\n"
    return output

def extract_all_tables_first(folder):
    tables_output = ""
    for filename in os.listdir(folder):
        if filename.endswith(".pdf"):
            path = os.path.join(folder, filename)
            tables = extract_tables_from_pdf(path)
            if tables:
                tables_output += f"=== Tables from {filename} ===\n{tables}\n\n"
    return tables_output

def read_excel_as_text(excel_path):
    try:
        excel_data = pd.read_excel(excel_path, header=1, sheet_name=None)
        output = f"=== Excel File: {os.path.basename(excel_path)} ===\n"
        for sheet, df in excel_data.items():
            output += f"\n--- Sheet: {sheet} ---\n"
            output += df.to_string(index=False) + "\n"
        return output.strip()
    except Exception as e:
        return f"Error reading Excel: {str(e)}"

pdf_folder = "pdfs"
excel_files = [
    "KFF_Opioid_Overdose_Deaths_2022.xlsx",
    "KFF_Opioid_Overdose_Deaths_by_Age_Group_2022.xlsx",
    "KFF_Opioid_Overdose_Deaths_by_Race_and_Ethnicity_2022.xlsx"
]

excel_text = ""
excel_df = None

for filename in excel_files:
    path = os.path.join(pdf_folder, filename)
    if os.path.exists(path):
        excel_text += read_excel_as_text(path) + "\n\n"
        df = pd.read_excel(path, header=1)
        if excel_df is None:
            excel_df = df
        else:
            excel_df = pd.concat([excel_df, df], ignore_index=True)

pdf_texts = read_pdfs_in_folder(pdf_folder)
all_table_text = extract_all_tables_first(pdf_folder)
combined_text = f"{pdf_texts}\n\n{all_table_text}\n\n{excel_text}"[:12000]

def get_llama3_response(question, user_lang="en"):
    user_lang = normalize_language_code(user_lang)
    translator = Translator()
    try:
        translated_question = translator.translate(question, dest="en").text
    except:
        translated_question = question

    if not is_question_relevant(translated_question):
        try:
            return translator.translate(
                "Sorry, I can only answer questions about opioids, addiction, overdose, or treatment.",
                dest=user_lang
            ).text
        except:
            return "Sorry, I can only answer questions about opioids, addiction, overdose, or treatment."

    conversation_history.append({"role": "user", "content": translated_question})

    system_prompt = """Prioritize answering questions using information from PDFs first, then from tables, and lastly from Excel or fallback web sources. 
Do not use fallback sources unless no answer is available in the PDF content.You are an educational chatbot specifically designed to provide accurate, factual, and age-appropriate
information about opioids, including opioid use and misuse, addiction, overdose, prevention, pain management, treatment, risk factors, 
and related topics. You are required to answer questions about why kids, teens, and adults use opioids, as this is educationally important 
to understand motivations and risks related to use and abuse. Your responses should only address inquiries directly related to opioid 
education and opioid awareness. Questions regarding opioid addiction, recovery, support, treatment, and withdrawal related to BSU 
(Bowie State University, campus) are allowed to be answered. You are strictly prohibited from discussing unrelated subjects such as:
celebrities, entertainment, politics, singer, actor, actress, movie, pop culture, music, sports, nature, tv show, fashion, history, 
geography, animal, weather, food, how to make food, how to make drinks, how to bake, recipe, finance, technology, gaming, tobacco, alcohol, caffeine, nicotine, amphetamine, 
methylphenidate, cocaine, methamphetamine, benzodiazepines, z-drugs, LSD (acid), THC, CBD, synthetic cannabinoids, SSRIs, 
antipsychotics, antihistamines, NSAIDs, acetaminophen, or general health. Don't discuss this AT ALL just say you cannot discuss this. You are 
strictly prohibited from answering these topics even as a follow-up under no circumstances are you permitted to answer these questions.
Even if users ask repeatedly, rephrase, or request outside links or resources (e.g., websites, news platforms, apps, tools, organizations, or events), 
you are strictly forbidden from suggesting any external resources not directly related to opioid education. You should use context from previous 
conversations to answer follow-up questions, but your responses must remain rooted solely in the educational data regarding opioids.
These restrictions apply to all user messages, including follow-ups, rephrased questions, or repeated attempts to bypass them.
You must answer complexities and consequences of opioid addiction, including its risk factors, challenges, and long-term impacts.
Always cite sources at the end of your answers. Only cite real sources from the provided context. Do not invent sources. Do not hallucinate sources.
Do not stop citations early. Complete the entire reference including titles and URLs. Only provide the URL if it is real and comes from the PDF or Excel context.
If a citation is long, wrap it across lines using line breaks or bullet points. If you cannot find the answer or a valid source from the provided context, 
you must search for a real and reliable source using DuckDuckGo instead. Prioritize official health or government sources such as nida.nih.gov, samhsa.gov, or cdc.gov. 
Always return a valid URL from a trusted site, even if it is not in the original documents."""

    messages = [
        {"role": "system", "content": f"{system_prompt}\n\nContext:\n{combined_text}"},
        *conversation_history[-5:]
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
        res = requests.post(LLAMA3_ENDPOINT, headers=headers, json=payload, timeout=60)
        res.raise_for_status()
        data = res.json()
        if "choices" in data and data["choices"]:
            message = data["choices"][0].get("message", {})
            content = message.get("content", "").strip()
            if not content:
                content = "I'm here to help, but the response was unexpectedly empty. Please try again."
        else:
            content = "I'm having trouble getting a valid response right now. Please try again or rephrase your question."
    except:
        content = "Our apologies, a technical error occurred. Please reach out to our system admin."

    conversation_history.append({"role": "assistant", "content": content})

    valid_urls = extract_urls_from_context(combined_text)
    filtered_content = filter_response_urls(content, valid_urls)

    if "[URL removed" in filtered_content or "no valid source" in filtered_content.lower():
        fallback_links = duckduckgo_search(translated_question)
        fallback_sources = "\n".join(f"- {link}" for link in fallback_links)
        filtered_content += f"\n\n[Fallback sources via DuckDuckGo:]\n{fallback_sources}"

    content = filtered_content

    try:
        return translator.translate(content, dest=user_lang).text
    except:
        return content

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    question = data.get("question", "")
    lang = normalize_language_code(data.get("language", "en"))
    if not question:
        return jsonify({"error": "No question provided"}), 400
    answer = get_llama3_response(question, lang)
    return jsonify({"answer": answer})

@app.route("/translate", methods=["POST"])
def translate():
    data = request.json
    text = data.get("text", "")
    lang = normalize_language_code(data.get("target_lang", "en"))
    try:
        translation = Translator().translate(text, dest=lang)
        return jsonify({"translated_text": translation.text})
    except Exception as e:
        return jsonify({"error": f"Translation error: {str(e)}"}), 500

@app.route("/feedback", methods=["GET", "POST"])
def feedback():
    if request.method == "POST":
        rating = request.form.get("rate")
        feedback_text = request.form.get("feedback")
        user_id = request.remote_addr
        try:
            conn = psycopg2.connect(**db_config)
            cur = conn.cursor()
            cur.execute("INSERT INTO feedback (user_id, rating, comments) VALUES (%s, %s, %s);",
                        (user_id, int(rating), feedback_text))
            conn.commit()
            cur.close()
            conn.close()
            return render_template("feedback.html", success=True)
        except Exception as e:
            app.logger.error(f"DB Error: {e}")
            return render_template("feedback.html", success=False)
    return render_template("feedback.html", success=False)

@app.route("/env")
def check_env():
    return jsonify({
        "LLAMA3_ENDPOINT": LLAMA3_ENDPOINT,
        "REN_API_KEY_SET": bool(REN_API_KEY),
        "DATABASE_URL_SET": bool(DATABASE_URL)
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
