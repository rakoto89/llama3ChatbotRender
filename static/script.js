document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-speaking-btn");
    const playPauseBtn = document.getElementById("play-pause-btn");
    const playPauseIcon = document.getElementById("play-pause-icon");
    const beep = document.getElementById("beep");

    let recognition;
    let usingVoice = false;
    const synth = window.speechSynthesis;
    let currentLanguage = localStorage.getItem("selectedLanguage") || "en";
    let isMuted = localStorage.getItem("isMuted") === "true";
    let isBotSpeaking = false;
    let finalTranscript = "";
    let lastSpokenText = "";
    let currentUtterance = null;
    let isPaused = false;

    const languageData = {
        en: {
            placeholder: "Enter your question...",
            chatbotTitle: "Opioid Awareness Chatbot",
            botMessage:
                "Welcome to the Opioid Awareness Chatbot! Here you will learn all about opioids!",
            listeningMessage: "Listening...",
            thinkingMessage: "Thinking...",
            titles: {
                home: "Home",
                language: "Language Preferences",
                feedback: "Feedback",
                resources: "Resources",
                exit: "Exit",
                send: "Send your message",
                voice: "Ask using your voice",
                stop: "Stop speaking",
                mute: "Mute",
                unmute: "Unmute",
                play: "Play",
                pause: "Pause"
            }
        },

        es: {
            placeholder: "Escribe tu pregunta...",
            chatbotTitle: "Chatbot de Conciencia sobre los Opioides",
            botMessage:
                "¡Bienvenido al Chatbot de Conciencia sobre los Opioides! ¡Aquí aprenderás todo sobre los opioides!",
            listeningMessage: "Escuchando...",
            thinkingMessage: "Pensando...",
            titles: {
                home: "Inicio",
                language: "Preferencias de idioma",
                feedback: "Comentarios",
                resources: "Recursos",
                exit: "Salir",
                send: "Enviar tu mensaje",
                voice: "Pregunta usando tu voz",
                stop: "Detener",
                mute: "Silenciar",
                unmute: "Reactivar sonido",
                play: "Reproducir",
                pause: "Pausa"
            }
        },

        fr: {
            placeholder: "Entrez votre question...",
            chatbotTitle: "Chatbot de Sensibilisation aux Opioïdes",
            botMessage:
                "Bienvenue sur le Chatbot de Sensibilisation aux Opioïdes ! Ici, vous apprendrez tout sur les opioïdes !",
            listeningMessage: "Écoute...",
            thinkingMessage: "Réflexion...",
            titles: {
                home: "Accueil",
                language: "Préférences linguistiques",
                feedback: "Retour",
                resources: "Ressources",
                exit: "Quitter",
                send: "Envoyez votre message",
                voice: "Demandez avec votre voix",
                stop: "Arrêter",
                mute: "Muet",
                unmute: "Rétablir le son",
                play: "Lecture",
                pause: "Pause"
            }
        },

        zh: {
            placeholder: "输入您的问题...",
            chatbotTitle: "阿片类药物意识聊天机器人",
            botMessage:
                "欢迎使用阿片类药物意识聊天机器人！在这里，您将了解有关阿片类药物的所有信息！",
            listeningMessage: "正在聆听...",
            thinkingMessage: "正在思考...",
            titles: {
                home: "主页",
                language: "语言偏好",
                feedback: "反馈",
                resources: "资源",
                exit: "退出",
                send: "发送您的消息",
                voice: "使用语音提问",
                stop: "停止",
                mute: "静音",
                unmute: "取消静音",
                play: "播放",
                pause: "暂停"
            }
        }
    };


    // =========================================================
    // SPEAK BOT RESPONSE
    // =========================================================

    function speakText(text, callback) {
        if (!text.trim() || isMuted) return;

        synth.cancel();

        lastSpokenText = text;

        currentUtterance = new SpeechSynthesisUtterance(text);

        const speechLanguages = {
            en: "en-US",
            es: "es-ES",
            fr: "fr-FR",
            zh: "zh-CN"
        };

        currentUtterance.lang =
            speechLanguages[currentLanguage] || "en-US";

        isBotSpeaking = true;

        currentUtterance.onend = () => {
            isBotSpeaking = false;
            currentUtterance = null;
            isPaused = false;

            if (playPauseIcon) {
                playPauseIcon.src = "/static/images/play.png";
            }

            if (playPauseBtn) {
                playPauseBtn.title =
                    languageData[currentLanguage].titles.play;
            }

            if (callback) {
                callback();
            }
        };

        currentUtterance.onerror = () => {
            isBotSpeaking = false;
            currentUtterance = null;
            isPaused = false;
        };

        synth.speak(currentUtterance);

        if (playPauseIcon) {
            playPauseIcon.src = "/static/images/pause.png";
        }

        if (playPauseBtn) {
            playPauseBtn.title =
                languageData[currentLanguage].titles.pause;
        }
    }


    // =========================================================
    // ADD MESSAGE TO CHAT
    // =========================================================

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");

        msgDiv.classList.add(
            sender === "bot" ? "bot-message" : "user-message"
        );

        const safeMessage = message
            .replace(/\n/g, "<br>")
            .replace(
                /(https?:\/\/[^\s<]+)/g,
                '<a href="$1" target="_blank" style="color: #81cfff;">$1</a>'
            );

        msgDiv.innerHTML = safeMessage;

        chatBox.appendChild(msgDiv);

        chatBox.scrollTop = chatBox.scrollHeight;

        if (sender === "bot") {
            speakText(message);
        }
    }


    // =========================================================
    // SEND MESSAGE
    // =========================================================

    function sendMessage(text) {
        if (!text || !text.trim()) return;

        appendMessage("user", text);

        userInput.value = "";

        appendMessage(
            "bot",
            languageData[currentLanguage].thinkingMessage
        );

        fetch("/ask", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                question: text,
                language: currentLanguage
            })
        })

        .then(res => res.json())

        .then(data => {

            const botMessages =
                document.querySelectorAll(".bot-message");

            const lastBotMessage =
                botMessages[botMessages.length - 1];

            if (
                lastBotMessage &&
                lastBotMessage.textContent ===
                    languageData[currentLanguage].thinkingMessage
            ) {
                lastBotMessage.remove();
            }

            const response =
                data.answer ||
                "Error: Could not get a response.";

            appendMessage("bot", response);
        })

        .catch(error => {

            console.error("Request error:", error);

            const botMessages =
                document.querySelectorAll(".bot-message");

            const lastBotMessage =
                botMessages[botMessages.length - 1];

            if (
                lastBotMessage &&
                lastBotMessage.textContent ===
                    languageData[currentLanguage].thinkingMessage
            ) {
                lastBotMessage.remove();
            }

            appendMessage(
                "bot",
                "Error: Could not get a response."
            );
        });
    }


    // =========================================================
    // REMOVE LISTENING MESSAGE
    // =========================================================

    function removeListeningMessage() {

        const botMessages =
            document.querySelectorAll(".bot-message");

        botMessages.forEach(msg => {

            if (
                msg.textContent ===
                languageData[currentLanguage].listeningMessage
            ) {
                msg.remove();
            }

        });
    }


    // =========================================================
    // VOICE RECOGNITION
    // =========================================================

    function startContinuousRecognition() {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {

            usingVoice = false;

            voiceBtn.classList.remove("voice-active");

            appendMessage(
                "bot",
                "Voice recognition is not supported in this browser."
            );

            return;
        }


        recognition = new SpeechRecognition();


        // Correct browser speech recognition language
        const recognitionLanguages = {
            en: "en-US",
            es: "es-ES",
            fr: "fr-FR",
            zh: "zh-CN"
        };


        recognition.lang =
            recognitionLanguages[currentLanguage] || "en-US";


        /*
         * IMPORTANT CHANGE:
         *
         * We do NOT keep restarting the microphone.
         * The microphone listens for one question and then stops.
         */

        recognition.continuous = false;


        /*
         * This allows words to appear while
         * the user is still speaking.
         */

        recognition.interimResults = true;


        finalTranscript = "";


        recognition.onstart = () => {

            console.log("Voice recognition started.");

            finalTranscript = "";

            usingVoice = true;

            voiceBtn.classList.add("voice-active");

        };


        recognition.onresult = (event) => {

            let interimTranscript = "";


            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                const transcript =
                    event.results[i][0].transcript;


                if (event.results[i].isFinal) {

                    finalTranscript += transcript + " ";

                } else {

                    interimTranscript += transcript;

                }

            }


            /*
             * THIS IS THE IMPORTANT PART.
             *
             * Your speech now appears in the
             * input box while you are speaking.
             */

            userInput.value =
                (finalTranscript + interimTranscript).trim();

        };


        recognition.onerror = (event) => {

            console.error(
                "Recognition error:",
                event.error
            );


            usingVoice = false;

            voiceBtn.classList.remove("voice-active");

            removeListeningMessage();


            if (event.error === "not-allowed") {

                appendMessage(
                    "bot",
                    "Microphone access was blocked. Please allow microphone access in your browser and try again."
                );

            }

            else if (event.error === "no-speech") {

                appendMessage(
                    "bot",
                    "I didn't hear anything. Please click the microphone and try again."
                );

            }

            else if (event.error === "audio-capture") {

                appendMessage(
                    "bot",
                    "I could not access your microphone. Please check your microphone settings."
                );

            }

            else {

                appendMessage(
                    "bot",
                    "Voice recognition error: " + event.error
                );

            }

        };


        recognition.onend = () => {

            console.log("Voice recognition ended.");


            usingVoice = false;


            voiceBtn.classList.remove("voice-active");


            removeListeningMessage();


            /*
             * Make sure the final recognized
             * sentence remains in the box.
             */

            if (finalTranscript.trim()) {

                userInput.value =
                    finalTranscript.trim();

            }

        };


        try {

            recognition.start();

        }

        catch (error) {

            console.error(
                "Could not start voice recognition:",
                error
            );


            usingVoice = false;


            voiceBtn.classList.remove("voice-active");


            removeListeningMessage();

        }

    }


    // =========================================================
    // SEND BUTTON
    // =========================================================

    sendBtn.addEventListener("click", () => {

        if (recognition && usingVoice) {

            try {
                recognition.stop();
            } catch (error) {
                console.warn(error);
            }

        }


        usingVoice = false;


        sendMessage(userInput.value);

    });


    // =========================================================
    // ENTER KEY
    // =========================================================

    userInput.addEventListener("keydown", e => {

        if (e.key === "Enter") {

            if (recognition && usingVoice) {

                try {
                    recognition.stop();
                } catch (error) {
                    console.warn(error);
                }

            }


            usingVoice = false;


            sendMessage(userInput.value);

        }

    });


    // =========================================================
    // MICROPHONE BUTTON
    // =========================================================

    voiceBtn.addEventListener("click", () => {


        /*
         * If microphone is already listening,
         * clicking the button again stops it.
         */

        if (usingVoice) {

            usingVoice = false;


            voiceBtn.classList.remove("voice-active");


            if (recognition) {

                try {

                    recognition.stop();

                }

                catch (error) {

                    console.warn(
                        "Recognition stop error:",
                        error
                    );

                }

            }


            removeListeningMessage();


            if (finalTranscript.trim()) {

                userInput.value =
                    finalTranscript.trim();

            }


            return;
        }


        /*
         * Stop chatbot speech before listening.
         */

        if (synth.speaking || isBotSpeaking) {

            synth.cancel();

            isBotSpeaking = false;

        }


        finalTranscript = "";


        /*
         * Show listening message.
         */

        appendMessage(
            "bot",
            languageData[currentLanguage].listeningMessage
        );


        /*
         * Play beep.
         */

        if (!isMuted && beep) {

            beep.currentTime = 0;

            beep.volume = 1.0;


            beep.play().catch(error => {

                console.warn(
                    "Beep failed:",
                    error
                );

            });

        }


        /*
         * Start microphone immediately after
         * the button is clicked.
         */

        startContinuousRecognition();

    });


    // =========================================================
    // LANGUAGE MENU
    // =========================================================

    const langBtn =
        document.getElementById("lang-btn");

    const langOptions =
        document.getElementById("language-options");


    if (langBtn && langOptions) {

        langBtn.addEventListener("click", () => {

            langOptions.style.display =
                langOptions.style.display === "block"
                    ? "none"
                    : "block";

        });


        document
            .querySelectorAll("#language-options button")
            .forEach(button => {

                button.addEventListener("click", () => {

                    const selectedLang =
                        button.getAttribute("data-lang");


                    localStorage.setItem(
                        "selectedLanguage",
                        selectedLang
                    );


                    location.reload();

                });

            });

    }


    // =========================================================
    // APPLY LANGUAGE
    // =========================================================

    const chatHeader =
        document.querySelector(".chat-header");


    if (chatHeader) {

        chatHeader.textContent =
            languageData[currentLanguage].chatbotTitle;

    }


    userInput.placeholder =
        languageData[currentLanguage].placeholder;


    const firstBotMessage =
        document.querySelector(".bot-message");


    if (firstBotMessage) {

        firstBotMessage.textContent =
            languageData[currentLanguage].botMessage;

    }


    const homeButton =
        document.querySelector('[title="Home"]');

    const languageButton =
        document.querySelector(
            '[title="Language Preferences"]'
        );

    const feedbackButton =
        document.querySelector('[title="Feedback"]');

    const resourcesButton =
        document.querySelector('[title="Resources"]');

    const exitButton =
        document.querySelector('[title="Exit"]');


    if (homeButton) {
        homeButton.title =
            languageData[currentLanguage].titles.home;
    }


    if (languageButton) {
        languageButton.title =
            languageData[currentLanguage].titles.language;
    }


    if (feedbackButton) {
        feedbackButton.title =
            languageData[currentLanguage].titles.feedback;
    }


    if (resourcesButton) {
        resourcesButton.title =
            languageData[currentLanguage].titles.resources;
    }


    if (exitButton) {
        exitButton.title =
            languageData[currentLanguage].titles.exit;
    }


    sendBtn.title =
        languageData[currentLanguage].titles.send;


    voiceBtn.title =
        languageData[currentLanguage].titles.voice;


    if (stopBtn) {

        stopBtn.title =
            languageData[currentLanguage].titles.stop;

    }


    if (playPauseBtn) {

        playPauseBtn.title =
            languageData[currentLanguage].titles.pause;

    }


    // =========================================================
    // VOLUME / MUTE
    // =========================================================

    const volumeToggle =
        document.getElementById("volume-toggle");

    const volumeIcon =
        document.getElementById("volume-icon");


    if (volumeToggle && volumeIcon) {

        volumeToggle.title =
            isMuted
                ? languageData[currentLanguage].titles.unmute
                : languageData[currentLanguage].titles.mute;


        volumeIcon.src =
            isMuted
                ? "/static/images/mute.png"
                : "/static/images/volume.png";


        volumeToggle.addEventListener("click", () => {

            isMuted = !isMuted;


            localStorage.setItem(
                "isMuted",
                isMuted.toString()
            );


            volumeIcon.src =
                isMuted
                    ? "/static/images/mute.png"
                    : "/static/images/volume.png";


            volumeToggle.title =
                isMuted
                    ? languageData[currentLanguage].titles.unmute
                    : languageData[currentLanguage].titles.mute;


            if (synth.speaking) {

                synth.cancel();

                isBotSpeaking = false;

            }

        });

    }


    // =========================================================
    // STOP BUTTON
    // =========================================================

    if (stopBtn) {

        stopBtn.addEventListener("click", () => {


            if (synth.speaking || isBotSpeaking) {

                synth.cancel();

                isBotSpeaking = false;

            }


            if (recognition) {

                try {

                    recognition.abort();

                }

                catch (error) {

                    console.warn(
                        "Recognition abort error:",
                        error
                    );

                }

            }


            usingVoice = false;


            userInput.value = "";


            finalTranscript = "";


            voiceBtn.classList.remove("voice-active");


            removeListeningMessage();


            isPaused = false;


            isBotSpeaking = false;


            if (playPauseIcon) {

                playPauseIcon.src =
                    "/static/images/play.png";

            }


            if (playPauseBtn) {

                playPauseBtn.title =
                    languageData[currentLanguage].titles.play;

            }

        });

    }


    // =========================================================
    // PLAY / PAUSE BOT VOICE
    // =========================================================

    if (playPauseBtn) {

        playPauseBtn.addEventListener("click", () => {


            if (
                synth.speaking &&
                !synth.paused
            ) {

                synth.pause();

                isPaused = true;


                playPauseIcon.src =
                    "/static/images/play.png";


                playPauseBtn.title =
                    languageData[currentLanguage].titles.play;

            }


            else if (synth.paused) {

                synth.resume();

                isPaused = false;


                playPauseIcon.src =
                    "/static/images/pause.png";


                playPauseBtn.title =
                    languageData[currentLanguage].titles.pause;

            }


            else if (
                !synth.speaking &&
                lastSpokenText
            ) {

                speakText(lastSpokenText);

            }

        });

    }


    // =========================================================
    // WELCOME MESSAGE SPEECH
    // =========================================================

    const welcomeText =
        languageData[currentLanguage].botMessage;


    speakText(welcomeText);

});
