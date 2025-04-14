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
        en: {
            placeholder: "Enter your question...",
            chatbotTitle: "Opioid Awareness Chatbot",
            botMessage: "Welcome to the Opioid Awareness Chatbot! Here you will learn all about opioids!",
            listeningMessage: "Listening...",
            thinkingMessage: "Thinking...",
            systemMessages: {
                stopListening: "I have been asked to stop listening.",
                stopTalking: "I have been asked to stop talking.",
                noSpeech: "I'm sorry, I didn't hear that",
                aborted: "Conversation ended"
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
                noSpeech: "Lo siento, no escuché eso",
                aborted: "La conversación terminó"
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
        fr: {
            placeholder: "Entrez votre question...",
            chatbotTitle: "Chatbot de sensibilisation aux opioïdes",
            botMessage: "Bienvenue sur le Chatbot de sensibilisation aux opioïdes ! Ici, vous apprendrez tout sur les opioïdes !",
            listeningMessage: "Écoute...",
            thinkingMessage: "Réflexion...",
            systemMessages: {
                stopListening: "On m'a demandé d'arrêter d'écouter.",
                stopTalking: "On m'a demandé d'arrêter de parler.",
                noSpeech: "Je suis désolé, je n'ai pas compris",
                aborted: "Conversation terminée"
            },
            titles: {
                home: "Accueil",
                language: "Préférences linguistiques",
                feedback: "Retour d'information",
                resources: "Ressources",
                exit: "Quitter",
                send: "Envoyez votre message",
                voice: "Posez une question avec votre voix"
            }
        },
        zh: {
            placeholder: "输入您的问题...",
            chatbotTitle: "阿片类药物意识聊天机器人",
            botMessage: "欢迎使用阿片类药物意识聊天机器人！在这里，您将了解有关阿片类药物的所有信息！",
            listeningMessage: "正在聆听...",
            thinkingMessage: "正在思考...",
            systemMessages: {
                stopListening: "我被要求停止聆听。",
                stopTalking: "我被要求停止说话。",
                noSpeech: "抱歉，我沒聽清楚",
                aborted: "談話結束"
            },
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
            if (!isMuted) {
                beep.play();
            }
        };

        recognition.onresult = (event) => {
            if (isBotSpeaking) {
                return;
            }

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
            const msg = languageData[currentLanguage].systemMessages[event.error] || "Recognition Error: " + event.error;
            appendMessage("bot", msg);
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

        if (currentLanguage === 'zh') {
            usingVoice = true;
            appendMessage("bot", languageData[currentLanguage].listeningMessage);
            setTimeout(() => {
                startVoiceRecognition();
            }, 5000);
        } else {
            usingVoice = true;
            appendMessage("bot", languageData[currentLanguage].listeningMessage);
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
