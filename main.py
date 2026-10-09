# main.py - backend for Athena Zero (FastAPI + Groq + SQLite)

import os
import sqlite3

import openai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pydantic import BaseModel

# read the API key from the .env file
load_dotenv()
client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)
MODEL = "openai/gpt-oss-20b"

# the personality of the bot
SYSTEM_PROMPT = """You are Athena Zero, a smart, warm, general-purpose AI assistant.
- Help with anything: questions, writing, coding, math, ideas, advice, learning.
- Answer directly first, then explain only as much as needed.
- Use markdown (code blocks, lists) only when it genuinely helps.
- If a request is vague, make a reasonable guess and answer instead of interrogating the user.
- Be honest when you are unsure, and never invent facts."""

# extra line added to the prompt depending on the "Reply style" setting
STYLES = {
    "brief": "Keep replies very short: a few sentences at most unless asked for more.",
    "balanced": "Keep replies concise unless the user asks for detail.",
    "detailed": "Give thorough, well-structured answers with examples when useful.",
}

app = FastAPI()


# ---------- database helpers ----------

def get_connection():
    """Open the database and make sure the messages table exists."""
    con = sqlite3.connect("chat.db")
    con.execute(
        """CREATE TABLE IF NOT EXISTS messages(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            role TEXT,
            content TEXT)"""
    )
    return con


def load_messages(session_id):
    """Return all messages of one chat as a list of {role, content}."""
    con = get_connection()
    rows = con.execute(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id",
        (session_id,),
    ).fetchall()
    con.close()

    messages = []
    for role, content in rows:
        messages.append({"role": role, "content": content})
    return messages


# ---------- what the browser sends us ----------

class ChatRequest(BaseModel):
    session_id: str
    message: str
    style: str = "balanced"
    instructions: str = ""
    temperature: float = 0.8


# ---------- routes ----------

@app.post("/chat")
def chat(req: ChatRequest):
    # old messages + the new one
    history = load_messages(req.session_id)
    history.append({"role": "user", "content": req.message})

    # build the system prompt
    system = SYSTEM_PROMPT + "\n" + STYLES.get(req.style, STYLES["balanced"])
    if req.instructions.strip() != "":
        system += "\nThe user's own instructions (follow them): " + req.instructions.strip()[:800]

    # keep temperature between 0 and 1.5
    temperature = max(0.0, min(1.5, req.temperature))

    # ask Groq for a reply
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": system}] + history,
            temperature=temperature,
            max_tokens=2000,
        )
    except openai.RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit reached")
    except openai.AuthenticationError:
        raise HTTPException(status_code=401, detail="Bad API key")
    except openai.APIError as e:
        print("GROQ ERROR:", repr(e))
        raise HTTPException(status_code=502, detail="Groq said: " + str(getattr(e, "message", e)))

    reply = response.choices[0].message.content

    # save both messages in the database
    con = get_connection()
    con.execute("INSERT INTO messages(session_id, role, content) VALUES (?, ?, ?)",
                (req.session_id, "user", req.message))
    con.execute("INSERT INTO messages(session_id, role, content) VALUES (?, ?, ?)",
                (req.session_id, "assistant", reply))
    con.commit()
    con.close()

    return {"reply": reply}


@app.get("/history/{session_id}")
def get_history(session_id: str):
    return {"messages": load_messages(session_id)}


@app.delete("/history/{session_id}")
def delete_history(session_id: str):
    con = get_connection()
    con.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
    con.commit()
    con.close()
    return {"ok": True}


# serve the website (index.html, style.css, script.js) from the static folder
# NOTE: this must stay at the bottom, after all the routes above
app.mount("/", StaticFiles(directory="static", html=True))
