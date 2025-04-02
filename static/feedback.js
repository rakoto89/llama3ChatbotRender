document.addEventListener("DOMContentLoaded", function () {

  let lastInteractionWasKeyboard = false;

 

  // Detect Tab key navigation

  window.addEventListener("keydown", (e) => {

    if (e.key === "Tab") {

      lastInteractionWasKeyboard = true;

    }

  });

 

  // Detect mouse interaction

  window.addEventListener("mousedown", () => {

    lastInteractionWasKeyboard = false;

  });

 

  const speak = (text) => {

    window.speechSynthesis.cancel(); // Stop any current speech

    const utterance = new SpeechSynthesisUtterance(text);

    window.speechSynthesis.speak(utterance);

  };

 

  const tabbableElements = document.querySelectorAll('[tabindex="0"]');

 

  tabbableElements.forEach((el) => {

    el.addEventListener("focus", () => {

      if (!lastInteractionWasKeyboard) return;

 

      let text = "";

 

      // Match specific elements from your HTML

      if (el.id === "rate-experience") {

        text = "Rate your experience";

      } else if (el.classList.contains("rating-row")) {

        const labelSpan = el.querySelector("label span");

        text = labelSpan ? labelSpan.innerText : "Rating option";

      } else if (el.id === "comments") {

        text = "Write your feedback here";

      } else if (el.id === "send-feedback") {

        text = "Send Feedback";

      } else if (el.id === "return-chatbot") {

        text = "Return to Chatbot";

      } else if (el.id === "skip-feedback") {

        text = "Exit";

      }

 

      if (text) speak(text);

    });

  });

});
