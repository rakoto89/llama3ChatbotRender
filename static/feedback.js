document.addEventListener("DOMContentLoaded", function () {
  let lastInteractionWasKeyboard = false;

  // Detect if user used Tab (keyboard)
  window.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      lastInteractionWasKeyboard = true;
    }
  });

  // Detect if user used mouse
  window.addEventListener("mousedown", () => {
    lastInteractionWasKeyboard = false;
  });

  // Speak text aloud
  const speak = (text) => {
    if (!text) return;
    window.speechSynthesis.cancel(); // Stop ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  // Get all elements with tabindex="0"
  const tabbableElements = document.querySelectorAll('[tabindex="0"]');

  tabbableElements.forEach((el) => {
    el.addEventListener("focus", () => {
      if (!lastInteractionWasKeyboard) return;

      let text = "";

      if (el.id === "rate-experience") {
        text = "Rate your experience";
      } else if (el.classList.contains("rating-row")) {
        const input = el.querySelector("input[type='radio']:checked");
        const value = input?.value || "";

        // Speak "5 stars", "4 stars", etc.
        text = value ? `${value} star${value === "1" ? "" : "s"}` : "Rating option";
      } else if (el.id === "comments") {
        text = "Write your feedback here";
      } else if (el.id === "send-feedback") {
        text = "Send Feedback";
      } else if (el.id === "return-chatbot") {
        text = "Return to Chatbot";
      } else if (el.id === "skip-feedback") {
        text = "Exit";
      }

      speak(text);
    });
  });

  // Handle sending feedback to the backend
  const sendFeedbackBtn = document.getElementById("send-feedback");
  if (sendFeedbackBtn) {
    sendFeedbackBtn.addEventListener("click", function () {
      const selectedRating = document.querySelector("input[name='rating']:checked")?.value || "No rating";
      const comments = document.getElementById("comments")?.value.trim() || "No comments";

      const feedbackData = {
        rating: selectedRating,
        comments: comments
      };

      fetch("/submit-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(feedbackData),
      })
        .then((response) => response.json())
        .then((data) => {
          alert(data.message); // Display confirmation message
        })
        .catch((error) => {
          console.error("Error submitting feedback:", error);
          alert("An error occurred while submitting feedback.");
        });
    });
  }

  // Redirect "Return to Chatbot" to APMA
  const returnChatbotBtn = document.getElementById("return-chatbot");
  if (returnChatbotBtn) {
    returnChatbotBtn.addEventListener("click", function () {
      window.location.href = "https://llama2chatbotrender.onrender.com";
    });
  }

  // Redirect "Exit" to MSN
  const skipFeedbackBtn = document.getElementById("skip-feedback");
  if (skipFeedbackBtn) {
    skipFeedbackBtn.addEventListener("click", function () {
      window.location.href = "https://www.bowiestate.edu/";
    });
  }
});
