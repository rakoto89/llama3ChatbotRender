import os
import requests
import pdfplumber
import pandas as pd
from flask import Flask, request, render_template, jsonify
from flask_cors import CORS
from googletrans import Translator

app = Flask(__name__, static_url_path='/static')
CORS(app)

LLAMA3_ENDPOINT = os.environ.get("LLAMA3_ENDPOINT", "https://api.together.xyz/v1/chat/completions").strip()
REN_API_KEY = os.environ.get("REN_API_KEY", "").strip()
FEEDBACK_SECRET_KEY = os.environ.get("FEEDBACK_SECRET_KEY", "test-key")

conversation_history = []
conversation_context = {}

irrelevant_topics = [
    "singer", "actor", "actress", "movie", "pop culture", "music", "sports",
    "nature", "celebrity", "tv show", "fashion", "entertainment", "politics",
    "history", "geography", "animal", "weather", "food", "recipe", "finance",
    "technology", "gaming", "tobacco", "alcohol", "Caffeine", "Nicotine", "Amphetamine",
    "Methylphenidate", "Cocaine", "Methamphetamine", "Benzodiazepines", "Z-drugs", "LSD (Acid)",
    "THC", "CBD", "synthethic cannabinoids", "SSRIs", "Antipsychotics", "antihistamines", "NSAIDs",
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
    matched_irrelevant = [topic for topic in irrelevant_topics if topic in question_lower]
    matched_relevant = [topic for topic in relevant_topics if topic in question_lower]

    print("Question:", question_lower)
    print("Matched irrelevant topics:", matched_irrelevant)
    print("Matched relevant topics:", matched_relevant)

    if matched_irrelevant and not matched_relevant:
        return False

    if matched_relevant:
        return True

    recent_user_msgs = [msg["content"] for msg in reversed(conversation_history) if msg["role"] == "user"]
    for msg in recent_user_msgs[:5]:
        if any(topic in msg.lower() for topic in relevant_topics):
            return True

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

# === Load PDFs and Excel ===
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

combined_text = f"{excel_text}\n\n{pdf_texts}\n\n{all_table_text}"[:12000]

def get_llama3_response(question, user_lang="en"):
    user_lang = normalize_language_code(user_lang)
    translator = Translator()
    try:
        translated_question = translator.translate(question, dest="en").text
    except Exception as e:
        print(f"Translation failed: {str(e)}")
        translated_question = question

    if not is_question_relevant(translated_question):
        try:
            return translator.translate(
                "Sorry, I can only answer questions about opioids, addiction, overdose, or treatment.",
                dest=user_lang
            ).text
        except Exception as e:
            print(f"Translation fallback failed: {str(e)}")
            return "Sorry, I can only answer questions about opioids, addiction, overdose, or treatment."

    conversation_history.append({"role": "user", "content": translated_question})

    system_prompt = """You are an educational chatbot specifically designed to provide accurate, factual, and age-appropriate
    information about opioids, including opioid use and misuse, addiction, overdose, prevention, pain management, treatment, risk factors, 
    and related topics..."""

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
        print("Status Code:", res.status_code)
        print("Raw Response:", res.text)
        data = res.json()
        if "choices" in data and data["choices"]:
            message = data["choices"][0].get("message", {})
            content = message.get("content", "").strip()
            if not content:
                content = "I’m here to help, but the response was unexpectedly empty. Please try again."
        else:
            content = "I'm having trouble getting a valid response right now. Please try again or rephrase your question."
    except requests.exceptions.Timeout:
        content = "The server took too long to respond. Please try again shortly."
    except requests.exceptions.HTTPError as e:
        content = f"Server returned an HTTP error: {str(e)}"
    except Exception as e:
        print("Unhandled error:", str(e))
        content = "Our apologies, a technical error occurred. Please reach out to our system admin at akotor0621@students.bowiestate.edu."

    conversation_history.append({"role": "assistant", "content": content})
    try:
        return translator.translate(content, dest=user_lang).text
    except Exception as e:
        print(f"Response translation failed: {str(e)}")
        return content

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

@app.route("/env")
def check_env():
    return jsonify({
        "LLAMA3_ENDPOINT": LLAMA3_ENDPOINT,
        "REN_API_KEY_SET": bool(REN_API_KEY)
    })
