document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");

    let recognition;
    let isSpeaking = false;
    let synth = window.speechSynthesis;

    function appendMessage(sender, message) {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add(sender === "bot" ? "bot-message" : "user-message");
        msgDiv.innerHTML = message;
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function sendMessage(text, useVoice = false) {
        if (!text.trim()) return;

        appendMessage("user", text);
        userInput.value = "";

        const thinkingMsg = document.createElement("div");
        thinkingMsg.classList.add("bot-message");
        thinkingMsg.textContent = "Thinking...";
        chatBox.appendChild(thinkingMsg);
        chatBox.scrollTop = chatBox.scrollHeight;

        fetch('/ask', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text })
        })
        .then(response => response.json())
        .then(data => {
            thinkingMsg.remove();
            appendMessage("bot", data.answer);
            if (useVoice) speakResponse(data.answer);
        })
        .catch(() => {
            thinkingMsg.remove();
            appendMessage("bot", "Error: Could not get a response.");
        });
    }

    function speakResponse(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            synth.speak(utterance);
            isSpeaking = true;
            utterance.onend = () => isSpeaking = false;
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
                text = "Enter your question.";
            } else if (element.id === "send-btn") {
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

            setTimeout(() => {
                speakElementText(nextElement);
            }, 100);
        }
    }

    });

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage(userInput.value, false); // Call sendMessage directly
        }
    });

    voiceBtn.addEventListener("click", function () {
        if ("webkitSpeechRecognition" in window) {
            if (recognition) {
                recognition.stop();
            }
            recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = "en-US";

            recognition.onstart = () => appendMessage("bot", "Listening...");
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                sendMessage(transcript, true);
            };
            recognition.onerror = () => appendMessage("bot", "Sorry, I couldn't hear you.");
            recognition.start();
        } else {
            alert("Voice recognition is not supported in this browser.");
        }
    });

    stopBtn.addEventListener("click", stopSpeaking);
    userInput.addEventListener("keydown", handleTabKey);
    userInput.addEventListener("focus", () => speakElementText(userInput));
    sendBtn.addEventListener("focus", () => speakElementText(sendBtn));
    voiceBtn.addEventListener("focus", () => speakElementText(voiceBtn));
    stopBtn.addEventListener("focus", () => speakElementText(stopBtn));
});
