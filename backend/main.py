import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from keys import get_gemini_key

# Load variables from .env into the environment

gemini_api_key = get_gemini_key()

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
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = f"User is asking in {request.language}: '{request.text}'. Give a 1-sentence helpful response in {request.language}."
        response = model.generate_content(prompt)
        reply = response.text
    except:
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
        genai.configure(api_key=current_key)
        
        # Using an appropriate Gemini model for fast text tasks
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        prompt = f"""
        You are an AI assistant designed to categorize medical needs. 
        A user has provided the following input:
        "\n{request.user_input}\n"
        
        Please interpret their specific needs based on this input.
        From this response, generate a list of keywords for the user's needs.
        Ex: low-cost, baby, teeth, pharmacy, Spanish, etc.
        Format the interpretation like this:
        [keyword1, keyword2, keyword3, ...]
        
        """

        response = model.generate_content(prompt)
        return {"interpretation": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/summarize")
async def summarize_location(location: str):

    current_key = gemini_api_key
    if not current_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured.")

    try:
        genai.configure(api_key=current_key)
        
        model = genai.GenerativeModel("gemini-1.5-flash")
        
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

        response = model.generate_content(prompt)
        return {"summary": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))