const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const voiceBtn = document.getElementById('voice-btn');
const stopBtn = document.getElementById('stop-btn');
const typingIndicator = document.getElementById('typing-indicator');
let isVoiceEnabled = false; 
let currentUtterance = null;

// Append messages to chat
function appendMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', sender);
  msgDiv.textContent = text;
  chatWindow.appendChild(msgDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Show AI thinking
function showTypingIndicator() {
  typingIndicator.classList.add('active');
}

function hideTypingIndicator() {
  typingIndicator.classList.remove('active');
}

// Send user message
async function sendMessage(text) {
  const message = text.trim();
  if (!message) return;
  appendMessage(message, 'user');
  userInput.value = '';
  
  showTypingIndicator();

  try {
    const response = await fetch('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: message })
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const data = await response.json();
    const botReply = data.answer || "(No response)";

    hideTypingIndicator();
    appendMessage(botReply, 'bot');

    if (isVoiceEnabled) {
      speakMessage(botReply);
      isVoiceEnabled = false;
    }
  } catch (error) {
    hideTypingIndicator();
    appendMessage("Error: Unable to reach the server.", 'error');
  }
}

// Send button click
sendBtn.addEventListener('click', () => {
  sendMessage(userInput.value);
});

// Enter key send message
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage(userInput.value);
  }
});

// Speech recognition
let recognition;
if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    userInput.value = event.results[0][0].transcript;
    isVoiceEnabled = true;
    sendMessage(userInput.value);
  };

  voiceBtn.addEventListener('click', () => {
    voiceBtn.classList.add('listening');
    recognition.start();
  });
}

// Stop AI response
stopBtn.addEventListener('click', () => {
  if (currentUtterance) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
  hideTypingIndicator();
});

// Speak message
function speakMessage(text) {
  currentUtterance = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(currentUtterance);
}

// Welcome message on load
window.onload = () => {
  speakMessage("Welcome to the AI Opioid Education Chatbot, Champ! Here you will learn all about opioids.");
};


