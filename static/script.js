document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const voiceBtn = document.getElementById("voice-btn");
    const stopBtn = document.getElementById("stop-btn");

    const tabList = document.querySelector('[role="tablist"]');
    const tabs = document.querySelectorAll('[role="tab"]');
    const panels = document.querySelectorAll('[role="tabpanel"]');

    let recognition;
    let isSpeaking = false;
    const synth = window.speechSynthesis;

    /*** Accessibility: Tab Navigation with Speech ***/
    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => activateTab(tab, true));
        tab.addEventListener("keydown", (event) => handleTabKeyboardNavigation(event, index));
    });

    function activateTab(selectedTab, speak = false) {
        tabs.forEach((tab) => {
            tab.setAttribute("aria-selected", "false");
            tab.classList.remove("active-tab");
        });

        panels.forEach((panel) => {
            panel.setAttribute("hidden", "true");
        });

        selectedTab.setAttribute("aria-selected", "true");
        selectedTab.classList.add("active-tab");

        const panelId = selectedTab.getAttribute("aria-controls");
        const panelContent = document.getElementById(panelId);
        panelContent.removeAttribute("hidden");

        // Speak tab name and content
        if (speak) {
            const tabName = selectedTab.textContent;
            const tabContent = panelContent.textContent.trim() || "No content available";
            speakResponse(`Tab: ${tabName}. ${tabContent}`);
        }
    }

    function handleTabKeyboardNavigation(event, index) {
        let newIndex;
        switch (event.key) {
            case "ArrowRight":
                newIndex = (index + 1) % tabs.length;
                break;
            case "ArrowLeft":
                newIndex = (index - 1 + tabs.length) % tabs.length;
                break;
            case "Home":
                newIndex = 0;
                break;
            case "End":
                newIndex = tabs.length - 1;
                break;
            case "Enter":
            case " ":
                activateTab(tabs[index], true);
                return;
            default:
                return;
        }
        tabs[newIndex].focus();
        activateTab(tabs[newIndex], true);
    }

    /*** Chatbot Functionality ***/
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
            synth.cancel(); // Stop any ongoing speech
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

    sendBtn.addEventListener("click", () => {
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

    stopBtn.addEventListener("click", stopSpeaking);
});
