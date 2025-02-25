document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const questionInput = document.getElementById("question-input");
    const sendButton = document.getElementById("send-button");
    const listenButton = document.getElementById("listen-button");

    // Function to append a message to the chatbox
    function appendMessage(message, sender) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("chat-message", sender === "user" ? "user-message" : "bot-message");
        messageDiv.textContent = message;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to bottom
    }

    // Function to send a question to the server
    function sendMessage() {
        const question = questionInput.value.trim();
        if (!question) {
            alert("Please enter a question.");
            return;
        }
        appendMessage(question, "user");
        questionInput.value = ""; // Clear input field

        fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "question=" + encodeURIComponent(question)
        })
        .then(response => response.json())
        .then(data => {
            const answer = data.answer;
            appendMessage(answer, "bot");
            speak(answer); // Read the response aloud
        })
        .catch(error => console.error("Error communicating with server:", error));
    }

    // Function to speak text using SpeechSynthesis API
    function speak(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            speechSynthesis.speak(utterance);
        }
    }

    // Function to start voice recognition using Annyang
    function startListening() {
        if (annyang) {
            annyang.start();
            annyang.addCallback("result", function (phrases) {
                const question = phrases[0];
                questionInput.value = question;
                sendMessage();
            });
        } else {
            alert("Speech recognition is not supported in your browser.");
        }
    }

    // Event listeners for send and listen buttons
    sendButton.addEventListener("click", sendMessage);
    listenButton.addEventListener("click", startListening);

    // Allow Enter key to send messages
    questionInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });
});
