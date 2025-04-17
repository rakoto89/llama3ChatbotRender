document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-speaking-btn");
    const beep = document.getElementById("beep");

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
        es: {
            placeholder: "Escribe tu pregunta...",
            chatbotTitle: "Chatbot de Conciencia sobre los Opioides",
            botMessage: "¡Bienvenido al Chatbot de Conciencia sobre los Opioides! ¡Aquí aprenderás todo sobre los opioides!",
            listeningMessage: "Escuchando...",
            thinkingMessage: "Pensando...",
            titles: {
                home: "Inicio",
                language: "Preferencias de idioma",
                feedback: "Comentarios",
                resources: "Recursos",
                exit: "Salir",
                send: "Enviar tu mensaje",
                voice: "Pregunta usando tu voz"
            }
        },
        fr: {
            placeholder: "Entrez votre question...",
            chatbotTitle: "Chatbot de Sensibilisation aux Opioïdes",
            botMessage: "Bienvenue sur le Chatbot de Sensibilisation aux Opioïdes ! Ici, vous apprendrez tout sur les opioïdes !",
            listeningMessage: "Écoute...",
            thinkingMessage: "Réflexion...",
            titles: {
                home: "Accueil",
                language: "Préférences linguistiques",
                feedback: "Retour",
                resources: "Ressources",
                exit: "Quitter",
                send: "Envoyez votre message",
                voice: "Demandez avec votre voix"
            }
        },
        zh: {
            placeholder: "输入您的问题...",
            chatbotTitle: "阿片类药物意识聊天机器人",
            botMessage: "欢迎使用阿片类药物意识聊天机器人！在这里，您将了解有关阿片类药物的所有信息！",
            listeningMessage: "正在聆听...",
            thinkingMessage: "正在思考...",
            titles: {
                home: "主页",
                language: "语言偏好",
                feedback: "反馈",
                resources: "资源",
                exit: "退出",
                send: "发送您的消息",
                voice: "使用语音提问"
            }
        }
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
        synth.cancel();
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
            if (usingVoice && !recognition.aborted) {
                recognition.start();
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
            usingVoice = false;
            voiceBtn.classList.remove("voice-active");

            if (synth.speaking || isBotSpeaking) {
                synth.cancel();
                isBotSpeaking = false;
            }

            if (recognition) {
                recognition.abort();
            }

            const botMessages = document.querySelectorAll(".bot-message");
            botMessages.forEach(msg => {
                if (
                    msg.textContent === languageData[currentLanguage].listeningMessage ||
                    msg.textContent === languageData[currentLanguage].thinkingMessage
                ) {
                    msg.remove();
                }
            });

            if (finalTranscript.trim()) {
                userInput.value = finalTranscript.trim();
            }

            finalTranscript = "";
        } else {
            if (synth.speaking || isBotSpeaking) {
                synth.cancel();
                isBotSpeaking = false;
            }

            usingVoice = true;
            finalTranscript = "";

            // Delay for Chinese
            if (currentLanguage === 'zh') {
                appendMessage("bot", languageData[currentLanguage].listeningMessage);
                setTimeout(() => {
                    voiceBtn.classList.add("voice-active");
                    beep.currentTime = 0;
                    beep.volume = 1.0;
                    beep.play().catch(err => console.warn("Beep failed:", err));
                    startContinuousRecognition();
                }, 5000);
            } else {
                voiceBtn.classList.add("voice-active");
                beep.currentTime = 0;
                beep.volume = 1.0;
                beep.play().catch(err => console.warn("Beep failed:", err));
                appendMessage("bot", languageData[currentLanguage].listeningMessage);
                startContinuousRecognition();
            }
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

    if (stopBtn) {
        stopBtn.addEventListener("click", () => {
            if (synth.speaking || isBotSpeaking) {
                synth.cancel();
                isBotSpeaking = false;
            }

            if (recognition && usingVoice) {
                recognition.abort();
                usingVoice = false;
            }

            const botMessages = document.querySelectorAll(".bot-message");
            botMessages.forEach(msg => {
                if (
                    msg.textContent === languageData[currentLanguage].listeningMessage ||
                    msg.textContent === languageData[currentLanguage].thinkingMessage
                ) {
                    msg.remove();
                }
            });

            userInput.value = "";
            finalTranscript = "";
            voiceBtn.classList.remove("voice-active");
        });
    }
});
