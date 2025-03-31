document.addEventListener('DOMContentLoaded', function () {
    const stars = document.querySelectorAll('#stars span');
    const submitRatingBtn = document.getElementById('submit-rating');
    const submitFeedbackBtn = document.getElementById('submit-feedback-btn');
    const reviewText = document.getElementById('review-text');
    let selectedRating = 0;

    // Handle star click
    stars.forEach(star => {
        star.addEventListener('click', function () {
            selectedRating = parseInt(star.getAttribute('data-star')); // Get selected star value
            updateStars(selectedRating);
            submitRatingBtn.disabled = false; // Enable Submit Rating button
            submitFeedbackBtn.disabled = false; // Enable Submit Feedback button
        });
    });

    // Function to update stars' appearance based on the selection
    function updateStars(rating) {
        stars.forEach(star => {
            const starValue = parseInt(star.getAttribute('data-star'));
            if (starValue <= rating) {
                star.classList.add('selected'); // Highlight selected stars
            } else {
                star.classList.remove('selected'); // Remove highlight from unselected stars
            }
        });
    }

    // Handle submitting rating
    submitRatingBtn.addEventListener('click', function () {
        if (selectedRating > 0) {
            alert(`You rated the experience ${selectedRating} star(s).`);
        }
    });

    // Handle submitting feedback
    submitFeedbackBtn.addEventListener('click', function () {
        const feedback = reviewText.value;
        if (feedback) {
            alert(`You submitted feedback: ${feedback}`);
        } else {
            alert("Please provide your feedback.");
        }
    });

    // Go back to chatbot
    document.getElementById('go-back-btn').addEventListener('click', function () {
        document.getElementById('rating-page').style.display = 'none';
        document.querySelector('.chat-container').style.display = 'block';
    });

    // Skip feedback
    document.getElementById('skip-feedback-btn').addEventListener('click', function () {
        document.getElementById('rating-page').style.display = 'none';
        document.querySelector('.thank-you-page').style.display = 'flex'; // Show Thank You Page
    });
});
