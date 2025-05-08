# === PDF and EXCEL TEXT EXTRACTION ===
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
