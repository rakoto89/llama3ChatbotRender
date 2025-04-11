document.addEventListener("DOMContentLoaded", function () {
  const chatBox = document.getElementById("chat-box");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const voiceBtn = document.getElementById("voice-btn");
  const cancelVoiceBtn = document.getElementById("cancel-voice-btn");

  let recognition;
  let usingVoice = false;
  const synth = window.speechSynthesis;
  let currentLanguage = localStorage.getItem("selectedLanguage") || "en";

  const languageData = {
    en: { placeholder: "Enter your question...", thinkingMessage: "Thinking..." },
    es: { placeholder: "Ingresa tu pregunta...", thinkingMessage: "Pensando..." },
    fr: { placeholder: "Entrez votre question...", thinkingMessage: "En réflexion..." },
    zh: { placeholder: "输入您的问题...", thinkingMessage: "思考中..." }
  };

  function appendMessage(sender, message) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
    msgDiv.innerHTML = message;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function sendMessage(text) {
    if (!text.trim()) return;

    appendMessage("user", text);
    userInput.value = "";

    appendMessage("bot", languageData[currentLanguage].thinkingMessage);

    fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: text,
        language: currentLanguage
      }),
    })
    .then(res => res.json())
    .then(data => {
      document.querySelector(".bot-message:last-child").remove();
      appendMessage("bot", data.answer || "Error: Could not get a response.");
    })
    .catch(() => {
      document.querySelector(".bot-message:last-child").remove();
      appendMessage("bot", "Error: Could not get a response.");
    });
  }

  function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      appendMessage("bot", "Voice recognition not supported.");
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = currentLanguage;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      appendMessage("user", transcript);

      fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: transcript, language: currentLanguage })
      })
      .then(res => res.json())
      .then(data => {
        appendMessage("bot", data.answer || "Error: Could not get a response.");
      })
      .catch(err => {
        appendMessage("bot", "Fetch Error: " + err);
      });

      recognition.stop();
    };

    recognition.onerror = (event) => {
      appendMessage("bot", "Recognition Error: " + event.error);
      recognition.stop();
    };

    recognition.onend = () => {
      usingVoice = false;
    };

    recognition.start();
  }

  sendBtn.addEventListener("click", () => {
    usingVoice = false;
    sendMessage(userInput.value);
  });

  userInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      usingVoice = false;
      sendMessage(userInput.value);
    }
  });

  voiceBtn.addEventListener("click", () => {
    usingVoice = true;
    appendMessage("bot", languageData[currentLanguage].thinkingMessage);
    startVoiceRecognition();
  });

  cancelVoiceBtn.addEventListener("click", () => {
    if (recognition && usingVoice) {
      recognition.abort();
      usingVoice = false;
      appendMessage("bot", "Voice input canceled.");
    }

    if (synth.speaking) {
      synth.cancel();
      appendMessage("bot", "Voice output canceled.");
    }
  });

  // Language preference dropdown
  const langBtn = document.getElementById("lang-btn");
  const langOptions = document.getElementById("language-options");

  if (langBtn && langOptions) {
    langBtn.addEventListener("click", () => {
      langOptions.style.display = langOptions.style.display === "block" ? "none" : "block";
    });

    document.querySelectorAll("#language-options button").forEach(button => {
      button.addEventListener("click", () => {
        const selectedLang = button.getAttribute("data-lang");
        localStorage.setItem("selectedLanguage", selectedLang);
        location.reload();
      });
    });
  }

  // Apply language on load
  document.getElementById("user-input").placeholder = languageData[currentLanguage].placeholder;
});
