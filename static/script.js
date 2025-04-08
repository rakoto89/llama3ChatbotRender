document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const cancelVoiceBtn = document.getElementById("cancel-voice-btn");

    let recognition;
    let isSpeaking = false;
    let usingVoice = false;
    const synth = window.speechSynthesis;
    let silenceTimeout;
    let lastInputWasKeyboard = false;
    let currentLanguage = 'en';

    const languageData = {
        en: { botMessage: "Welcome to the Opioid Awareness Chatbot! Here you will learn all about opioids!", chatbotTitle: "Opioid Awareness Chatbot", placeholder: "Enter your question...", thinkingMessage: "Thinking...", voiceMessage: "Listening...", errorMessage: "Error: Could not get a response.", feedback: "Feedback", resources: "Resources", home: "Home", language: "Language Preferences", exit: "Exit" },
        es: { botMessage: "¡Bienvenido al Chatbot de Concientización sobre los Opioides! ¡Aquí aprenderás todo sobre los opioides!", chatbotTitle: "Chatbot de Concientización sobre los Opioides", placeholder: "Ingresa tu pregunta...", thinkingMessage: "Pensando...", voiceMessage: "Escuchando...", errorMessage: "Error: No se pudo obtener una respuesta.", feedback: "Retroalimentación", resources: "Recursos", home: "Inicio", language: "Preferencias de Idioma", exit: "Salir" },
        fr: { botMessage: "Bienvenue dans le chatbot de sensibilisation aux opioïdes ! Ici, vous apprendrez tout sur les opioïdes !", chatbotTitle: "Chatbot de Sensibilisation aux Opioïdes", placeholder: "Entrez votre question...", thinkingMessage: "En réflexion...", voiceMessage: "Écoute...", errorMessage: "Erreur : Impossible d'obtenir une réponse.", feedback: "Retour d'information", resources: "Ressources", home: "Accueil", language: "Préférences linguistiques", exit: "Sortie" },
        zh: { botMessage: "欢迎使用阿片类药物意识聊天机器人！在这里，您将学习所有关于阿片类药物的知识！", chatbotTitle: "阿片类药物意识聊天机器人", placeholder: "输入您的问题...", thinkingMessage: "思考中...", voiceMessage: "正在监听...", errorMessage: "错误：无法获取响应。", feedback: "反馈", resources: "资源", home: "首页", language: "语言偏好", exit: "退出" }
    };

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (sender === "bot" && usingVoice && message === languageData[currentLanguage].voiceMessage) {
            speakResponse(message, () => {
                playBeep();
                startVoiceRecognition();
            });
        }
    }

    function removePreviousThinkingMessage() {
        const last = document.querySelector(".bot-message:last-child");
        if (last && last.textContent === languageData[currentLanguage].thinkingMessage) {
            last.remove();
        }
    }

    function sendMessage(text, useVoice = false) {
        if (!text.trim()) return;

        appendMessage("user", text);
        userInput.value = "";

        removePreviousThinkingMessage();
        const thinkingMsg = document.createElement("div");
        thinkingMsg.classList.add("bot-message");
        thinkingMsg.textContent = languageData[currentLanguage].thinkingMessage;
        chatBox.appendChild(thinkingMsg);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (useVoice) speakResponse(languageData[currentLanguage].thinkingMessage);

        fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text }),
        })
            .then(res => res.json())
            .then(data => {
                removePreviousThinkingMessage();
                appendMessage("bot", data.answer);
                if (useVoice) speakResponse(data.answer);
            })
            .catch(() => {
                removePreviousThinkingMessage();
                appendMessage("bot", languageData[currentLanguage].errorMessage);
            });
    }

    function speakResponse(text, callback) {
        if ("speechSynthesis" in window) {
            const cleanText = text.replace(/<br\s*\/?>/g, " ");
            if (!cleanText.trim()) return;

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = currentLanguage;
            utterance.onend = () => {
                isSpeaking = false;
                if (callback) callback();
            };
            synth.speak(utterance);
            isSpeaking = true;
        }
    }

    function startVoiceRecognition() {
        if ("webkitSpeechRecognition" in window) {
            recognition = new webkitSpeechRecognition();
            recognition.lang = currentLanguage;
            recognition.continuous = true;
            recognition.interimResults = false;

            recognition.onresult = (event) => {
                clearTimeout(silenceTimeout);
                const transcript = event.results[event.results.length - 1][0].transcript;
                silenceTimeout = setTimeout(() => {
                    sendMessage(transcript, true);
                    recognition.stop();
                    usingVoice = false;
                }, 1500);
            };

            recognition.onerror = () => {
                appendMessage("bot", languageData[currentLanguage].errorMessage);
                usingVoice = false;
            };

            recognition.onend = () => {
                clearTimeout(silenceTimeout);
                if (usingVoice) {
                    appendMessage("bot", "Voice input ended. Please try again.");
                    usingVoice = false;
                }
            };

            recognition.start();
        } else {
            alert("Voice recognition is not supported in this browser.");
        }
    }

    function playBeep() {
        const beep = new Audio("/static/beep2.mp3");
        beep.play();
    }

    function changeLanguage(language) {
        currentLanguage = language;

        document.querySelector('.chat-header').textContent = languageData[language].chatbotTitle;
        document.getElementById("user-input").placeholder = languageData[language].placeholder;
        document.querySelector(".bot-message").textContent = languageData[language].botMessage;

        document.querySelectorAll('.sidebar-icon[title="Home"]')[0].alt = languageData[language].home;
        document.querySelectorAll('.sidebar-icon[title="Language Preferences"]')[0].alt = languageData[language].language;
        document.querySelectorAll('.sidebar-icon[title="Feedback"]')[0].alt = languageData[language].feedback;
        document.querySelectorAll('.sidebar-icon[title="Resources"]')[0].alt = languageData[language].resources;
        document.querySelectorAll('.sidebar-icon[title="Exit"]')[0].alt = languageData[language].exit;

        voiceBtn.setAttribute('title', languageData[language].voiceMessage);
    }

    // Add listeners
    sendBtn.addEventListener("click", () => sendMessage(userInput.value));
    userInput.addEventListener("keydown", e => {
        if (e.key === "Enter") sendMessage(userInput.value);
    });
    voiceBtn.addEventListener("click", () => {
        usingVoice = true;
        appendMessage("bot", languageData[currentLanguage].voiceMessage);
    });

    // ✅ Cancel Voice Listener (New Code Added)
    cancelVoiceBtn.addEventListener("click", () => {
        if (recognition && usingVoice) {
            recognition.abort(); // or recognition.stop();
            usingVoice = false;
            appendMessage("bot", "Voice input canceled.");
        }

        if (synth.speaking) {
            synth.cancel();
            isSpeaking = false;
            appendMessage("bot", "Speech synthesis canceled.");
        }
    });

    // Language toggle button
    document.getElementById("lang-btn").addEventListener("click", () => {
        const langOptions = document.getElementById("language-options");
        langOptions.style.display = langOptions.style.display === "block" ? "none" : "block";
    });

    // Language selection buttons
    document.querySelectorAll("#language-options button").forEach(button => {
        button.addEventListener("click", () => {
            changeLanguage(button.getAttribute("data-lang"));
            document.getElementById("language-options").style.display = "none";
        });
    });
});
