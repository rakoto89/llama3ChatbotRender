document.addEventListener("DOMContentLoaded", function () {
    const feedbackForm = document.getElementById("feedback-form");
    const langBtn = document.getElementById("lang-btn");
    const langOptions = document.getElementById("language-options");
    const feedbackTitle = document.getElementById("feedback-title");
    const feedbackPlaceholder = document.getElementById("feedback-placeholder");
    
    let currentLanguage = localStorage.getItem("selectedLanguage") || 'en';

    const languageData = {
        en: {
            feedbackTitle: "Feedback",
            feedbackPlaceholder: "Your feedback here..."
        },
        es: {
            feedbackTitle: "Comentarios",
            feedbackPlaceholder: "Tu comentario aquí..."
        },
        fr: {
            feedbackTitle: "Retour",
            feedbackPlaceholder: "Votre retour ici..."
        },
        zh: {
            feedbackTitle: "反馈",
            feedbackPlaceholder: "在这里留下您的反馈..."
        }
    };

    // Update feedback page with current language
    function updateFeedbackPage() {
        feedbackTitle.textContent = languageData[currentLanguage].feedbackTitle;
        feedbackPlaceholder.placeholder = languageData[currentLanguage].feedbackPlaceholder;
    }

    // Update the language selection in localStorage
    if (langBtn && langOptions) {
        langBtn.addEventListener("click", () => {
            langOptions.style.display = langOptions.style.display === "block" ? "none" : "block";
        });

        document.querySelectorAll("#language-options button").forEach(button => {
            button.addEventListener("click", () => {
                const selectedLang = button.getAttribute("data-lang");
                localStorage.setItem("selectedLanguage", selectedLang);
                currentLanguage = selectedLang; // Update language for the feedback page
                updateFeedbackPage(); // Update UI based on the selected language
            });
        });
    }

    // Initialize the feedback page language based on the current setting
    updateFeedbackPage();

});
