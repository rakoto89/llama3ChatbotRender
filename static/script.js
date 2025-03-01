document.addEventListener("DOMContentLoaded", function () { 
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");

    let recognition;
    let isSpeaking = false;
    const synth = window.speechSynthesis;

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
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

    function speakResponse(text) {
        if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            synth.speak(utterance);
            isSpeaking = true;
            utterance.onend = () => { isSpeaking = false; };
        }
    }

    function stopSpeaking() {
        if (isSpeaking) {
            synth.cancel();
            isSpeaking = false;
        }
    }

    function speakElementText(element) {
        if ('speechSynthesis' in window) {
            let text = "";

            if (element.id === "user-input") {
                text = "Enter your question.";  // Speech for the input field
            } else if (element.id === "send-btn") {
                text = "Send button.";  // Speech for the send button
            } else if (element.id === "voice-btn") {
                text = "Voice button.";  // Speech for the voice button
            } else if (element.id === "stop-btn") {
                text = "Stop button.";  // Speech for the stop button
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

            // Speak the name of the next focused element after tabbing
            setTimeout(() => {
                speakElementText(nextElement);
            }, 100);
        }
    }

    sendBtn.addEventListener("click", () => {
        // Stop any speech immediately when clicking the button (ensure nothing is spoken)
        synth.cancel();
        sendBtn.disabled = true;
        sendMessage(userInput.value, false);
        setTimeout(() => sendBtn.disabled = false, 500);
    });

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendBtn.click();
        }
    });

    voiceBtn.addEventListener("click", () => {
        // Stop any speech immediately when clicking the button (ensure nothing is spoken)
        synth.cancel();
        if ("webkitSpeechRecognition" in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = "en-US";

            recognition.onstart = () => appendMessage("bot", "Listening...");

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                sendMessage(transcript, true);
            };

            recognition.onerror = () => appendMessage("bot", "Sorry, I couldn't hear you. Please try again.");
            recognition.start();
        } else {
            alert("Voice recognition is not supported in this browser.");
        }
    });

    stopBtn.addEventListener("click", () => {
        // Stop any speech immediately when clicking the button (ensure nothing is spoken)
        synth.cancel();
        stopSpeaking();
    });

    // Event listeners to announce text for buttons and input fields
    // These are NOT called on button clicks anymore
    userInput.addEventListener("focus", () => speakElementText(userInput));  // Announce when input field is focused
    sendBtn.addEventListener("focus", () => speakElementText(sendBtn));  // Announce when send button is focused
    voiceBtn.addEventListener("focus", () => speakElementText(voiceBtn));  // Announce when voice button is focused
    stopBtn.addEventListener("focus", () => speakElementText(stopBtn));  // Announce when stop button is focused

    // Handle Tab key press to switch focus and announce each element
    userInput.addEventListener("keydown", handleTabKey);
});
