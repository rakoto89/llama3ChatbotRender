document.addEventListener("DOMContentLoaded", function () {
    let selectedRating = 0;

    // Capture star rating selection
    document.querySelectorAll(".rating-row").forEach(star => {
        star.addEventListener("click", function () {
            selectedRating = parseInt(this.dataset.rating);
            highlightStars(selectedRating);
        });
    });

    function highlightStars(rating) {
        document.querySelectorAll(".rating-row").forEach((star, index) => {
            star.innerHTML = index < rating ? "⭐" : "☆";
        });
    }

    // Submit feedback and store in localStorage
    document.getElementById("submit-feedback-btn").addEventListener("click", function () {
        const feedback = document.getElementById("user-feedback").value.trim();
        if (selectedRating === 0) {
            alert("Please select a star rating before submitting.");
            return;
        }

        // Store feedback in localStorage
        const feedbackData = {
            rating: selectedRating,
            feedback: feedback
        };
        localStorage.setItem("chatbotFeedback", JSON.stringify(feedbackData));

        alert("Thank you for your feedback!");
        window.location.href = "/"; // Redirect back to chatbot
    });

    // Return to chatbot without submitting feedback
    document.getElementById("back-to-chat-btn").addEventListener("click", function () {
        window.location.href = "/";
    });

    // Skip feedback and return to chatbot
    document.getElementById("skip-feedback-btn").addEventListener("click", function () {
        alert("Thank you! Redirecting to the chatbot...");
        window.location.href = "/";
    });
});
