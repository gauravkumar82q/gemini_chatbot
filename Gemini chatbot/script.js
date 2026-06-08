const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const emptyState = document.getElementById('empty-state');

function removeEmptyState() {
    if (emptyState && emptyState.parentNode) {
        emptyState.parentNode.removeChild(emptyState);
    }
}

async function generateResponse(prompt) {
    let response;

    try {
        response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt })
        });
    } catch (fetchError) {
        throw new Error('Network request failed. Start the local server and verify internet access.');
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error || 'Failed to generate response.');
    }

    const text = data?.text;
    if (!text) {
        throw new Error('Model returned an empty response.');
    }

    return text;
}

function cleanMarkdown(text) {
    return text
        .replace(/#{1,6}\s?/g, '')
        .replace(/\*\*/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function getReadableError(error) {
    const rawMessage = error?.message || 'Unknown error occurred.';

    if (rawMessage.includes('429') || rawMessage.toLowerCase().includes('rate limit')) {
        return 'Rate limit reached. Please wait a moment and try again.';
    }

    if (rawMessage.includes('503') || rawMessage.toLowerCase().includes('busy')) {
        return 'Gemini is busy right now. Please retry in a few seconds.';
    }

    if (rawMessage.toLowerCase().includes('network request failed')) {
        return rawMessage;
    }

    return rawMessage.slice(0, 200);
}

function addMessage(message, isUser) {
    removeEmptyState();

    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isUser ? 'user-message' : 'bot-message');

    const profileImage = document.createElement('img');
    profileImage.classList.add('profile-image');
    profileImage.src = isUser ? 'user.jpg' : 'bot.jpg';
    profileImage.alt = isUser ? 'User' : 'Bot';

    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    messageContent.textContent = message;

    messageElement.appendChild(profileImage);
    messageElement.appendChild(messageContent);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function handleUserInput() {
    const userMessage = userInput.value.trim();

    if (userMessage) {
        addMessage(userMessage, true);
        userInput.value = '';
        sendButton.disabled = true;
        userInput.disabled = true;

        try {
            const botMessage = await generateResponse(userMessage);
            addMessage(cleanMarkdown(botMessage), false);
        } catch (error) {
            console.error('Error:', error);
            const safeErrorMessage = getReadableError(error);
            addMessage(`Request failed: ${safeErrorMessage}`, false);
        } finally {
            sendButton.disabled = false;
            userInput.disabled = false;
            userInput.focus();
        }
    }
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleUserInput();
});
