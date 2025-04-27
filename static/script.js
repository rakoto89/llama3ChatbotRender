document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-speaking-btn");
    const playPauseBtn = document.getElementById("play-pause-btn");
    const playPauseIcon = document.getElementById("play-pause-icon");
    const beep = document.getElementById("beep");
    const languagePreferencesBtn = document.getElementById("language-preferences-btn");
    const languageMenu = document.getElementById("language-menu");

    let recognition;
    let usingVoice = false;
    const synth = window.speechSynthesis;
    let currentLanguage = localStorage.getItem("selectedLanguage") || 'en';
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
                voice: "使用语音提问",
                stop: "停止",
                mute: "静音",
                unmute: "取消静音",
                play: "播放",
                pause: "暂停"
            }
        },
        yo: {
            placeholder: "Tẹ ibeere rẹ...",
            chatbotTitle: "Ẹrọ Ayelujara Igbagbọ Opioid",
            botMessage: "Kaabo si Ẹrọ Ayelujara Igbagbọ Opioid! Nibi iwọ yoo kọ gbogbo nipa awọn opioids!",
            listeningMessage: "Nṣiṣẹ gbigbọ...",
            thinkingMessage: "N ronu...",
            titles: {
                home: "Ile",
                language: "Aṣayan Ede",
                feedback: "Atunse",
                resources: "Awọn orisun",
                exit: "Jade",
                send: "Firanṣẹ ibeere rẹ",
                voice: "Beere pẹlu ohùn rẹ",
                stop: "Duro",
                mute: "Dakẹ",
                unmute: "Tún ṣii",
                play: "Mu ṣiṣẹ",
                pause: "Duro"
            }
        },
        tw: {
            placeholder: "Kyerɛ wo nsɛm...",
            chatbotTitle: "Opioid Nkyerɛkyerɛ Bot",
            botMessage: "Akwaaba ba Opioid Nkyerɛkyerɛ Bot! Ha wobɛtete biribiara fa opioids ho!",
            listeningMessage: "Rebɔ aso...",
            thinkingMessage: "Rebɔ adwene...",
            titles: {
                home: "Fie",
                language: "Kasa a Wopɛ",
                feedback: "Nsɛm a Wopɛka",
                resources: "Nkwa Kɔkɔɔ",
                exit: "Pue",
                send: "Fa wo nsɛm to hɔ",
                voice: "Bisa de w'ano kasa",
                stop: "Gyae",
                mute: "Dum abɔdin",
                unmute: "San so abɔdin",
                play: "Bɔ",
                pause: "Gyina"
            }
        },
        hi: {
            placeholder: "अपना प्रश्न दर्ज करें...",
            chatbotTitle: "ओपिओइड जागरूकता चैटबॉट",
            botMessage: "ओपिओइड जागरूकता चैटबॉट में आपका स्वागत है! यहां आप ओपिओइड्स के बारे में सब कुछ जानेंगे!",
            listeningMessage: "सुन रहे हैं...",
            thinkingMessage: "सोच रहे हैं...",
            titles: {
                home: "होम",
                language: "भाषा वरीयताएँ",
                feedback: "प्रतिक्रिया",
                resources: "संसाधन",
                exit: "बाहर जाएं",
                send: "अपना संदेश भेजें",
                voice: "अपनी आवाज से पूछें",
                stop: "बोलना बंद करें",
                mute: "मौन करें",
                unmute: "ध्वनि पुनः चालू करें",
                play: "चालू करें",
                pause: "रोकें"
            }
        },
        ar: {
            placeholder: "أدخل سؤالك...",
            chatbotTitle: "روبوت التوعية بالمواد الأفيونية",
            botMessage: "مرحبًا بك في روبوت التوعية بالمواد الأفيونية! هنا ستتعلم كل شيء عن المواد الأفيونية!",
            listeningMessage: "جارٍ الاستماع...",
            thinkingMessage: "جارٍ التفكير...",
            titles: {
                home: "الرئيسية",
                language: "تفضيلات اللغة",
                feedback: "ملاحظات",
                resources: "موارد",
                exit: "خروج",
                send: "أرسل رسالتك",
                voice: "اطرح سؤالك باستخدام صوتك",
                stop: "توقف عن التحدث",
                mute: "كتم الصوت",
                unmute: "إلغاء كتم الصوت",
                play: "تشغيل",
                pause: "إيقاف مؤقت"
            }
        },
        ha: {
            placeholder: "Shigar da tambayarka...",
            chatbotTitle: "Chatbot na Wayar da Kai game da Opioid",
            botMessage: "Barka da zuwa Chatbot na Wayar da Kai game da Opioid! A nan za ka koyi duk game da opioids!",
            listeningMessage: "Ana sauraro...",
            thinkingMessage: "Ana tunani...",
            titles: {
                home: "Gida",
                language: "Zaɓin Harshe",
                feedback: "Ra'ayi",
                resources: "Kayan Aiki",
                exit: "Fita",
                send: "Aika saƙonka",
                voice: "Tambaya da murya",
                stop: "Dakata da magana",
                mute: "Kashe sauti",
                unmute: "Sake kunna sauti",
                play: "kunna",
                pause: "Tsaya ɗan lokaci"
            }
        }
    };

    function updateUI() {
        userInput.placeholder = languageData[currentLanguage].placeholder;
        document.getElementById("chatbot-title").innerText = languageData[currentLanguage].chatbotTitle;
        sendBtn.title = languageData[currentLanguage].titles.send;
        voiceBtn.title = languageData[currentLanguage].titles.voice;
        stopBtn.title = languageData[currentLanguage].titles.stop;
        playPauseBtn.title = languageData[currentLanguage].titles.pause;
        languagePreferencesBtn.title = languageData[currentLanguage].titles.language;
    }

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        if (sender === "bot") speakText(message);
    }

    function speakText(text) {
        if (!text.trim() || isMuted) return;
        synth.cancel();
        lastSpokenText = text;
        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = currentLanguage;
        isBotSpeaking = true;
        currentUtterance.onend = () => {
            isBotSpeaking = false;
            currentUtterance = null;
            isPaused = false;
            playPauseIcon.src = "/static/images/pause.png";
            playPauseBtn.title = languageData[currentLanguage].titles.pause;
        };
        synth.speak(currentUtterance);
        playPauseIcon.src = "/static/images/pause.png";
        playPauseBtn.title = languageData[currentLanguage].titles.pause;
    }

    function createLanguageMenu() {
        languageMenu.innerHTML = "";
        for (const langCode in languageData) {
            const langOption = document.createElement("div");
            langOption.classList.add("language-option");
            langOption.innerText = langCode.toUpperCase();
            langOption.dataset.lang = langCode;
            langOption.addEventListener("click", () => {
                localStorage.setItem("selectedLanguage", langCode);
                currentLanguage = langCode;
                updateUI();
                const welcomeText = languageData[currentLanguage].botMessage;
                appendMessage("bot", welcomeText); // Add welcome message without clearing old messages
                languageMenu.style.display = "none";
            });
            languageMenu.appendChild(langOption);
        }
    }

    languagePreferencesBtn.addEventListener("click", function () {
        if (languageMenu.style.display === "block") {
            languageMenu.style.display = "none"; // Hide the menu if it's visible
        } else {
            createLanguageMenu();  // Create and append the language options
            languageMenu.style.display = "block";  // Show the language options
        }
    });

    // === Initial setup ===
    updateUI();
    const welcomeText = languageData[currentLanguage].botMessage;
    appendMessage("bot", welcomeText);
});
