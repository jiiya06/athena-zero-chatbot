# Athena Zero

**Intelligent AI Chatbot using OpenAI - Athena Zero**

Artificial Intelligence and Machine Learning (BCS515B), 5th semester, VTU
Assignment Phase I

| Name | USN |
|------|-----|
| Haritha R | 1RF24IS037 |
| Jiya P | 1RF24IS046 |

## About the project

Athena Zero is a chatbot that runs in the browser. You type a question, the Python backend sends it to a language model together with your earlier messages, and the answer shows up in the chat window. Every chat is saved in a small SQLite database, so it is still there after you refresh the page.

We used the OpenAI Python library to talk to the model. Instead of the paid OpenAI service we pointed it at Groq, which has a free tier and accepts the same request format. The model is `openai/gpt-oss-20b`, an open-weight model released by OpenAI. This way the project costs nothing to run and still follows the OpenAI API format.

## Features

- Chat with the assistant. It remembers the earlier messages of that chat
- Chats are saved in SQLite (`chat.db`). Deleting a chat, or using "Delete all chats", also removes it from the database
- Sidebar with new chat, search, rename (double-click or the pencil) and delete
- Settings: dark, light or system theme, text size, reply style (brief, balanced, detailed), a creativity slider (temperature) and custom instructions
- Maths and chemistry are drawn properly (equations, arrows, formulas like CO2 and H2O) using KaTeX
- Attach an image and ask about it, for example a diagram or a textbook question. Small text and code files can be attached too
- Study modes, picked from a dropdown above the message box:
  - Tutor: gives hints first instead of the full answer
  - Exam answer: formula, steps and a "common mistake" line
  - Explain simply: easy words and an analogy
  - Quiz me after: three quick questions at the end
- Copy buttons for code blocks and replies, and export of a chat as a `.md` file

## Tech stack

| Part | What we used |
|------|--------------|
| Backend | Python, FastAPI, Uvicorn |
| AI | OpenAI Python library, Groq API, `openai/gpt-oss-20b` for text and a Groq vision model for images |
| Database | SQLite (comes with Python) |
| Frontend | HTML, CSS, JavaScript |
| Browser libraries | marked (markdown), DOMPurify (safe HTML), KaTeX with mhchem (maths and chemistry) |
| Config | python-dotenv, to read the API key from `.env` |

## How it works

1. The browser sends the message to `POST /chat` with a session id, the reply style, the study mode and, if there is one, an image.
2. The backend loads the old messages of that session from `chat.db`.
3. It builds a system prompt (personality, reply style, study mode, user instructions) and sends everything to Groq. If an image is attached, the vision model is used instead of the text model.
4. The reply is saved in the database and sent back.
5. The browser turns the markdown into HTML and draws the formulas with KaTeX.

| Route | What it does |
|-------|--------------|
| `POST /chat` | send a message, get a reply |
| `GET /history/{session_id}` | load all messages of a chat |
| `DELETE /history/{session_id}` | delete a chat from the database |

## Project structure

```
athena-zero-chatbot/
├── main.py            backend (routes, database, Groq calls)
├── requirements.txt   Python packages needed
├── README.md
├── .gitignore
└── static/
    ├── index.html     the page
    ├── style.css      styling
    └── script.js      chat logic in the browser
```

`chat.db` is created automatically the first time you send a message. The `.env` file is created by you (see below) and is never uploaded to GitHub.

## How to run it on your computer

### Step 1: Install Python and Git

You need Python 3.9 or newer. Git is only needed if you want to clone the repo, you can also download it as a ZIP.

**Windows**
1. Download Python from https://www.python.org/downloads/ and run the installer. On the first screen **tick "Add python.exe to PATH"**, then click Install Now.
2. Download Git from https://git-scm.com/download/win and install it with the default options.
3. Open **Command Prompt** (press the Windows key, type `cmd`, press Enter) and check:

```
python --version
git --version
```

**macOS**
1. Open Terminal and install Homebrew from https://brew.sh if you do not have it.
2. Run:

```
brew install python git
```

**Linux (Ubuntu / Debian)**

```
sudo apt update
sudo apt install python3 python3-venv python3-pip git
```

### Step 2: Get the code

```
git clone https://github.com/jiiya06/athena-zero-chatbot.git
cd athena-zero-chatbot
```

The repository is private. When Git asks you to sign in, use the GitHub account that was given access. If you would rather not use Git, open the repo page on GitHub, click Code, then Download ZIP, extract it and open a terminal inside the extracted folder.

### Step 3: Get a free Groq API key

1. Go to https://console.groq.com and sign up.
2. Open https://console.groq.com/keys and click Create API Key.
3. Copy the key. You cannot view it again later.

### Step 4: Create the virtual environment and install packages

**Windows (Command Prompt)**

```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

**Windows (PowerShell)**

```
python -m venv venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

The `Set-ExecutionPolicy` line only affects that one window. It is needed because PowerShell blocks the activate script by default.

**macOS / Linux**

```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

After activating you should see `(venv)` at the start of the line.

### Step 5: Put your key in a `.env` file

Create a file named `.env` (with the dot and no other extension) in the project folder. It must contain exactly this one line, with your own key:

```
GROQ_API_KEY=paste_your_key_here
```

- **Windows:** run `notepad .env`, click Yes to create the file, paste the line and save. If Notepad saves it as `.env.txt`, use File > Save As, set "Save as type" to All files and type `".env"` with the quotes. Do not use PowerShell's `echo` for this, it saves the file in the wrong encoding.
- **macOS / Linux:** run `echo "GROQ_API_KEY=paste_your_key_here" > .env`

Optional: if image questions give a "model not found" error, Groq has probably renamed its vision model. Check https://console.groq.com/docs/vision and add a second line to `.env`: `VISION_MODEL=model-name-from-that-page`

### Step 6: Start the server

```
uvicorn main:app --reload
```

If it says `uvicorn` is not found, use `python -m uvicorn main:app --reload` instead (`python3` on macOS and Linux).

Now open **http://127.0.0.1:8000** in your browser. To stop the server press Ctrl+C in the terminal.

### Running it again later

Open a terminal in the project folder, activate the environment again (`venv\Scripts\activate` on Windows, `source venv/bin/activate` on macOS and Linux) and run the `uvicorn` command. You do not need to install anything again.

## Common problems

| Problem | Fix |
|---------|-----|
| "The API key was rejected" | Check `.env`. There should be no spaces or quotes around the key, and the file must be in the same folder as `main.py` |
| "Rate limit reached" | The free tier has per-minute limits. Wait a minute and try again |
| Formulas show as plain text | Maths loads from a CDN, so you need internet. Also hard-refresh the page with Ctrl+Shift+R |
| Image questions fail | The vision model name may have changed, see the optional note in Step 5 |
| `python` or `git` not recognised on Windows | Reinstall Python and tick "Add to PATH", then open a new terminal |

## Limitations

- Needs an internet connection (the model runs on Groq, and the libraries load from CDNs)
- The free Groq tier has rate limits
- Images are not saved in the database, so the bot only sees an image in the message it was attached to
- An attached text file is sent as part of the message, so it also shows up in the saved history
- PDFs cannot be attached yet. Copy the text or attach a screenshot instead
- There is no login. Chats are tied to the browser they were created in

## Possible improvements

- Export a chat as a PDF
- Flashcards generated from a conversation
- Voice input
- User accounts

## Credits

- Groq for the API, OpenAI for the `gpt-oss-20b` model
- FastAPI, Uvicorn and python-dotenv
- marked, DOMPurify and KaTeX, all open source