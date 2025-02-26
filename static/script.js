const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');
const stopBtn = document.getElementById('stop-btn');
const typingIndicator = document.getElementById('typing-indicator');
let isVoiceEnabled = false; // Only speak if voice button is clicked
let currentUtterance = null; // Track speech synthesis

// Append messages to chat
function appendMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', sender);
  msgDiv.textContent = text;
  chatWindow.appendChild(msgDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Show typing indicator while AI is thinking
function showTypingIndicator() {
  typingIndicator.classList.add('active');
}

function hideTypingIndicator() {
  typingIndicator.classList.remove('active');
}

// Send message to the backend
async function sendMessage(text) {
  const message = text.trim();
  if (!message) return;
  appendMessage(message, 'user');
  userInput.value = '';
  
  showTypingIndicator(); // Show AI thinking

  try {
    const response = await fetch('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: message })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const data = await response.json();
    const botReply = data.answer || "(No response)";

    hideTypingIndicator(); // Hide AI thinking
    appendMessage(botReply, 'bot');

    // Speak response only if voice was enabled
    if (isVoiceEnabled) {
      speakMessage(botReply);
      isVoiceEnabled = false; // Reset after speaking
    }
  } catch (error) {
    hideTypingIndicator();
    console.error('Error:', error);
    appendMessage("Error: Unable to reach the server. Please try again.", 'error');
  }
}

// Handle click on send button
sendBtn.addEventListener('click', () => {
  sendMessage(userInput.value);
});

// Handle pressing Enter key
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage(userInput.value);
  }
});

// Handle speech recognition
let recognition;
if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    userInput.value = transcript;
    isVoiceEnabled = true; // Enable speaking response
    sendMessage(transcript);
  };

  recognition.onend = () => voiceBtn.classList.remove('listening');

  recognition.onerror = (event) => {
    voiceBtn.classList.remove('listening');
    console.error("Speech recognition error:", event.error);
    if (event.error === 'not-allowed') alert('Microphone access denied.');
  };

  voiceBtn.addEventListener('click', () => {
    if (recognition) {
      voiceBtn.classList.add('listening');
      recognition.start();
    }
  });
} else {
  voiceBtn.disabled = true;
  voiceBtn.title = "Voice input not supported in this browser";
}

// Stop AI response button
stopBtn.addEventListener('click', () => {
  if (currentUtterance) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
  hideTypingIndicator();
});

// Speak message function
function speakMessage(text) {
  if (!'speechSynthesis' in window) return;
  if (currentUtterance) window.speechSynthesis.cancel();

  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.lang = 'en-US';
  window.speechSynthesis.speak(currentUtterance);
}

// Speak welcome message on page load
window.onload = () => {
  speakMessage("Welcome to the AI Opioid Education Chatbot, Champ! Here you will learn all about opioids.");
};



