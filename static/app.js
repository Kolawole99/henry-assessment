const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const sendIcon = document.getElementById('sendIcon');
const loadingIcon = document.getElementById('loadingIcon');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const userInfo = document.getElementById('userInfo');
const userEmail = document.getElementById('userEmail');

// Conversation ID (could be generated or from session)
const conversationId = 'default';

// Authentication state
let currentUser = null;
let pendingMessage = null;

// Check if user is logged in on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showUserInfo();
    }
    // Don't show login modal - allow anonymous browsing
});

// Show login modal
function showLoginModal() {
    loginModal.style.display = 'flex';
    // Don't disable input - user can still browse
}

// Hide login modal
function hideLoginModal() {
    loginModal.style.display = 'none';
    messageInput.focus();
}

// Show user info
function showUserInfo() {
    if (currentUser) {
        userEmail.textContent = currentUser.email;
        userInfo.style.display = 'flex';
        hideLoginModal();
    }
}

// Logout function
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    userInfo.style.display = 'none';
    showLoginModal();
    // Clear chat
    chatMessages.innerHTML = '';
}

// Handle login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('emailInput').value;
    const pin = document.getElementById('pinInput').value;

    loginError.style.display = 'none';

    try {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, pin })
        });

        const data = await response.json();

        if (data.success) {
            currentUser = {
                user_id: data.user_id,
                email: data.email
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showUserInfo();
            loginForm.reset();

            // If there's a pending message, submit it
            if (pendingMessage) {
                messageInput.value = pendingMessage;
                pendingMessage = null;
                chatForm.dispatchEvent(new Event('submit'));
            }
        } else {
            loginError.textContent = data.error || 'Invalid credentials';
            loginError.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'Login failed. Please try again.';
        loginError.style.display = 'block';
    }
});

// Store products globally for selection
let currentProducts = [];

// Product carousel rendering
function renderProductCarousel(products) {
    const carouselDiv = document.createElement('div');
    carouselDiv.className = 'product-carousel';

    const carouselHeader = document.createElement('div');
    carouselHeader.className = 'carousel-header';
    carouselHeader.innerHTML = `
        <h3>Available Products (${products.length})</h3>
        <div class="carousel-controls">
            <button class="carousel-btn prev" onclick="scrollCarousel(event, 'prev')">‹</button>
            <button class="carousel-btn next" onclick="scrollCarousel(event, 'next')">›</button>
        </div>
    `;

    const carouselTrack = document.createElement('div');
    carouselTrack.className = 'carousel-track';

    products.forEach((product, index) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-image" onerror="this.src='https://via.placeholder.com/300x200?text=${encodeURIComponent(product.name)}'">
            <div class="product-info">
                <h4 class="product-name">${product.name}</h4>
                ${product.category ? `<p class="product-category">${product.category}</p>` : ''}
                <p class="product-sku">SKU: ${product.id}</p>
                <div class="product-details">
                    <span class="product-price">$${product.price.toFixed(2)}</span>
                    <span class="product-stock">${product.stock} in stock</span>
                </div>
                <div class="quantity-selector">
                    <label for="qty-${index}">Quantity:</label>
                    <input type="number" id="qty-${index}" class="quantity-input" value="1" min="1" max="${product.stock}">
                </div>
                <button class="select-product-btn" onclick="selectProduct('${product.id}', '${product.name.replace(/'/g, "\\'")}', ${index})">
                    Select
                </button>
            </div>
        `;
        carouselTrack.appendChild(card);
    });

    carouselDiv.appendChild(carouselHeader);
    carouselDiv.appendChild(carouselTrack);

    return carouselDiv;
}

// Scroll carousel
function scrollCarousel(event, direction) {
    event.preventDefault();
    const carousel = event.target.closest('.product-carousel');
    const track = carousel.querySelector('.carousel-track');
    if (!track) return;

    const cardWidth = 320; // card width + gap
    const scrollAmount = direction === 'next' ? cardWidth : -cardWidth;

    track.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });
}

// Select product
function selectProduct(sku, productName, index) {
    const quantityInput = document.getElementById(`qty-${index}`);
    const quantity = quantityInput ? quantityInput.value : 1;

    messageInput.value = `I'd like to order ${quantity} x ${productName} (SKU: ${sku})`;
    messageInput.focus();
}

// Add message to chat
function addMessage(content, isUser = false, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : isError ? 'error-message' : 'bot-message'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Try to parse as JSON for product carousel
    if (!isUser && !isError) {
        try {
            const parsed = JSON.parse(content);
            if (parsed.type === 'product_list' && parsed.products) {
                // Render product carousel
                const carousel = renderProductCarousel(parsed.products);
                contentDiv.appendChild(carousel);
                currentProducts = parsed.products;
            } else {
                contentDiv.textContent = content;
            }
        } catch (e) {
            // Not JSON, render as text
            contentDiv.textContent = content;
        }
    } else {
        contentDiv.textContent = content;
    }

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

    // Add loading indicator message
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot-message';
    loadingDiv.id = 'loading-message';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content loading-content';
    contentDiv.innerHTML = 'Thinking<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>';

    loadingDiv.appendChild(contentDiv);
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        // Send message to API
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                conversation_id: conversationId,
                user_id: currentUser?.user_id
            })
        });

        // Remove loading indicator
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.remove();
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to get response');
        }

        const data = await response.json();

        // Add bot response to chat
        addMessage(data.response, false);

    } catch (error) {
        console.error('Error:', error);

        // Remove loading indicator
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.remove();
        }

        addMessage(`Error: ${error.message}`, false, true);
    } finally {
        setLoading(false);
        messageInput.focus();
    }
});

// Focus input on load
messageInput.focus();
