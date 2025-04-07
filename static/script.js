document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");
    const endBtn = document.getElementById("end-btn");

    let recognition;
    let isSpeaking = false;
    let usingVoice = false;
    const synth = window.speechSynthesis;
    let silenceTimeout;
    let lastInputWasKeyboard = false; // ✅ Added to track focus method

    document.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
            lastInputWasKeyboard = true;
        }
    });

    document.addEventListener("mousedown", () => {
        lastInputWasKeyboard = false;
    });

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (sender === "bot" && usingVoice && message === "Listening...") {
            speakResponse(message, () => {
                playBeep();
                startVoiceRecognition();
            });
        }
    }

    function removePreviousThinkingMessage() {
        const lastThinkingMessage = document.querySelector(".bot-message:last-child");
        if (lastThinkingMessage && lastThinkingMessage.textContent === "Thinking...") {
            lastThinkingMessage.remove();
        }
    }

    function sendMessage(text, useVoice = false) {
        if (!text.trim()) return;

        appendMessage("user", text);
        userInput.value = "";

        removePreviousThinkingMessage();
        const thinkingMsg = document.createElement("div");
        thinkingMsg.classList.add("bot-message");
        thinkingMsg.textContent = "Thinking...";
        chatBox.appendChild(thinkingMsg);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (useVoice) speakResponse("Thinking...");

        fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text }),
        })
            .then(response => response.json())
            .then(data => {
                removePreviousThinkingMessage();
                appendMessage("bot", data.answer);
                if (useVoice) speakResponse(data.answer);
            })
            .catch(() => {
                removePreviousThinkingMessage();
                appendMessage("bot", "Error: Could not get a response.");
            });
    }

    function speakResponse(text, callback) {
        if ("speechSynthesis" in window) {
            const cleanText = text.replace(/<br\s*\/?>/g, " ");

            if (cleanText.trim() === "") return;

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.onend = () => {
                isSpeaking = false;
                if (callback) callback();
            };
            synth.speak(utterance);
            isSpeaking = true;
        }
    }

    function stopSpeaking() {
        if (isSpeaking) {
            synth.cancel();
            isSpeaking = false;
        }
    }

    function startVoiceRecognition() {
        if ("webkitSpeechRecognition" in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = "en-US";

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
                appendMessage("bot", "Sorry, I couldn't hear you. Please try again.");
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

    function speakElementText(element) {
        if ("speechSynthesis" in window) {
            let text = "";

            if (element.id === "send-btn") {
                text = "Send button.";
            } else if (element.id === "voice-btn") {
                text = "Voice button.";
            } else if (element.id === "stop-btn") {
                text = "Stop button.";
            } else if (element.id === "end-btn") {
                text = "End chat button.";
            }

            if (text) {
                let utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.9;
                synth.speak(utterance);
            }
        }
    }

    function handleTabKey(event) {
        if (event.key === "Tab") {
            event.preventDefault();

            const elements = [userInput, sendBtn, voiceBtn, stopBtn, endBtn];
            let currentIndex = elements.indexOf(document.activeElement);
            let nextIndex = (currentIndex + 1) % elements.length;
            let nextElement = elements[nextIndex];
            nextElement.focus();

            setTimeout(() => {
                speakElementText(nextElement);
            }, 200);
        }
    }

    voiceBtn.addEventListener("click", () => {
        usingVoice = true;
        appendMessage("bot", "Listening...");
    });

    stopBtn.addEventListener("click", stopSpeaking);

    sendBtn.addEventListener("click", () => {
        sendBtn.disabled = true;
        sendMessage(userInput.value, false);
        setTimeout(() => sendBtn.disabled = false, 700);
    });

    endBtn.addEventListener("click", () => {
        if (isSpeaking) {
            synth.cancel();
            isSpeaking = false;
        }
        window.location.href = "/feedback";
    });

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendBtn.click();
        }
    });

    // ✅ Speak "Enter your question" only when tabbing into input field
    userInput.addEventListener("focus", () => {
        if (lastInputWasKeyboard) {
            let utterance = new SpeechSynthesisUtterance("Enter your question");
            utterance.rate = 0.9;
            synth.speak(utterance);
        }
    });

    // ✅ Attach tab key handler
    [userInput, sendBtn, voiceBtn, stopBtn, endBtn].forEach(element => {
        element.addEventListener("keydown", handleTabKey);
    });

    // ✅ Optional: Handle sidebar icon clicks
    const sidebarIcons = document.querySelectorAll(".sidebar .icon");
    sidebarIcons.forEach((icon, index) => {
        icon.addEventListener("click", () => {
            const utterance = new SpeechSynthesisUtterance(`Sidebar button ${index + 1} clicked`);
            utterance.rate = 0.9;
            synth.speak(utterance);
        });
    });
});
