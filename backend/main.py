import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
from keys import get_gemini_key
from request import Request

# Load variables from .env into the environment

gemini_api_key = get_gemini_key()

app = FastAPI()

# Configure Gemini based on the environment variable
# The key should be loaded before running the app

if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

class MedicalRequest(BaseModel):
    user_input: str

@app.get("/")
def read_root():
    return {"message": "Hello World"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}

@app.post("/interpret")
async def interpret_medical_needs(request: MedicalRequest):

    current_key = gemini_api_key
    if not current_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured.")

    try:
        genai.configure(api_key=current_key)
        
        # Using an appropriate Gemini model for fast text tasks
        model = genai.GenerativeModel("gemini-2.5-flash")
        
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