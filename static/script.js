// script.js - frontend logic for Athena Zero
//
// How it works:
//  - Chat messages are saved by the backend (SQLite) and fetched with /history/<id>
//  - The list of chats (titles) and the settings are saved in the browser's localStorage
//  - To get a reply we send a POST request to /chat


// ====================================================
// 1. GET ELEMENTS FROM THE PAGE
// ====================================================
const sidebar = document.getElementById("sidebar");
const scrim = document.getElementById("scrim");
const chatList = document.getElementById("chatList");
const searchBox = document.getElementById("searchBox");
const chatTitle = document.getElementById("chatTitle");
const messagesBox = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const thread = document.getElementById("thread");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const settingsBox = document.getElementById("settingsBox");

// the small owl picture used next to bot messages
const OWL_ICON = '<svg><use href="#owl"/></svg>';

// true if the user turned off animations in their computer settings
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


// ====================================================
// 2. SAVED DATA (localStorage)
// ====================================================
function loadData(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    if (text === null) {
      return fallback;
    }
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // storage is full or blocked, nothing we can do
  }
}

let chats = loadData("athena.sessions", []);   // list of {id, title, updated}
let activeId = loadData("athena.active", null); // the chat that is open right now
let waiting = false;                            // true while waiting for a reply
let searchText = "";

// default settings, then overwritten by whatever the user saved before
const settings = { theme: "dark", size: "m", style: "balanced", temp: 0.8, instr: "" };
const savedSettings = loadData("athena.settings", {});
for (const key in savedSettings) {
  settings[key] = savedSettings[key];
}

function saveChats() {
  saveData("athena.sessions", chats);
  saveData("athena.active", activeId);
}


// ====================================================
// 3. SMALL HELPER FUNCTIONS
// ====================================================
function makeId() {
  return "chat-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// turn markdown text into safe HTML
function markdownToHtml(text) {
  if (window.marked && window.DOMPurify) {
    const html = marked.parse(text, { gfm: true, breaks: true });
    return DOMPurify.sanitize(html);
  }
  // if the libraries did not load (no internet), show plain text
  return "<p>" + escapeHtml(text).replace(/\n/g, "<br>") + "</p>";
}

function findChat(id) {
  for (let i = 0; i < chats.length; i++) {
    if (chats[i].id === id) {
      return chats[i];
    }
  }
  return null;
}

// chats sorted so the most recently used is first
function sortedChats() {
  return chats.slice().sort(function (a, b) {
    return b.updated - a.updated;
  });
}

function scrollToBottom(smooth) {
  messagesBox.scrollTo({
    top: messagesBox.scrollHeight,
    behavior: smooth && !reduceMotion ? "smooth" : "auto",
  });
}

// small helper to make a button
function makeButton(className, text, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.onclick = onClick;
  return button;
}


// ====================================================
// 4. LOADING SCREEN
// ====================================================
const bootScreen = document.getElementById("boot");
const bootText = document.getElementById("bootText");

function hideBoot() {
  bootScreen.classList.add("done");
}

// show a new line of text with a smooth fade:
// fade the old text out, swap the words, then fade the new text in
function changeBootText(newText) {
  bootText.classList.remove("show");       // fade out (0.6 seconds)
  setTimeout(function () {
    bootText.textContent = newText;
    bootText.classList.add("show");        // fade in (0.6 seconds)
  }, 600);
}

// timeline in milliseconds - change these numbers to speed up or slow down
setTimeout(function () { bootText.classList.add("show"); }, 1000);   // "Lighting the lamp" fades in
setTimeout(function () { changeBootText("AI can make mistakes. \nPlease double check its responses."); },1000);
setTimeout(function () { changeBootText("Ready"); }, 3200);
setTimeout(hideBoot, reduceMotion ? 300 : 5800);
bootScreen.onclick = hideBoot;   // click to skip


// ====================================================
// 5. SETTINGS
// ====================================================
const tempSlider = document.getElementById("tempSlider");
const tempValue = document.getElementById("tempValue");
const instrBox = document.getElementById("instrBox");

// apply the settings to the page and save them
function applySettings() {
  // theme (dark / light / follow the computer)
  let theme = settings.theme;
  if (theme === "system") {
    theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  document.documentElement.dataset.theme = theme;

  // text size
  const sizes = { s: "15px", m: "16px", l: "18px" };
  document.documentElement.style.fontSize = sizes[settings.size] || "16px";

  // highlight the selected button in every group
  document.querySelectorAll(".choice").forEach(function (group) {
    group.querySelectorAll("button").forEach(function (button) {
      const selected = settings[group.dataset.key] === button.dataset.value;
      button.classList.toggle("on", selected);
    });
  });

  tempSlider.value = settings.temp;
  tempValue.textContent = settings.temp;
  instrBox.value = settings.instr;

  saveData("athena.settings", settings);
}

// clicking a button inside the settings popup
document.querySelectorAll(".choice button").forEach(function (button) {
  button.onclick = function () {
    const key = button.parentElement.dataset.key;
    settings[key] = button.dataset.value;
    applySettings();
  };
});

tempSlider.oninput = function () {
  settings.temp = Number(tempSlider.value);
  tempValue.textContent = settings.temp;
  saveData("athena.settings", settings);
};

instrBox.oninput = function () {
  settings.instr = instrBox.value;
  saveData("athena.settings", settings);
};

document.getElementById("settingsBtn").onclick = function () {
  applySettings();
  settingsBox.showModal();
  closeSidebar();
};

// clicking the dark area outside the popup closes it
settingsBox.onclick = function (event) {
  if (event.target === settingsBox) {
    settingsBox.close();
  }
};

document.getElementById("themeBtn").onclick = function () {
  if (document.documentElement.dataset.theme === "dark") {
    settings.theme = "light";
  } else {
    settings.theme = "dark";
  }
  applySettings();
};

document.getElementById("deleteAllBtn").onclick = function () {
  if (!confirm("Delete every chat? This cannot be undone.")) {
    return;
  }
  chats.forEach(function (chat) {
    fetch("/history/" + encodeURIComponent(chat.id), { method: "DELETE" });
  });
  chats = [];
  newChat();
  settingsBox.close();
};


// ====================================================
// 6. SIDEBAR (list of chats)
// ====================================================
function showChatList() {
  chatList.textContent = "";   // clear the list

  // only keep chats that match the search box
  const list = sortedChats().filter(function (chat) {
    return chat.title.toLowerCase().includes(searchText);
  });

  if (list.length === 0) {
    const message = document.createElement("p");
    message.className = "list-empty";
    message.textContent = searchText ? "No chats match." : "No chats yet.";
    chatList.appendChild(message);
    return;
  }

  list.forEach(function (chat) {
    const row = document.createElement("div");
    row.className = "chat-item";
    if (chat.id === activeId) {
      row.classList.add("active");
    }
    row.dataset.id = chat.id;

    // the chat name (click = open, double click = rename)
    const nameButton = makeButton("chat-name", chat.title, "Open chat", function () {
      openChat(chat.id);
      closeSidebar();
    });
    nameButton.title = chat.title;
    nameButton.ondblclick = function () { startRename(chat.id); };

    const renameButton = makeButton("mini-btn", "✎", "Rename chat", function () {
      startRename(chat.id);
    });
    const deleteButton = makeButton("mini-btn", "×", "Delete chat", function () {
      deleteChat(chat.id);
    });

    row.append(nameButton, renameButton, deleteButton);
    chatList.appendChild(row);
  });
}

searchBox.oninput = function () {
  searchText = searchBox.value.trim().toLowerCase();
  showChatList();
};

// replace a chat row with a text box so the user can type a new name
function startRename(id) {
  const chat = findChat(id);
  const row = chatList.querySelector('[data-id="' + id + '"]');
  if (!chat || !row) {
    return;
  }

  const box = document.createElement("input");
  box.className = "rename-box";
  box.value = chat.title;
  box.maxLength = 60;

  let finished = false;
  function finish(save) {
    if (finished) {
      return;
    }
    finished = true;
    if (save && box.value.trim() !== "") {
      chat.title = box.value.trim();
    }
    if (id === activeId) {
      chatTitle.textContent = chat.title;
    }
    saveChats();
    showChatList();
  }

  box.onkeydown = function (event) {
    if (event.key === "Enter") {
      finish(true);
    }
    if (event.key === "Escape") {
      finish(false);
    }
  };
  box.onblur = function () { finish(true); };

  row.textContent = "";
  row.appendChild(box);
  box.focus();
  box.select();
}

// double click the title at the top to rename the open chat
chatTitle.ondblclick = function () {
  const chat = findChat(activeId);
  if (!chat) {
    return;
  }
  const newName = prompt("Rename chat:", chat.title);
  if (newName && newName.trim() !== "") {
    chat.title = newName.trim().slice(0, 60);
    chatTitle.textContent = chat.title;
    saveChats();
    showChatList();
  }
};

// sidebar open/close (phones slide it in and out, computers collapse it)
function openSidebar() {
  sidebar.classList.add("open");
  scrim.hidden = false;
}

function closeSidebar() {
  sidebar.classList.remove("open");
  scrim.hidden = true;
}

const app = document.querySelector(".app");

// the < button inside the sidebar
document.getElementById("closeBtn").onclick = function () {
  if (window.innerWidth > 820) {
    app.classList.add("collapsed");      // computer: hide the sidebar
  } else {
    closeSidebar();                      // phone: slide it away
  }
};

// the ☰ button at the top
document.getElementById("menuBtn").onclick = function () {
  if (window.innerWidth > 820) {
    app.classList.remove("collapsed");   // computer: show the sidebar again
  } else {
    openSidebar();                       // phone: slide it in
  }
};
scrim.onclick = closeSidebar;
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeSidebar();
  }
});


// ====================================================
// 7. CHATS (new, open, delete, export)
// ====================================================
function newChat() {
  activeId = null;
  thread.textContent = "";
  chatTitle.textContent = "New chat";
  welcome.hidden = false;
  saveChats();
  showChatList();
  input.focus();
}

// make a new chat entry when the first message is sent
function createChatIfNeeded(firstMessage) {
  if (activeId && findChat(activeId)) {
    return;
  }
  let title = firstMessage.replace(/\s+/g, " ").trim();
  if (title.length > 40) {
    title = title.slice(0, 40).trim() + "…";
  }
  activeId = makeId();
  chats.push({ id: activeId, title: title, updated: Date.now() });
  chatTitle.textContent = title;
}

// mark a chat as "just used" so it moves to the top
function touchChat(id) {
  const chat = findChat(id);
  if (chat) {
    chat.updated = Date.now();
  }
  saveChats();
  showChatList();
}

async function openChat(id) {
  activeId = id;
  const chat = findChat(id);
  chatTitle.textContent = chat ? chat.title : "New chat";
  thread.textContent = "";
  saveChats();
  showChatList();

  // ask the backend for the saved messages
  let messages = [];
  try {
    const response = await fetch("/history/" + encodeURIComponent(id));
    if (response.ok) {
      const data = await response.json();
      messages = data.messages || [];
    }
  } catch (error) {
    console.log("could not load history", error);
  }

  // the user may have clicked another chat while we were waiting
  if (activeId !== id) {
    return;
  }

  welcome.hidden = messages.length > 0;
  messages.forEach(function (m) {
    if (m.role === "user") {
      addMessage("user", m.content);
    } else {
      const msg = addMessage("bot");
      msg.body.innerHTML = markdownToHtml(m.content);
      addCopyButtons(msg.body);
      addCopyReply(msg.content, m.content);
    }
  });
  scrollToBottom(false);
}

function deleteChat(id) {
  if (!confirm("Delete this chat?")) {
    return;
  }
  chats = chats.filter(function (chat) {
    return chat.id !== id;
  });
  fetch("/history/" + encodeURIComponent(id), { method: "DELETE" });

  if (id === activeId) {
    if (chats.length > 0) {
      openChat(sortedChats()[0].id);
    } else {
      newChat();
    }
  }
  saveChats();
  showChatList();
}

document.getElementById("newChatBtn").onclick = function () {
  newChat();
  closeSidebar();
};

// download the open chat as a .md file
document.getElementById("exportBtn").onclick = function () {
  const parts = [];
  thread.querySelectorAll(".msg").forEach(function (msg) {
    const who = msg.classList.contains("user") ? "**You:** " : "**Athena Zero:** ";
    parts.push(who + msg.querySelector(".body").innerText.trim());
  });
  if (parts.length === 0) {
    return;
  }

  const fileText = "# " + chatTitle.textContent + "\n\n" + parts.join("\n\n");
  const fileName = chatTitle.textContent.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") + ".md";

  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([fileText], { type: "text/markdown" }));
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};


// ====================================================
// 8. MESSAGES
// ====================================================
// adds a message bubble to the page. kind is "user" or "bot"
function addMessage(kind, text) {
  const row = document.createElement("article");
  row.className = "msg " + kind;

  const body = document.createElement("div");
  body.className = "body";
  let content = null;

  if (kind === "user") {
    body.textContent = text;
    row.appendChild(body);
  } else {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.innerHTML = OWL_ICON;

    content = document.createElement("div");
    content.className = "content";
    content.appendChild(body);

    row.append(avatar, content);
  }

  thread.appendChild(row);
  return { row: row, body: body, content: content };
}

// "Copy reply" button under a bot message
function addCopyReply(content, text) {
  if (content.querySelector(".reply-actions")) {
    return;
  }
  const box = document.createElement("div");
  box.className = "reply-actions";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Copy reply";
  button.onclick = async function () {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
    } catch (error) {
      button.textContent = "Could not copy";
    }
    setTimeout(function () { button.textContent = "Copy reply"; }, 1400);
  };

  box.appendChild(button);
  content.appendChild(box);
}

// adds a "Copy" button to every code block and makes links open in a new tab
function addCopyButtons(element) {
  element.querySelectorAll("pre").forEach(function (pre) {
    if (pre.querySelector(".copy-btn")) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-btn";
    button.textContent = "Copy";
    button.onclick = async function () {
      const code = pre.querySelector("code");
      const text = code ? code.innerText : pre.innerText;
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied";
      } catch (error) {
        button.textContent = "Select and copy";
      }
      setTimeout(function () { button.textContent = "Copy"; }, 1400);
    };
    pre.prepend(button);
  });

  element.querySelectorAll("a").forEach(function (link) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
}

// shows the reply a few words at a time (typing effect). Click on it to skip.
function typeOut(element, text, whenDone) {
  const words = text.split(/(\s+)/);   // the brackets keep the spaces too
  let finished = false;
  let timer = null;

  function showEverything() {
    if (finished) {
      return;
    }
    finished = true;
    clearInterval(timer);
    element.innerHTML = markdownToHtml(text);
    addCopyButtons(element);
    scrollToBottom(true);
    whenDone();
  }

  // short replies or reduced motion: no typing effect
  if (reduceMotion || words.length < 8) {
    showEverything();
    return;
  }

  let shown = 0;
  const step = Math.ceil(words.length / 70);   // so long replies do not take forever
  element.onclick = showEverything;

  timer = setInterval(function () {
    shown = shown + step;
    if (shown >= words.length) {
      showEverything();
    } else {
      element.innerHTML = markdownToHtml(words.slice(0, shown).join(""));
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
  }, 25);
}

// turns an error into a message the user can understand
function errorMessage(error, status, data) {
  if (error instanceof TypeError) {
    return "Can't reach the server. Check that uvicorn is still running in the terminal.";
  }
  if (status === 429) {
    return "Rate limit reached. Wait a minute, then send again.";
  }
  if (status === 401 || status === 403) {
    return "The API key was rejected. Check GROQ_API_KEY in your .env file.";
  }
  if (data && data.detail) {
    return data.detail;
  }
  return "The server hit an error. The terminal running uvicorn shows what happened.";
}

const thinkingWords = ["Thinking", "Consulting the scrolls", "Writing it down"];

// send the message to the backend and show the reply
async function askServer(text) {
  const chatId = activeId;
  setWaiting(true);

  // placeholder message: "Thinking..." with a flipping owl
  const msg = addMessage("bot");
  msg.body.innerHTML = '<div class="thinking">' + OWL_ICON + "<span></span></div>";
  const label = msg.body.querySelector("span");
  let n = 0;
  label.textContent = thinkingWords[0];
  const wordTimer = setInterval(function () {
    n = n + 1;
    label.textContent = thinkingWords[n % thinkingWords.length];
  }, 2000);
  scrollToBottom(true);

  let status = 0;
  let data = null;
  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: chatId,
        message: text,
        style: settings.style,
        instructions: settings.instr,
        temperature: settings.temp,
      }),
    });
    status = response.status;
    data = await response.json().catch(function () { return null; });

    if (!response.ok || !data || typeof data.reply !== "string") {
      throw new Error("bad response");
    }

    clearInterval(wordTimer);
    typeOut(msg.body, data.reply, function () {
      setWaiting(false);
      addCopyReply(msg.content, data.reply);
    });
  } catch (error) {
    // something went wrong: show the error and a retry button
    clearInterval(wordTimer);
    msg.body.textContent = "";

    const errorText = document.createElement("p");
    errorText.className = "error-text";
    errorText.textContent = "Couldn't get a reply. " + errorMessage(error, status, data);

    const retryButton = makeButton("retry-btn", "Send again", "Send again", function () {
      msg.row.remove();
      askServer(text);
    });

    msg.body.append(errorText, retryButton);
    setWaiting(false);
  }

  touchChat(chatId);
}

// disable the send button while waiting for a reply
function setWaiting(value) {
  waiting = value;
  sendBtn.disabled = value;
  if (!value) {
    input.focus();
  }
}

function sendMessage() {
  const text = input.value.trim();
  if (waiting || text === "") {
    return;
  }
  createChatIfNeeded(text);
  welcome.hidden = true;
  addMessage("user", text);

  input.value = "";
  resizeInput();
  showChatList();
  askServer(text);
}

// make the text box grow as the user types (up to 160px)
function resizeInput() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
}

input.addEventListener("input", resizeInput);
input.addEventListener("keydown", function (event) {
  // Enter = send, Shift+Enter = new line
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
});
sendBtn.onclick = sendMessage;


// ====================================================
// 9. START THE APP
// ====================================================
applySettings();
showChatList();

if (activeId && findChat(activeId)) {
  openChat(activeId);
} else {
  activeId = null;
  welcome.hidden = false;
}
input.focus();