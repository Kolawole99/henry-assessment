const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const sendIcon = document.getElementById('sendIcon');
const loadingIcon = document.getElementById('loadingIcon');

// Conversation ID
const conversationId = 'default';

// Store products and order context
let currentProducts = [];
let currentOrderContext = null;

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

// Render order confirmation card
function renderOrderCard(orderData) {
    // Store order context for later use
    currentOrderContext = {
        customer_id: orderData.customer_id,
        order_details: orderData.order_details
    };

    const card = document.createElement('div');
    card.className = 'order-card';

    let orderHTML = `
        <div class="order-header">
            <h3>📋 Order Confirmation</h3>
            <p class="customer-id">Customer ID: ${orderData.customer_id}</p>
        </div>
        <div class="order-items">
            <h4>Order Items:</h4>
            <ul>
    `;

    orderData.order_details.forEach(item => {
        orderHTML += `
            <li>
                <span class="item-sku">${item.product_id}</span>
                <span class="item-qty">Quantity: ${item.quantity}</span>
            </li>
        `;
    });

    orderHTML += `
            </ul>
        </div>
        <button class="place-order-btn" onclick="placeOrder()">
            Place Order
        </button>
    `;

    card.innerHTML = orderHTML;
    return card;
}

// Scroll carousel
function scrollCarousel(event, direction) {
    event.preventDefault();
    const carousel = event.target.closest('.product-carousel');
    const track = carousel.querySelector('.carousel-track');
    if (!track) return;

    const cardWidth = 320;
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

// Place order function
function placeOrder() {
    if (!currentOrderContext) {
        addMessage('Error: No order context found', false, true);
        return;
    }

    // Send order confirmation with full context
    const message = `Please confirm and place my order. Customer ID: ${currentOrderContext.customer_id}, Order details: ${JSON.stringify(currentOrderContext.order_details)}`;
    messageInput.value = message;
    chatForm.dispatchEvent(new Event('submit'));
}

// Add message to chat
function addMessage(content, isUser = false, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : isError ? 'error-message' : 'bot-message'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Try to parse as JSON for special rendering
    if (!isUser && !isError) {
        try {
            const parsed = JSON.parse(content);

            // Product list carousel
            if (parsed.type === 'product_list' && parsed.products) {
                const carousel = renderProductCarousel(parsed.products);
                contentDiv.appendChild(carousel);
                currentProducts = parsed.products;
            }
            // Order history list
            else if (parsed.type === 'order_history' && parsed.orders) {
                const orderHistory = renderOrderHistory(parsed.orders);
                contentDiv.appendChild(orderHistory);
            }
            // Order confirmation card
            else if (parsed.customer_id && parsed.order_details) {
                const orderCard = renderOrderCard(parsed);
                contentDiv.appendChild(orderCard);
            }
            else {
                contentDiv.textContent = content;
            }
        } catch (e) {
            contentDiv.textContent = content;
        }
    } else {
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Render order history
function renderOrderHistory(orders) {
    const historyDiv = document.createElement('div');
    historyDiv.className = 'order-history';

    // Check if orders array is empty
    if (!orders || orders.length === 0) {
        historyDiv.innerHTML = `
            <div class="empty-orders">
                <div class="empty-icon">📦</div>
                <h3>No Orders Yet</h3>
                <p>You haven't placed any orders yet. Browse our products and place your first order!</p>
            </div>
        `;
        return historyDiv;
    }

    let historyHTML = `
        <div class="history-header">
            <h3>📦 Your Orders (${orders.length})</h3>
        </div>
        <div class="orders-list">
    `;

    orders.forEach(order => {
        const statusClass = order.status === 'completed' ? 'status-completed' :
            order.status === 'pending' ? 'status-pending' : 'status-cancelled';

        historyHTML += `
            <div class="order-item">
                <div class="order-item-header">
                    <span class="order-id">Order #${order.order_id.substring(0, 8)}</span>
                    <span class="order-status ${statusClass}">${order.status}</span>
                </div>
                <div class="order-item-details">
                    <p class="order-date">${new Date(order.created_at).toLocaleDateString()}</p>
                    <ul class="order-products">
        `;

        order.items.forEach(item => {
            historyHTML += `<li>${item.product_id} × ${item.quantity}</li>`;
        });

        historyHTML += `
                    </ul>
                </div>
            </div>
        `;
    });

    historyHTML += `
        </div>
    `;

    historyDiv.innerHTML = historyHTML;
    return historyDiv;
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

    addMessage(message, true);
    messageInput.value = '';
    setLoading(true);

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

        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.remove();
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to get response');
        }

        const data = await response.json();
        addMessage(data.response, false);

    } catch (error) {
        console.error('Error:', error);

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

messageInput.focus();
