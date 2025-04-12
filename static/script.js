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
                noSpeech: "Recognition error: no speech",
                aborted: "Recognition error: aborted"
            },
            titles: {
                home: "Home",
                language: "Language Preferences",
                feedback: "Feedback",
                resources: "Resources",
                exit: "Exit"
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
                exit: "Salir"
            }
        },
        fr: {
            placeholder: "Entrez votre question...",
            chatbotTitle: "Chatbot de Sensibilisation aux Opioïdes",
            botMessage: "Bienvenue dans le chatbot de sensibilisation aux opioïdes ! Ici, vous apprendrez tout sur les opioïdes !",
            listeningMessage: "Écoute...",
            thinkingMessage: "En réflexion...",
            systemMessages: {
                stopListening: "On m'a demandé d'arrêter d'écouter.",
                stopTalking: "On m'a demandé d'arrêter de parler.",
                noSpeech: "Erreur de reconnaissance : aucun discours détecté",
                aborted: "Erreur de reconnaissance : annulée"
            },
            titles: {
                home: "Accueil",
                language: "Préférences linguistiques",
                feedback: "Commentaires",
                resources: "Ressources",
                exit: "Quitter"
            }
        },
        zh: {
            placeholder: "输入您的问题...",
            chatbotTitle: "阿片类药物意识聊天机器人",
            botMessage: "欢迎使用阿片类药物意识聊天机器人！在这里，您将学习所有关于阿片类药物的知识！",
            listeningMessage: "倾听...",
            thinkingMessage: "思考中...",
            systemMessages: {
                stopListening: "我被要求停止聆听。",
                stopTalking: "我被要求停止说话。",
                noSpeech: "识别错误：无语音输入",
                aborted: "识别错误：已中止"
            },
            titles: {
                home: "首页",
                language: "语言偏好",
                feedback: "反馈",
                resources: "资源",
                exit: "退出"
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
    }

    function speakText(text, callback) {
        if (!text.trim()) return;
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
            if (usingVoice) speakText(response);
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
                speakText(response);
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

    // ✅ Voice button toggle logic updated
    voiceBtn.addEventListener("click", () => {
        if (synth.speaking || usingVoice) {
            if (synth.speaking) synth.cancel();
            if (recognition) recognition.abort();
            usingVoice = false;
            appendMessage("bot", languageData[currentLanguage].systemMessages.aborted);
            return;
        }

        usingVoice = true;
        appendMessage("bot", languageData[currentLanguage].listeningMessage);
        beep.play();
        beep.onended = () => {
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
});
