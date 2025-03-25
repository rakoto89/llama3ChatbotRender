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
    let recognitionTimeout;
    const pauseTime = 10000; // 10 seconds delay after the user stops speaking
    let beepAudio; // Store the beep audio element
    let isBeeping = false; // Flag to check if the beep is currently playing

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        if (sender === "bot" && usingVoice && message === "Listening...") {
            speakResponse(message, () => {
                playBeep(); // Play beep after saying "Listening..."
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
            const utterance = new SpeechSynthesisUtterance(text);
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
            recognition.continuous = true; // Keep recognizing while the user speaks
            recognition.interimResults = true; // Capture interim results
            recognition.lang = "en-US";

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;

                // Clear any previous timeout
                clearTimeout(recognitionTimeout);

                // Set a timeout to detect when the user has finished speaking
                recognitionTimeout = setTimeout(() => {
                    sendMessage(transcript, true); // Send the final transcript after the 10-second pause
                    recognition.stop(); // Stop recognition once the timeout is triggered
                    usingVoice = false;
                    stopBeep(); // Stop the beep once the user is done speaking
                }, pauseTime); // Wait 10 seconds after last detected input
            };

            recognition.onerror = () => {
                appendMessage("bot", "Sorry, I couldn't hear you. Please try again.");
                usingVoice = false;
                stopBeep(); // Stop the beep in case of an error
            };

            recognition.onstart = () => {
                isBeeping = true;
                beepAudio = new Audio("/static/beep2.mp3");
                beepAudio.loop = true; // Loop the beep sound
                beepAudio.play(); // Play the beep continuously while speaking
            };

            recognition.onend = () => {
                // If recognition ends, stop the beep
                if (isBeeping) {
                    stopBeep();
                }
            };

            recognition.start();
        } else {
            alert("Voice recognition is not supported in this browser.");
        }
    }

    function stopBeep() {
        if (beepAudio) {
            beepAudio.pause();
            beepAudio.currentTime = 0; // Reset the beep to the beginning
            isBeeping = false;
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
            
            const elements = [userInput, sendBtn, voiceBtn, stopBtn];
            let currentIndex = elements.indexOf(document.activeElement);
            let nextIndex = (currentIndex + 1) % elements.length;
            let nextElement = elements[nextIndex];
            nextElement.focus();
            
            setTimeout(() => speakElementText(nextElement), 200);
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

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendBtn.click();
        }
    });

    userInput.addEventListener("keydown", handleTabKey);
    voiceBtn.addEventListener("focus", () => speakElementText(voiceBtn));
    stopBtn.addEventListener("focus", () => speakElementText(stopBtn));
});
