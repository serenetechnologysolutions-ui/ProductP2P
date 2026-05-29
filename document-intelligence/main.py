import re
import json
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
from rapidfuzz import fuzz
import tempfile
import os

app = FastAPI(title="Document Intelligence Service")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def normalize_text(text: str) -> str:
    """Lowercase, collapse multiple spaces, strip."""
    text = text.lower()
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_value_from_line(line: str, regex_pattern: str = None) -> str:
    """Extract value after the keyword match on a line."""
    # Try regex first
    if regex_pattern:
        match = re.search(regex_pattern, line)
        if match:
            return match.group(0)

    # Fallback: take everything after colon or last word
    parts = re.split(r'[:\-]', line, maxsplit=1)
    if len(parts) > 1:
        return parts[1].strip()

    # Take the last token
    tokens = line.split()
    if len(tokens) > 1:
        return tokens[-1]
    return line


def extract_fields(text: str, configs: list) -> list:
    """Extract fields from text using configured aliases and regex."""
    normalized = normalize_text(text)
    lines = normalized.split('\n')
    results = []

    # Sort configs by priority
    priority_order = {'high': 0, 'medium': 1, 'low': 2}
    sorted_configs = sorted(configs, key=lambda c: priority_order.get(c.get('priority', 'medium'), 1))

    for config in sorted_configs:
        field_name = config['field_name']
        aliases = config.get('aliases', [])
        regex_pattern = config.get('regex_pattern')
        found = False

        for alias in aliases:
            alias_lower = alias.lower()
            for line in lines:
                # Exact match
                if alias_lower in line:
                    value = extract_value_from_line(line, regex_pattern)
                    if value and value != alias_lower:
                        results.append({
                            'field_name': field_name,
                            'extracted_value': value,
                            'confidence': 95,
                            'match_type': 'exact',
                            'needs_review': False,
                        })
                        found = True
                        break

            if found:
                break

        if not found:
            # Try fuzzy matching
            for alias in aliases:
                alias_lower = alias.lower()
                for line in lines:
                    score = fuzz.partial_ratio(alias_lower, line)
                    if score >= 80:
                        value = extract_value_from_line(line, regex_pattern)
                        if value:
                            results.append({
                                'field_name': field_name,
                                'extracted_value': value,
                                'confidence': 80,
                                'match_type': 'fuzzy',
                                'needs_review': False,
                            })
                            found = True
                            break
                if found:
                    break

        if not found and regex_pattern:
            # Regex fallback on full text
            match = re.search(regex_pattern, normalized)
            if match:
                results.append({
                    'field_name': field_name,
                    'extracted_value': match.group(0),
                    'confidence': 70,
                    'match_type': 'regex',
                    'needs_review': False,
                })
                found = True

        if not found:
            results.append({
                'field_name': field_name,
                'extracted_value': None,
                'confidence': 0,
                'match_type': 'not_found',
                'needs_review': True,
            })

    return results


@app.post("/extract")
async def extract_from_pdf(file: UploadFile = File(...), configs: str = "[]"):
    """Extract fields from uploaded PDF using provided configs."""
    parsed_configs = json.loads(configs)

    # Save temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Extract text
        full_text = ""
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n"

        if not full_text.strip():
            return {"success": True, "data": [], "message": "No text extracted from PDF"}

        results = extract_fields(full_text, parsed_configs)
        return {"success": True, "data": results}
    finally:
        os.unlink(tmp_path)


@app.get("/health")
def health():
    return {"status": "ok", "service": "document-intelligence"}
