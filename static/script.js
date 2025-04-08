document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");

    let recognition;
    let isSpeaking = false;
    let usingVoice = false;
    const synth = window.speechSynthesis;
    let recognitionInProgress = false; // To track if recognition is in progress
    let silenceTimeout;
    let recognitionErrorCount = 0; // To count consecutive errors in recognition

    // Append messages to chatbox
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

    // Send a message to the bot
    function sendMessage(text, useVoice = false) {
        if (!text.trim()) return;

        appendMessage("user", text);
        userInput.value = "";

        // Simulate thinking while processing
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

    function removePreviousThinkingMessage() {
        const lastThinkingMessage = document.querySelector(".bot-message:last-child");
        if (lastThinkingMessage && lastThinkingMessage.textContent === "Thinking...") {
            lastThinkingMessage.remove();
        }
    }

    // Speak a response
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

    // Stop speaking
    function stopSpeaking() {
        if (isSpeaking) {
            synth.cancel();
            isSpeaking = false;
        }
    }

    // Start voice recognition
    function startVoiceRecognition() {
        if ("webkitSpeechRecognition" in window) {
            if (recognitionInProgress) return; // Prevent starting a new recognition if already in progress

            recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = "en-US";

            recognition.onstart = () => {
                recognitionInProgress = true;
                appendMessage("bot", "Listening...");
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                sendMessage(transcript, true);
                recognitionErrorCount = 0; // Reset error count on success
            };

            recognition.onerror = (event) => {
                recognitionErrorCount++;
                if (recognitionErrorCount >= 3) {
                    appendMessage("bot", "I couldn't recognize your speech. Please try again.");
                    recognitionErrorCount = 0; // Reset error count after 3 errors
                } else {
                    appendMessage("bot", "Error recognizing speech. Please try again.");
                }
            };

            recognition.onend = () => {
                recognitionInProgress = false;
            };

            recognition.start();
        } else {
            alert("Your browser does not support speech recognition.");
        }
    }

    // Play beep sound
    function playBeep() {
        const beep = new Audio("/static/beep2.mp3");
        beep.play();
    }

    // Voice button click event
    voiceBtn.addEventListener("click", () => {
        if (isSpeaking) {
            stopSpeaking(); // Stop speaking if already speaking
        } else if (!recognitionInProgress) {
            usingVoice = true;
            appendMessage("bot", "Listening...");
            playBeep();
            startVoiceRecognition(); // Start voice recognition if not already started
        }
    });

    // Stop button click event to stop speaking
    stopBtn.addEventListener("click", stopSpeaking);

    // Send message button click event
    sendBtn.addEventListener("click", () => {
        if (!userInput.value.trim()) return; // Don't send empty messages
        sendBtn.disabled = true;
        sendMessage(userInput.value, false); // Send the message typed by user
        setTimeout(() => sendBtn.disabled = false, 700); // Re-enable send button after a brief delay
    });

    // User input handle 'Enter' keypress
    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendBtn.click();
        }
    });
});
