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
    let currentLanguage = 'en';

    const languageData = {
        en: {
            botMessage: "Welcome to the Opioid Awareness Chatbot! Here you will learn all about opioids!",
            chatbotTitle: "Opioid Awareness Chatbot",
            placeholder: "Enter your question...",
            thinkingMessage: "Thinking...",
            voiceMessage: "Listening...",
            errorMessage: "Error: Could not get a response.",
            feedback: "Feedback",
            resources: "Resources",
            home: "Home",
            language: "Language Preferences",
            exit: "Exit"
        },
        es: {
            botMessage: "¡Bienvenido al Chatbot de Concientización sobre los Opioides! ¡Aquí aprenderás todo sobre los opioides!",
            chatbotTitle: "Chatbot de Concientización sobre los Opioides",
            placeholder: "Ingresa tu pregunta...",
            thinkingMessage: "Pensando...",
            voiceMessage: "Escuchando...",
            errorMessage: "Error: No se pudo obtener una respuesta.",
            feedback: "Retroalimentación",
            resources: "Recursos",
            home: "Inicio",
            language: "Preferencias de Idioma",
            exit: "Salir"
        },
        fr: {
            botMessage: "Bienvenue dans le chatbot de sensibilisation aux opioïdes ! Ici, vous apprendrez tout sur les opioïdes !",
            chatbotTitle: "Chatbot de Sensibilisation aux Opioïdes",
            placeholder: "Entrez votre question...",
            thinkingMessage: "En réflexion...",
            voiceMessage: "Écoute...",
            errorMessage: "Erreur : Impossible d'obtenir une réponse.",
            feedback: "Retour d'information",
            resources: "Ressources",
            home: "Accueil",
            language: "Préférences linguistiques",
            exit: "Sortie"
        },
        zh: {
            botMessage: "欢迎使用阿片类药物意识聊天机器人！在这里，您将学习所有关于阿片类药物的知识！",
            chatbotTitle: "阿片类药物意识聊天机器人",
            placeholder: "输入您的问题...",
            thinkingMessage: "思考中...",
            voiceMessage: "正在监听...",
            errorMessage: "错误：无法获取响应。",
            feedback: "反馈",
            resources: "资源",
            home: "首页",
            language: "语言偏好",
            exit: "退出"
        }
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
            body: JSON.stringify({
                question: text,
                language: currentLanguage
            }),
        })
            .then(res => res.json())
            .then(data => {
                removePreviousThinkingMessage();

                let answer = data.answer?.trim();
                if (!answer || answer.toLowerCase() === "no response.") {
                    answer = languageData[currentLanguage].errorMessage;
                }

                appendMessage("bot", answer);
                if (useVoice) speakResponse(answer);
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
                let transcript = "";

                try {
                    transcript = event.results[event.results.length - 1][0].transcript || "";
                } catch (e) {
                    console.error("Voice recognition error:", e);
                    transcript = "";
                }

                silenceTimeout = setTimeout(() => {
                    if (transcript.trim().length > 1) {
                        sendMessage(transcript, true);
                    } else {
                        appendMessage("bot", "Sorry, I didn’t catch that. Please try again.");
                    }
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
