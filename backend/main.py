# class MatchRequest(BaseModel):
#     patient:  KeywordSet
#     location: KeywordSet

# @app.post("/match")
# def match(request: MatchRequest):
#     return compute_match_score(request.patient, request.location)


import os
import re
from typing import Optional, Any

import google.generativeai as genai
import requests
import torch
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, util



# Load variables from .env into the environment
load_dotenv()

elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
deepl_api_key = os.getenv("DEEPL_API_KEY")
gemini_api_key = os.getenv("GEMINI_API_KEY")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

# --- BASE MODELS ---

class MedicalRequest(BaseModel):
    user_input: str

class NavigateRequest(BaseModel):
    text: str
    language: str = "English"

class TranslateAndSearchRequest(BaseModel):
    text: str
    language: str = "English"

# Define KeywordSet BEFORE ClinicEntry so it is recognized
class KeywordSet(BaseModel):
    symptoms: list[str] = []
    specialty: list[str] = []
    demographics: list[str] = []
    access_needs: list[str] = []
    urgency: int = 1

class ClinicLocation(BaseModel):
    lat: float
    lng: float

class ClinicEntry(BaseModel):
    name: str
    address: str
    location: ClinicLocation
    price_tag: str
    metadata: KeywordSet
    phone: Optional[str] = None
    hours: Optional[str] = None
    languages: list[str] = []
    services_offered: Optional[str] = None

# --- MOCK DATA ---

MOCK_DATABASE_RESULTS = [
    {
        "id": "1",
        "name": "Miami Rescue Mission",
        "address": "2250 NW 1st Ave",
        "lat": 25.7984,
        "lng": -80.1989,
        "tag": "Free",
    },
    {
        "id": "2",
        "name": "Camillus Health Concern",
        "address": "336 NW 5th St",
        "lat": 25.7794,
        "lng": -80.1982,
        "tag": "Low-Cost",
    },
    {
        "id": "3",
        "name": "Open Door Health",
        "address": "1350 NW 14th St",
        "lat": 25.7891,
        "lng": -80.2185,
        "tag": "Sliding Scale",
    },
]

# --- UTILITIES ---

def clean_transcript(text: str) -> str:
    """
    Remove pauses, filler words, and non-speech annotations
    """

    if not text:
        return text

    # Remove anything in parentheses
    text = re.sub(r"\([^)]*\)", "", text)

    # Remove filler words
    filler_words = [
        r"\bum\b",
        r"\buh\b",
        r"\bmmm+\b",
        r"\beh\b",
        r"\beste\b",
        r"\bah\b"
    ]

    for filler in filler_words:
        text = re.sub(filler, "", text, flags=re.IGNORECASE)

    # Remove stray punctuation except normal sentence punctuation
    text = re.sub(r"[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.,!?]", "", text)

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)

    return text.strip()

def get_source_lang_code(language: str) -> Optional[str]:
    normalized = language.strip().lower()
    if normalized in ["español", "espanol", "spanish", "es"]:
        return "ES"
    if normalized in ["english", "en"]:
        return "EN"
    return None

def translate_text_with_deepl(text: str, source_lang: str, target_lang: str = "EN") -> str:
    if not deepl_api_key:
        raise HTTPException(
            status_code=500,
            detail="DEEPL_API_KEY is not configured."
        )

    response = requests.post(
        "https://api-free.deepl.com/v2/translate",
        headers={
            "Authorization": f"DeepL-Auth-Key {deepl_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "text": [text],
            "source_lang": source_lang,
            "target_lang": target_lang,
        },
        timeout=60,
    )

    if response.status_code != 200:
        print("DeepL error:", response.text)
        raise HTTPException(status_code=response.status_code, detail=response.text)

    result = response.json()
    translated = result.get("translations", [{}])[0].get("text", "").strip()

    if not translated:
        raise HTTPException(status_code=500, detail="DeepL returned an empty translation.")

    return translated

# --- AI & SEARCH LOGIC ---
@app.post("/interpret")
async def interpret_medical_needs(request: MedicalRequest):
    current_key = gemini_api_key
    if not current_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured.")

    try:
        genai.configure(api_key=current_key)
        
        # Using an appropriate Gemini model for fast text tasks
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        prompt = f"""
            You are a medical needs interpreter helping connect patients to appropriate healthcare services.
            The user may have limited English proficiency, so their input may be grammatically incorrect,
            use informal language, or describe symptoms vaguely. Always interpret charitably and do your best
            to infer their medical needs.

            User input:
            "{request.user_input}"

            Your task:
            1. Interpret what medical help the user is likely seeking, even if poorly expressed.
            2. Normalize any lay terms or colloquial descriptions into standard medical concepts
            (e.g. "my tummy hurts after eating" → "abdominal pain", "digestive issues").
            3. Extract keywords across these specific categories:

            - symptoms: physical or mental symptoms described (e.g. "chest pain", "fever", "anxiety")
            - specialty: medical specialty or service likely needed (e.g. "cardiology", "pediatrics", "pharmacy")
            - demographics: relevant patient details (e.g. "child", "elderly", "pregnant")
            - access_needs: practical needs (e.g. "low-cost", "wheelchair accessible", "Spanish-speaking")
            - urgency: how urgent this seems (rank numerically from 1 to 10, with 1 being routine and 10 being an emergency)

            Return ONLY a valid JSON object in this exact format, with no explanation:

            {{
              "symptoms": ["keyword1", "keyword2"],
              "specialty": ["keyword1", "keyword2"],
              "demographics": ["keyword1", "keyword2"],
              "access_needs": ["keyword1", "keyword2"],
              "urgency": 5
            }}

            If a category has no relevant keywords, return an empty list [].
            If the input is completely unintelligible, return:
            {{"error": "unable to interpret"}}
        
        """

        response = model.generate_content(prompt)
        return {"interpretation": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

compare_model = SentenceTransformer("all-MiniLM-L6-v2")

WEIGHTS = {
    "symptoms": 0.35,
    "specialty": 0.35,
    "demographics": 0.15,
    "access_needs": 0.10,
    "urgency": 0.05,
}

def embed_keywords(keywords: list[str]) -> torch.Tensor | None:
    if not keywords:
        return None
    return compare_model.encode(" ".join(keywords), convert_to_tensor=True)

def category_similarity(patient_keywords: list[str], location_keywords: list[str]) -> float:
    patient_emb = embed_keywords(patient_keywords)
    location_emb = embed_keywords(location_keywords)
    if patient_emb is None or location_emb is None:
        return 0.0
    return float(util.cos_sim(patient_emb, location_emb))

def urgency_similarity(patient_urgency: int, location_urgency: int) -> float:
    diff = abs(patient_urgency - location_urgency)
    return (1 - (float(diff)/10))

def compute_match_score(patient: KeywordSet, location: KeywordSet) -> dict:
    breakdown = {}
    for category in ["symptoms", "specialty", "demographics", "access_needs"]:
        patient_terms = getattr(patient, category)
        location_terms = getattr(location, category)
        breakdown[category] = category_similarity(patient_terms, location_terms)
    breakdown["urgency"] = urgency_similarity(patient.urgency, location.urgency)
    overall_score = sum(breakdown[category] * weight for category, weight in WEIGHTS.items())
    return {"score": round(overall_score, 4), "breakdown": {k: round(v, 4) for k, v in breakdown.items()}}

# --- ENDPOINTS ---

@app.get("/")
def root():
    return {"message": "Backend is running."}

@app.post("/navigate")
async def navigate(request: NavigateRequest):
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = f"User is asking in {request.language}: '{request.text}'. Give a short helpful response in {request.language}."
        response = model.generate_content(prompt)
        reply = response.text
    except Exception as e:
        print(f"Error in Gemini processing for navigate: {e}")
        reply = "I found these clinics for you."

    return {
        "reply": reply,
        "clinics": MOCK_DATABASE_RESULTS
    }

@app.post("/speech/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not elevenlabs_api_key:
        raise HTTPException(
            status_code=500,
            detail="ELEVENLABS_API_KEY is not configured."
        )

    contents = await file.read()

    headers = {
        "xi-api-key": elevenlabs_api_key
    }

    files = {
        "file": (file.filename, contents, file.content_type or "audio/m4a")
    }

    data = {
        "model_id": "scribe_v1"
    }

    response = requests.post(
        "https://api.elevenlabs.io/v1/speech-to-text",
        headers=headers,
        files=files,
        data=data,
        timeout=60
    )

    if response.status_code != 200:
        print("ElevenLabs error:", response.text)
        raise HTTPException(status_code=response.status_code, detail=response.text)

    result = response.json()

    raw_text = result.get("text", "")
    cleaned_text = clean_transcript(raw_text)

    return {
        "text": cleaned_text,
        "raw": result
    }

# @app.post("/translate-and-search")
# async def translate_and_search(request: TranslateAndSearchRequest):
#     raw_text = request.text.strip()

#     if not raw_text:
#         raise HTTPException(status_code=400, detail="Text is required.")

#     source_lang = get_source_lang_code(request.language)

#     if source_lang == "EN":
#         translated_text = raw_text

#     elif source_lang == "ES":
#         translated_text = translate_text_with_deepl(
#             raw_text,
#             source_lang="ES",
#             target_lang="EN"
#         )

#     else:
#         translated_text = raw_text

#     return {
#         "original_text": raw_text,
#         "translated_text": translated_text,
#         "clinics": MOCK_DATABASE_RESULTS,
#     }


# --- DATABASE AND RANKING ---

@app.post("/summarize")
async def summarize_location(location: str):
    current_key = gemini_api_key
    if not current_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured.")

    try:
        genai.configure(api_key=current_key)
        
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        prompt = f"""
        Summarize this medical clinic location:

        {location}

        Include:
        - address
        - services
        - hours
        - phone number if available
        """

        response = model.generate_content(prompt)
        return {"summary": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

MOCK_DATABASE: list[ClinicEntry] = [
    ClinicEntry(
        name="UHealth Lennar Foundation Medical Center",
        address="5555 Ponce de Leon Blvd, Coral Gables, FL 33146",
        location=ClinicLocation(lat=25.7130, lng=-80.2764),
        price_tag="Low-cost/Insurance",
        metadata=KeywordSet(
            symptoms=["fever", "dizziness", "sports injury", "flu", "cough", "rash", "dehydration", "nausea", "migraine", "sore throat", "earache", "minor burns", "sprain"],
            specialty=["Sports Medicine", "Student Health", "Urgent Care", "Family Medicine"],
            demographics=["college students", "athletes", "young adults", "adults"],
            access_needs=["wheelchair accessible", "walk-in", "near transit"],
            urgency=4
        )
    ),
    ClinicEntry(
        name="CVS MinuteClinic - Coral Gables",
        address="1160 S Dixie Hwy, Coral Gables, FL 33146",
        location=ClinicLocation(lat=25.7171, lng=-80.2592),
        price_tag="Low-cost/Fixed Price",
        metadata=KeywordSet(
            symptoms=["cough", "sneezing", "flu", "sore throat", "earache", "pink eye", "vaccination", "minor rash", "bug bite"],
            specialty=["Pharmacy", "Retail Clinic", "Family Medicine"],
            demographics=["all ages", "students", "commuters"],
            access_needs=["wheelchair accessible", "walk-in", "parking available"],
            urgency=2
        )
    ),
    ClinicEntry(name="Coral Gables Hospital - Emergency Room",
    address="3100 Douglas Rd, Coral Gables, FL 33134",
    location=ClinicLocation(lat=25.7516, lng=-80.2589),
    price_tag="Hospital/Emergency",
    metadata=KeywordSet(
        symptoms=["chest pain", "broken bone", "severe bleeding", "shortness of breath", "unconscious", "head injury", "severe abdominal pain", "poisoning"],
        specialty=["Emergency Medicine", "Surgery", "Critical Care"],
        demographics=["all ages", "seniors", "adults"],
        access_needs=["wheelchair accessible", "ER entrance", "ambulance bay"],
        urgency=10
        )
    ),
    ClinicEntry(
        name="Baptist Health Urgent Care - Coral Gables",
        address="7000 SW 62nd Ave, South Miami, FL 33143",
        location=ClinicLocation(lat=25.7483, lng=-80.2581),
        price_tag="Mid-range/Urgent Care",
        metadata=KeywordSet(
            symptoms=["sprain", "deep cut", "fever", "x-ray needed", "allergic reaction", "dehydration", "stitches", "animal bite"],
            specialty=["Urgent Care", "Radiology", "Pediatrics"],
            demographics=["families", "children", "athletes"],
            access_needs=["wheelchair accessible", "walk-in", "online check-in"],
            urgency=6
        )
    ),
    ClinicEntry(
        name="CHI South Miami Health Center",
        address="6350 Sunset Dr, South Miami, FL 33143",
        location=ClinicLocation(lat=25.7042, lng=-80.2915),
        price_tag="Free/Sliding Scale",
        metadata=KeywordSet(
            symptoms=["wellness check", "chronic pain", "flu shot", "dental pain", "mental health", "anxiety", "maternity care"],
            specialty=["Community Health", "Dentistry", "Behavioral Health"],
            demographics=["uninsured", "low-income", "immigrants"],
            access_needs=["sliding scale", "near metro-rail", "bilingual"],
            urgency=3
        )
    ),
    ClinicEntry(
        name="UM Student Health Service",
        address="5555 Ponce de Leon Blvd, Coral Gables, FL 33146",
        location=ClinicLocation(lat=25.7205, lng=-80.2758),
        price_tag="Student Insurance/Low-cost",
        metadata=KeywordSet(
            symptoms=["academic stress", "flu", "STI testing", "prescription refill", "vaccines", "fatigue", "minor injury"],
            specialty=["Student Health", "Preventative Care", "Mental Health"],
            demographics=["University of Miami students"],
            access_needs=["on-campus", "appointment required", "student portal"],
            urgency=4
        )
    )
]

@app.post("/rank-clinics")
async def rank_clinics(patient_needs: KeywordSet):
    all_scored_clinics = []
    for clinic in MOCK_DATABASE:
        match_data = compute_match_score(patient_needs, clinic.metadata)
        all_scored_clinics.append({
            "name": clinic.name,
            "address": clinic.address,
            "lat": clinic.location.lat,
            "lng": clinic.location.lng,
            "tag": clinic.price_tag,
            "match_score": match_data["score"]
        })
    all_scored_clinics.sort(key=lambda x: x["match_score"], reverse=True)
    return all_scored_clinics[:3]