// Function to send the user's typed message
function sendMessage() {
    let userText = document.getElementById("userInput").value.trim();
    if (userText === "") return;

    let chatbox = document.getElementById("chatbox");

    // Display user message
    let userMessage = document.createElement("p");
    userMessage.className = "user-text";
    userMessage.innerHTML = `<strong>You:</strong> ${userText}`;
    chatbox.appendChild(userMessage);

    // Clear input field
    document.getElementById("userInput").value = "";

    // Send request to Flask server
    fetch("/ask", {
        method: "POST",
        body: new URLSearchParams({ "question": userText }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
    })
    .then(response => response.json())
    .then(data => {
        let botMessage = document.createElement("p");
        botMessage.className = "bot-text";
        botMessage.innerHTML = `<strong>Bot:</strong> ${data.answer}`;
        chatbox.appendChild(botMessage);

        // Scroll to the bottom of the chatbox
        chatbox.scrollTop = chatbox.scrollHeight;

        // Speak the bot's response
        speakText(data.answer);
    })
    .catch(error => console.error("Error:", error));
}

// Function to start speech recognition
function startVoiceRecognition() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

    recognition.lang = 'en-US';
    recognition.start();

    recognition.onresult = (event) => {
        let userText = event.results[0][0].transcript;
        document.getElementById("userInput").value = userText;
        sendMessage();
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error: ", event.error);
    };
}

// Function to speak the text (bot's answer)
function speakText(text) {
    const speechSynthesis = window.speechSynthesis;
    const speech = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(speech);
}
