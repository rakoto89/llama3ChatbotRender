// Initial greeting
$(document).ready(function() {
    $('#chatMessages').append('<div class="message bot">Welcome to the AI Opioid Education Chatbot! Ask me anything about opioids.</div>');
});

// Function to send a message to the server and get the response
function sendMessage() {
    let userQuestion = $('#userQuestion').val().trim();

    if (userQuestion) {
        // Display the user's question in the chat window
        $('#chatMessages').append('<div class="message user">' + userQuestion + '</div>');
        $('#userQuestion').val(""); // Clear the input field

        // Send the user's question to the backend
        $.post("/ask", { question: userQuestion }, function(data) {
            $('#chatMessages').append('<div class="message bot">' + data.answer + '</div>');
            // Scroll to the bottom of the chat
            $('#chatMessages').scrollTop($('#chatMessages')[0].scrollHeight);
            speakResponse(data.answer); // Speak the answer after receiving it
        });
    }
}

// Function to handle speech recognition (listening to the user)
function startListening() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';

    recognition.start();

    recognition.onresult = function(event) {
        const userQuestion = event.results[0][0].transcript;
        $('#chatMessages').append('<div class="message user">' + userQuestion + '</div>');
        recognition.stop();

        // Send the speech to the Flask backend for a response
        $.post("/ask", { question: userQuestion }, function(data) {
            $('#chatMessages').append('<div class="message bot">' + data.answer + '</div>');
            $('#chatMessages').scrollTop($('#chatMessages')[0].scrollHeight);
            speakResponse(data.answer); // Speak the response
        });
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
    };
}

// Function to make the chatbot speak the answer using SpeechSynthesis API
function speakResponse(response) {
    const speech = new SpeechSynthesisUtterance(response);
    window.speechSynthesis.speak(speech);
}
