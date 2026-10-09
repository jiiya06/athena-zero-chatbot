# Athena Zero
AI chatbot built with FastAPI, SQLite and the Groq API.

## Run
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then put your Groq key in .env
uvicorn main:app --reload
# open http://127.0.0.1:8000
