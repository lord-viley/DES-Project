// Customer screen: browse products, order, cancel, request a return
let discount = 0;
let allProducts = [];

async function api(url, options) {
    const response = await fetch(url, options);
    if (response.status === 401) {
        window.location.href = 'index.html';
        throw new Error('Not logged in');
    }
    return { ok: response.ok, data: await response.json() };
}

function post(url, body) {
    return api(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
    });
}

function money(value) {
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Fetch the products once and remember them
async function loadProducts() {
    const list = document.getElementById('productList');
    const { ok, data } = await api('/api/shop/products');

    if (!ok) {
        list.textContent = data.message || 'Could not load products.';
        return;
    }

    allProducts = data;
    renderProducts();
}

// Draw the products that match the search box (all of them when it is empty)
function renderProducts() {
    const list = document.getElementById('productList');
    const query = document.getElementById('productSearch').value.trim().toLowerCase();

    const matches = allProducts.filter((product) =>
        product.Product_Name.toLowerCase().includes(query) ||
        product.Category.toLowerCase().includes(query)
    );

    list.innerHTML = '';

    if (matches.length === 0) {
        const note = document.createElement('p');
        note.className = 'hint';
        note.textContent = allProducts.length === 0
            ? 'No products are available yet.'
            : `No products match "${query}".`;
        list.appendChild(note);
        return;
    }

    matches.forEach((product) => {
        const card = document.createElement('div');
        card.className = 'table-card';

        const img = document.createElement('img');
        img.className = 'product-img';
        img.alt = product.Product_Name;
        img.src = product.Image_URL || 'images/placeholder.svg';
        img.onerror = () => { img.onerror = null; img.src = 'images/placeholder.svg'; };

        const info = document.createElement('div');
        info.className = 'info';
        const title = document.createElement('strong');
        title.textContent = product.Product_Name;
        const detail = document.createElement('div');
        detail.className = 'field-note';
        const price = Number(product.Price);
        const final = price * (1 - discount / 100);
        detail.textContent = discount > 0
            ? `${product.Category} | KES ${money(final)} (your ${discount}% discount applied) | ${product.Quantity} in stock`
            : `${product.Category} | KES ${money(price)} | ${product.Quantity} in stock`;
        info.appendChild(title);
        info.appendChild(detail);

        const actions = document.createElement('div');
        actions.className = 'actions';
        const button = makeButton(product.Quantity > 0 ? 'Order' : 'Sold out', () => placeOrder(product));
        button.disabled = product.Quantity < 1;
        actions.appendChild(button);

        card.appendChild(img);
        card.appendChild(info);
        card.appendChild(actions);
        list.appendChild(card);
    });
}

async function loadOrders() {
    const list = document.getElementById('orderList');
    const { ok, data: orders } = await api('/api/shop/orders');
    if (!ok) {
        list.textContent = orders.message || 'Could not load your orders.';
        return;
    }
    list.innerHTML = '';

    if (orders.length === 0) {
        const none = document.createElement('p');
        none.className = 'hint';
        none.textContent = 'You have not placed any orders yet.';
        list.appendChild(none);
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    const table = document.createElement('table');
    table.className = 'data-table';

    const headRow = table.createTHead().insertRow();
    ['Order', 'Product', 'Date', 'Total', 'Status', 'Payment', 'Return', ''].forEach((name) => {
        const th = document.createElement('th');
        th.textContent = name;
        headRow.appendChild(th);
    });

    const body = table.createTBody();
    orders.forEach((order) => {
        const tr = body.insertRow();
        [order.Order_No, order.Product_Name, order.Order_date, money(order.Total_Amount),
         order.Package_status, order.Payment_Status || '-', order.Return_Status || '-']
            .forEach((value) => { tr.insertCell().textContent = value; });

        const actionCell = tr.insertCell();
        if (order.Package_status === 'Processing') {
            actionCell.appendChild(makeButton('Cancel', () => cancelOrder(order.Order_No), 'btn-danger'));
        } else if (order.Package_status === 'Delivered' && !order.Return_Status) {
            actionCell.appendChild(makeButton('Return', () => requestReturn(order.Order_No)));
        }
    });

    wrapper.appendChild(table);
    list.appendChild(wrapper);
}

async function placeOrder(product) {
    const method = document.getElementById('paymentMethod').value;
    if (!confirm(`Order ${product.Product_Name} and pay with ${method}?`)) return;
    const { data } = await post('/api/shop/orders', { Product_ID: product.Product_ID, Payment_Method: method });
    alert(data.message);
    refresh();
}

async function cancelOrder(orderNo) {
    if (!confirm(`Cancel order ${orderNo}?`)) return;
    const { data } = await post(`/api/shop/orders/${orderNo}/cancel`);
    alert(data.message);
    refresh();
}

async function requestReturn(orderNo) {
    const reason = prompt(`Why are you returning order ${orderNo}?`);
    if (!reason || reason.trim() === '') return;
    const { data } = await post('/api/shop/returns', { Order_No: orderNo, Reason: reason });
    alert(data.message);
    refresh();
}

function refresh() {
    loadProducts();
    loadOrders();
}

document.addEventListener('DOMContentLoaded', async function () {
    try {
        const me = await api('/api/me');
        if (me.data.role === 'admin') {
            window.location.href = 'dashboard.html';
            return;
        }

        const { data: profile } = await api('/api/shop/profile');
        discount = Number(profile.discount);
        let welcome = `Welcome, ${profile.name}.`;
        if (discount > 0) welcome += ` You get ${discount}% off every order.`;
        if (profile.nextTier) {
            const n = profile.nextTier.ordersToGo;
            welcome += ` Place ${n} more order${n === 1 ? '' : 's'} to unlock ${profile.nextTier.percentage}% off.`;
        }
        document.getElementById('welcome').textContent = welcome;

        const select = document.getElementById('paymentMethod');
        profile.paymentMethods.forEach((method) => {
            const option = document.createElement('option');
            option.textContent = method;
            select.appendChild(option);
        });

        document.getElementById('logoutLink').addEventListener('click', async function (e) {
            e.preventDefault();
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = 'index.html';
        });

        refresh();
    } catch (error) {
        console.error('Error loading shop:', error);
    }
});

// Search as the customer types
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('productSearch').addEventListener('input', renderProducts);
});