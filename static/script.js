// Handle "End Conversation" button click
document.getElementById('end-chat-btn').addEventListener('click', function () {
    // Hide the chat UI and show the rating page
    document.querySelector('.chat-container').style.display = 'none';
    document.getElementById('rating-page').style.display = 'flex';
});

// Star rating functionality
const stars = document.querySelectorAll('#stars span');
let selectedRating = 0;

// Add functionality to handle star selection
stars.forEach((star, index) => {
    star.addEventListener('click', () => {
        selectedRating = index + 1; // Update selected rating based on clicked star
        stars.forEach((s, i) => {
            if (i < selectedRating) {
                s.classList.add('selected');
            } else {
                s.classList.remove('selected');
            }
        });
    });
});

// Handle "Submit Rating" button click
document.getElementById('submit-rating').addEventListener('click', function () {
    const review = document.getElementById('review-text').value;
    if (selectedRating === 0) {
        alert('Please select a rating before submitting.');
    } else {
        // Process or save the review and rating
        alert(`Thank you for your feedback! Rating: ${selectedRating} stars, Review: ${review}`);
        // Redirect to the thank-you page after submission
        document.getElementById('rating-page').style.display = 'none';
        document.getElementById('thank-you-page').style.display = 'flex';
    }
});

// Handle "Submit Feedback" button click
document.getElementById('submit-feedback-btn').addEventListener('click', function () {
    // Redirect to the thank-you page with a feedback message
    document.getElementById('rating-page').style.display = 'none';
    document.getElementById('thank-you-page').style.display = 'flex';
});

// Handle "Go Back to Chatbot" button click
document.getElementById('go-back-btn').addEventListener('click', function () {
    // Hide rating page and show the chatbot page again
    document.getElementById('rating-page').style.display = 'none';
    document.querySelector('.chat-container').style.display = 'block';
});

// Handle "Skip Feedback" button click
document.getElementById('skip-feedback-btn').addEventListener('click', function () {
    // Redirect to a simple "Thank You" page
    document.getElementById('rating-page').style.display = 'none';
    document.getElementById('thank-you-page').style.display = 'flex';
});
