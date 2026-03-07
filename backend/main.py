from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock Data: This represents what Gemini + MongoDB will eventually return
MOCK_DATABASE_RESULTS = [
    {"id": "1", "name": "Miami Rescue Mission", "address": "2250 NW 1st Ave", "lat": 25.7984, "lng": -80.1989, "tag": "Free"},
    {"id": "2", "name": "Camillus Health Concern", "address": "336 NW 5th St", "lat": 25.7794, "lng": -80.1982, "tag": "Low-Cost"},
    {"id": "3", "name": "Open Door Health", "address": "1350 NW 14th St", "lat": 25.7891, "lng": -80.2185, "tag": "Sliding Scale"},
]

@app.post("/navigate")
async def navigate(payload: dict):
    user_query = payload.get("text", "")
    print(f"Gemini is processing: {user_query}")
    
    # Logic note: Your teammate will replace this with the real Gemini filter
    return {
        "reply": "I found 3 clinics near you that match your needs.",
        "clinics": MOCK_DATABASE_RESULTS 
    }