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
    let finalTranscript = "";

    const languageData = {
        en: {
            placeholder: "Enter your question...",
            chatbotTitle: "Opioid Awareness Chatbot",
            botMessage: "Welcome to the Opioid Awareness Chatbot! Here you will learn all about opioids!",
            listeningMessage: "Listening...",
            thinkingMessage: "Thinking...",
            titles: {
                home: "Home",
                language: "Language Preferences",
                feedback: "Feedback",
                resources: "Resources",
                exit: "Exit",
                send: "Send your message",
                voice: "Ask using your voice"
            }
        },
        // Other languages omitted for brevity (they stay the same)
    };

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (sender === "bot") speakText(message);
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
            body: JSON.stringify({ question: text, language: currentLanguage })
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

    function startContinuousRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            appendMessage("bot", "Voice recognition not supported.");
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = currentLanguage;
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            finalTranscript = "";
            if (!isMuted) beep.play();
        };

        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + " ";
                }
            }
        };

        recognition.onerror = (event) => {
            console.error("Recognition error:", event.error);
        };

        recognition.onend = () => {
            if (usingVoice) {
                recognition.start(); // Keep listening
            }
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
        if (usingVoice) {
            // Stop and send
            usingVoice = false;
            recognition.stop();
            if (finalTranscript.trim()) {
                appendMessage("user", finalTranscript.trim());
                sendMessage(finalTranscript.trim());
            }
            finalTranscript = "";
        } else {
            usingVoice = true;
            appendMessage("bot", languageData[currentLanguage].listeningMessage);
            startContinuousRecognition();
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

    document.getElementById("send-btn").title = languageData[currentLanguage].titles.send;
    document.getElementById("voice-btn").title = languageData[currentLanguage].titles.voice;

    const volumeToggle = document.getElementById("volume-toggle");
    const volumeIcon = document.getElementById("volume-icon");

    if (volumeToggle && volumeIcon) {
        volumeToggle.addEventListener("click", () => {
            isMuted = !isMuted;
            if (isMuted) {
                volumeIcon.src = "/static/images/mute.png";
                volumeToggle.title = "Unmute";
                synth.cancel();
            } else {
                volumeIcon.src = "/static/images/volume.png";
                volumeToggle.title = "Mute";
            }
        });
    }
});
