document.addEventListener("DOMContentLoaded", function () {
    const stars = document.querySelectorAll("#stars span");
    const submitRatingButton = document.getElementById("submit-rating");
    const submitFeedbackButton = document.getElementById("submit-feedback-btn");
    const goBackButton = document.getElementById("go-back-btn");
    const skipFeedbackButton = document.getElementById("skip-feedback-btn");
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
        // You can send this rating to your server if needed
        showThankYouPage();
    });

    // Handle "Submit Feedback" button click
    submitFeedbackButton.addEventListener("click", function () {
        alert("Feedback submitted.");
        // You can collect and submit feedback text if needed
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
