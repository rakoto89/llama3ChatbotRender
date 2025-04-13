document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const beep = new Audio("/static/beep2.mp3");

    let recognition;
    let usingVoice = false;
    const synth = window.speechSynthesis;
    let currentLanguage = localStorage.getItem("selectedLanguage") || 'en';
    let isMuted = false;
    let isBotSpeaking = false;

    const languageData = {
        // (Language data unchanged for brevity — keep your existing full definitions)
    };

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (sender === "bot" && usingVoice) speakText(message);
        if (sender === "bot" && !usingVoice) speakText(message);
    }

    function speakText(text, callback) {
        if (!text.trim() || isMuted) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = currentLanguage;

        isBotSpeaking = true;
        utterance.onend = () => {
            isBotSpeaking = false;
            if (callback) callback();
        };

        synth.speak(utterance);
    }

    function sendMessage(text) {
        if (!text.trim()) return;

        appendMessage("user", text);
        userInput.value = "";
        appendMessage("bot", languageData[currentLanguage].thinkingMessage);

        fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text, language: currentLanguage }),
        })
        .then(res => res.json())
        .then(data => {
            document.querySelector(".bot-message:last-child").remove();
            const response = data.answer || "Error: Could not get a response.";
            appendMessage("bot", response);
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

        recognition.onstart = () => {
            beep.play();
        };

        recognition.onresult = (event) => {
            if (isBotSpeaking) return;

            const transcript = event.results[0][0].transcript;
            appendMessage("user", transcript);

            const lastBotMessage = document.querySelector(".bot-message:last-child");
            if (lastBotMessage && lastBotMessage.textContent === languageData[currentLanguage].listeningMessage) {
                lastBotMessage.remove();
            }

            appendMessage("bot", languageData[currentLanguage].thinkingMessage);

            fetch("/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: transcript, language: currentLanguage })
            })
            .then(res => res.json())
            .then(data => {
                document.querySelector(".bot-message:last-child").remove();
                const response = data.answer || "Error: Could not get a response.";
                appendMessage("bot", response);
            })
            .catch(err => {
                document.querySelector(".bot-message:last-child").remove();
                appendMessage("bot", "Fetch Error: " + err);
            });
        };

        recognition.onerror = (event) => {
            const sysMsgs = languageData[currentLanguage].systemMessages;
            if (event.error === "no-speech") {
                appendMessage("bot", sysMsgs.noSpeech);
            } else if (event.error === "aborted") {
                appendMessage("bot", sysMsgs.aborted);
            } else {
                appendMessage("bot", "Recognition Error: " + event.error);
            }
        };

        recognition.onend = () => {
            usingVoice = false;
        };

        recognition.start();

        // Force stop recognition after 20 seconds
        setTimeout(() => {
            if (recognition) {
                recognition.stop();
            }
        }, 20000); // 20 seconds
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
        if (synth.speaking || usingVoice) {
            if (synth.speaking) synth.cancel();
            if (recognition) recognition.abort();
            usingVoice = false;
            return;
        }

        usingVoice = true;
        appendMessage("bot", languageData[currentLanguage].listeningMessage);
        beep.play();

        if (currentLanguage === 'zh') {
            setTimeout(() => {
                startVoiceRecognition();
            }, 6000);
        } else {
            startVoiceRecognition();
        }
    });

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

    document.querySelector(".chat-header").textContent = languageData[currentLanguage].chatbotTitle;
    userInput.placeholder = languageData[currentLanguage].placeholder;
    document.querySelector(".bot-message").textContent = languageData[currentLanguage].botMessage;

    document.querySelector('[title="Home"]').title = languageData[currentLanguage].titles.home;
    document.querySelector('[title="Language Preferences"]').title = languageData[currentLanguage].titles.language;
    document.querySelector('[title="Feedback"]').title = languageData[currentLanguage].titles.feedback;
    document.querySelector('[title="Resources"]').title = languageData[currentLanguage].titles.resources;
    document.querySelector('[title="Exit"]').title = languageData[currentLanguage].titles.exit;
    sendBtn.title = languageData[currentLanguage].titles.send;
    voiceBtn.title = languageData[currentLanguage].titles.voice;
});
