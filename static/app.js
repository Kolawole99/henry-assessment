const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const sendIcon = document.getElementById('sendIcon');
const loadingIcon = document.getElementById('loadingIcon');

// Conversation ID (could be generated or from session)
const conversationId = 'default';

// Add message to chat
function addMessage(content, isUser = false, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : isError ? 'error-message' : 'bot-message'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Set loading state
function setLoading(isLoading) {
    sendButton.disabled = isLoading;
    messageInput.disabled = isLoading;
    
    if (isLoading) {
        sendIcon.classList.add('hidden');
        loadingIcon.classList.remove('hidden');
    } else {
        sendIcon.classList.remove('hidden');
        loadingIcon.classList.add('hidden');
    }
}

// Handle form submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, true);
    messageInput.value = '';
    
    // Set loading state
    setLoading(true);
    
    try {
        // Send message to API
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                conversation_id: conversationId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to get response');
        }
        
        const data = await response.json();
        
        // Add bot response to chat
        addMessage(data.response, false);
        
    } catch (error) {
        console.error('Error:', error);
        addMessage(`Error: ${error.message}`, false, true);
    } finally {
        setLoading(false);
        messageInput.focus();
    }
});

// Focus input on load
messageInput.focus();
