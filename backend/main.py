import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer, util
import torch

# Load variables from .env into the environment
load_dotenv()
gemini_api_key = os.getenv("GEMINI_API_KEY")

app = FastAPI()

# --- ADDED FOR FRONTEND CONNECTION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
# --------------------------------------

# Configure Gemini based on the environment variable
# The key should be loaded before running the app

if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

class MedicalRequest(BaseModel):
    user_input: str

# --- ADDED FOR FRONTEND NAVIGATION ---
class NavigateRequest(BaseModel):
    text: str
    language: str = "English"

MOCK_DATABASE_RESULTS = [
    {"id": "1", "name": "Miami Rescue Mission", "address": "2250 NW 1st Ave", "lat": 25.7984, "lng": -80.1989, "tag": "Free"},
    {"id": "2", "name": "Camillus Health Concern", "address": "336 NW 5th St", "lat": 25.7794, "lng": -80.1982, "tag": "Low-Cost"},
    {"id": "3", "name": "Open Door Health", "address": "1350 NW 14th St", "lat": 25.7891, "lng": -80.2185, "tag": "Sliding Scale"},
]

@app.post("/navigate")
async def navigate(request: NavigateRequest):
    print(f"Gemini processing for {request.language}: {request.text}")
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = f"User is asking in {request.language}: '{request.text}'. Give a 1-sentence helpful response in {request.language}."
        response = model.generate_content(prompt)
        reply = response.text
    except Exception as e:
        print(f"Error in Gemini processing for navigate: {e}")
        reply = "I found these clinics for you."
    
    return {
        "reply": reply,
        "clinics": MOCK_DATABASE_RESULTS 
    }
# --------------------------------------

@app.post("/interpret")
async def interpret_medical_needs(request: MedicalRequest):

    current_key = gemini_api_key
    if not current_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured.")

    try:
        # Configure Gemini based on the environment variable
# The key should be loaded before running the app

        client = genai.Client(api_key=current_key)
        
        # Using an appropriate Gemini model for fast text tasks
        
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

            Return ONLY a JSON object in this exact format, with no explanation:
            
            symptoms: [keyword1, keyword2, ...],
            specialty: [keyword1, keyword2, ...],
            demographics: [keyword1, keyword2, ...],
            access_needs: [keyword1, keyword2, ...],
            urgency: [number_ranking]

            If a category has no relevant keywords, return an empty list [].
            If the input is completely unintelligible, return "error": "unable to interpret"
        
        """

        response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        return {"interpretation": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/summarize")
async def summarize_location(location: str):

    current_key = gemini_api_key
    if not current_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured.")

    try:
        client = genai.Client(api_key=gemini_api_key)
        
        prompt = f"""
        You are an AI assistant designed to summarize locations for medical assistance. 
        A user has provided the following location:
        \n{location}\n
        Please summarize the location in a friendly and informative manner.
        Include the following information:
        - Name of the location
        - Address
        - Phone number
        - Website
        - Operating hours
        - Services offered
        - Any other relevant information
        """

        response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        return {"summary": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

# Load the embedding model once at startup
compare_model = SentenceTransformer("all-MiniLM-L6-v2")

# How much each category contributes to the final score
WEIGHTS = {
    "symptoms":     0.35,
    "specialty":    0.35,
    "demographics": 0.15,
    "access_needs": 0.10,
    "urgency":      0.05,
}

class KeywordSet(BaseModel):
    symptoms:     list[str] = []
    specialty:    list[str] = []
    demographics: list[str] = []
    access_needs: list[str] = []
    urgency:      int = 1  # 1-10


class MatchRequest(BaseModel):
    patient:  KeywordSet
    location: KeywordSet


def embed_keywords(keywords: list[str]) -> torch.Tensor | None:
    """Join keywords into a phrase and embed as a single vector."""
    if not keywords:
        return None
    return compare_model.encode(" ".join(keywords), convert_to_tensor=True)


def category_similarity(patient_keywords: list[str], location_keywords: list[str]) -> float:
    """
    Semantic cosine similarity between two keyword lists.
    Returns 0.0 if either list is empty.
    """
    patient_emb  = embed_keywords(patient_keywords)
    location_emb = embed_keywords(location_keywords)

    if patient_emb is None or location_emb is None:
        return 0.0

    return float(util.cos_sim(patient_emb, location_emb))


def urgency_similarity(patient_urgency: int, location_urgency: int) -> float:
    
    # Scores how well the location's urgency level matches the patient's.
    # Exact match = 1.0, one level off = 0.5, two levels off = 0.1.
    # A location that handles emergencies is also a good fit for urgent/routine needs.
    
    diff = abs(patient_urgency - location_urgency)

    return (1 - (float(diff)/10))


def compute_match_score(patient: KeywordSet, location: KeywordSet) -> dict:

    # Computes a weighted similarity score between patient needs and location tags.
    # Returns the overall score and a per-category breakdown for transparency.
    
    breakdown = {}

    for category in ["symptoms", "specialty", "demographics", "access_needs"]:
        patient_terms  = getattr(patient, category)
        location_terms = getattr(location, category)
        breakdown[category] = category_similarity(patient_terms, location_terms)

    breakdown["urgency"] = urgency_similarity(patient.urgency, location.urgency)

    overall_score = sum(
        breakdown[category] * weight
        for category, weight in WEIGHTS.items()
    )

    return {
        "score":     round(overall_score, 4),   # 0.0 – 1.0
        "breakdown": {k: round(v, 4) for k, v in breakdown.items()},
    }


@app.post("/match")
def match(request: MatchRequest):
    return compute_match_score(request.patient, request.location)

