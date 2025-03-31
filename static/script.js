document.addEventListener("DOMContentLoaded", function () {
    const endBtn = document.getElementById("end-btn");
    const feedbackContainer = document.getElementById("feedback-container");
    const chatContainer = document.getElementById("chat-container");
    const thankYouContainer = document.getElementById("thank-you-container");
    const thankYouMessage = document.getElementById("thank-you-message");
    const goBackBtn = document.getElementById("go-back-btn");
    const skipFeedbackBtn = document.getElementById("skip-feedback-btn");
    const submitFeedbackBtn = document.getElementById("submit-feedback-btn");
    let selectedRating = 0;

    // Show feedback after clicking End Chat
    endBtn.addEventListener("click", function () {
        chatContainer.classList.add("hidden");
        feedbackContainer.classList.remove("hidden");
    });

    // Handle star rating selection
    document.querySelectorAll("#stars span").forEach(star => {
        star.addEventListener("click", function () {
            selectedRating = this.dataset.value;
            document.querySelectorAll("#stars span").forEach(s => s.style.color = "#ccc");
            this.style.color = "orange";
        });
    });

    // Submit feedback
    submitFeedbackBtn.addEventListener("click", function () {
        thankYouMessage.innerHTML = `Thank you for using the chatbot and giving your feedback!`;
        feedbackContainer.classList.add("hidden");
        thankYouContainer.classList.remove("hidden");
    });

    // Go back to chatbot
    goBackBtn.addEventListener("click", function () {
        feedbackContainer.classList.add("hidden");
        chatContainer.classList.remove("hidden");
    });

    // Skip feedback
    skipFeedbackBtn.addEventListener("click", function () {
        thankYouMessage.innerHTML = `Thank you for using the chatbot!`;
        feedbackContainer.classList.add("hidden");
        thankYouContainer.classList.remove("hidden");
    });
});

