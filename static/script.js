document.addEventListener("DOMContentLoaded", function () {
    const stars = document.querySelectorAll("#stars span");
    const submitRatingButton = document.getElementById("submit-rating");
    const submitFeedbackButton = document.getElementById("submit-feedback-btn");
    const goBackButton = document.getElementById("go-back-btn");
    const skipFeedbackButton = document.getElementById("skip-feedback-btn");

    // The new buttons: Send, Stop Voice, and End Conversation
    const sendButton = document.getElementById("send-btn");
    const stopVoiceButton = document.getElementById("stop-voice-btn");
    const endConversationButton = document.getElementById("end-conversation-btn");

    let selectedRating = 0;

    // Handle star selection
    stars.forEach(star => {
        star.addEventListener("click", function () {
            selectedRating = parseInt(star.getAttribute("data-star"));
            updateStarSelection(selectedRating);
            enableFeedbackButtons();
        });
    });

    // Update the appearance of the stars based on selection
    function updateStarSelection(rating) {
        stars.forEach(star => {
            if (parseInt(star.getAttribute("data-star")) <= rating) {
                star.classList.add("selected");
            } else {
                star.classList.remove("selected");
            }
        });
    }

    // Enable feedback buttons when a rating is selected
    function enableFeedbackButtons() {
        submitRatingButton.disabled = false;
        submitFeedbackButton.disabled = false;
        goBackButton.disabled = false;
        skipFeedbackButton.disabled = false;
    }

    // Handle "Submit Rating" button click
    submitRatingButton.addEventListener("click", function () {
        alert(`Rating submitted: ${selectedRating} star(s)`);
        showThankYouPage();
    });

    // Handle "Submit Feedback" button click
    submitFeedbackButton.addEventListener("click", function () {
        alert("Feedback submitted.");
        showThankYouPage();
    });

    // Handle "Go Back" button click
    goBackButton.addEventListener("click", function () {
        showChatbotPage();
    });

    // Handle "Skip Feedback" button click
    skipFeedbackButton.addEventListener("click", function () {
        showChatbotPage();
    });

    // Handle "Send" button click (for sending messages)
    sendButton.addEventListener("click", function () {
        const userMessage = document.getElementById("user-input").value;
        if (userMessage) {
            alert(`Message sent: ${userMessage}`);
            // You can add logic here to send the message to the chatbot or process it
            document.getElementById("user-input").value = ''; // Clear input field after sending
        } else {
            alert("Please enter a message before sending.");
        }
    });

    // Handle "Stop Voice" button click
    stopVoiceButton.addEventListener("click", function () {
        alert("Voice input has been stopped.");
        // Add logic here to stop speech input if you are using speech recognition
    });

    // Handle "End Conversation" button click
    endConversationButton.addEventListener("click", function () {
        alert("Ending conversation.");
        // You can reset the chatbot's state or hide the chatbot window
        showThankYouPage(); // This will end the conversation and show the thank you page
    });

    // Show the Thank You page after rating/feedback submission
    function showThankYouPage() {
        document.getElementById("rating-page").style.display = "none";
        document.getElementById("thank-you-page").style.display = "flex";
    }

    // Show the Chatbot page when going back from the rating page
    function showChatbotPage() {
        document.getElementById("rating-page").style.display = "none";
        document.getElementById("chat-container").style.display = "flex";
    }
});
