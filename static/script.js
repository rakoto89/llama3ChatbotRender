document.addEventListener('DOMContentLoaded', () => {
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

      

