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
    let isMuted = false; // Tracks mute state

    const languageData = {
        // Language Data (No changes here)
        en: {
            placeholder: "Enter your question...",
            chatbotTitle: "Opioid Awareness Chatbot",
            botMessage: "Welcome to the Opioid Awareness Chatbot! Here you will learn all about opioids!",
            listeningMessage: "Listening...",
            thinkingMessage: "Thinking...",
            systemMessages: {
                stopListening: "I have been asked to stop listening.",
                stopTalking: "I have been asked to stop talking.",
                noSpeech: "Recognition error: no speech",
                aborted: "Recognition error: aborted"
            },
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
        es: {
            placeholder: "Ingresa tu pregunta...",
            chatbotTitle: "Chatbot de Concientización sobre los Opioides",
            botMessage: "¡Bienvenido al Chatbot de Concientización sobre los Opioides! ¡Aquí aprenderás todo sobre los opioides!",
            listeningMessage: "Escuchando...",
            thinkingMessage: "Pensando...",
            systemMessages: {
                stopListening: "Se me ha pedido que deje de escuchar.",
                stopTalking: "Se me ha pedido que deje de hablar.",
                noSpeech: "Error de reconocimiento: sin voz",
                aborted: "Error de reconocimiento: cancelado"
            },
            titles: {
                home: "Inicio",
                language: "Preferencias de idioma",
                feedback: "Comentarios",
                resources: "Recursos",
                exit: "Salir",
                send: "Enviar tu mensaje",
                voice: "Haz tu pregunta con la voz"
            }
        },
        // Add other languages here (fr, zh, etc.)
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
        if (!text.trim() || isMuted) return; // Silent when muted
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = currentLanguage;
        utterance.onend = () => {
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
            body: JSON.stringify({
                question: text,
                language: currentLanguage
            }),
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
        };

        recognition.onresult = (event) => {
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

            recognition.stop();
        };

        recognition.onerror = (event) => {
            if (event.error === "no-speech") {
                appendMessage("bot", languageData[currentLanguage].systemMessages.noSpeech);
            } else if (event.error === "aborted") {
                appendMessage("bot", languageData[currentLanguage].systemMessages.aborted);
            } else {
                appendMessage("bot", "Recognition Error: " + event.error);
            }
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
        if (synth.speaking || usingVoice) {
            if (synth.speaking) synth.cancel();
            if (recognition) recognition.abort();
            usingVoice = false;
            return;
        }

        usingVoice = true;
            appendMessage("bot", languageData[currentLanguage].listeningMessage);
            startVoiceRecognition();
        };
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

    // Volume/Mute toggle functionality
    const volumeToggle = document.getElementById("volume-toggle");
    const volumeIcon = document.getElementById("volume-icon");

    if (volumeToggle && volumeIcon) {
        volumeToggle.addEventListener("click", () => {
            isMuted = !isMuted;
            if (isMuted) {
                volumeIcon.src = "/static/images/mute.png";
                volumeToggle.title = "Unmute";
                synth.cancel(); // stop voice if currently speaking
            } else {
                volumeIcon.src = "/static/images/volume.png";
                volumeToggle.title = "Mute";
            }
        });
    }
});
