// ---------- Login / Sign up / Forgot password ----------

// Show one of the three forms on the login page
function showForm(formId) {
    ['loginForm', 'signupForm', 'forgotForm'].forEach((id) => {
        const form = document.getElementById(id);
        if (form) form.style.display = id === formId ? 'block' : 'none';
    });
}

function toggleForgotPass(showForgot) {
    showForm(showForgot ? 'forgotForm' : 'loginForm');
}

// Sign up: create the account, then go straight to the shop
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const username = document.getElementById('newUsername').value;
        const password = document.getElementById('newPassword').value;

        if (password !== document.getElementById('confirmPassword').value) {
            alert('Passwords do not match.');
            return;
        }

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password,
                    fullName: document.getElementById('fullName').value,
                    email: document.getElementById('signupEmail').value,
                    phone: document.getElementById('signupPhone').value
                })
            });
            const result = await response.json();

            if (result.success) {
                window.location.href = 'shop.html';
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error during sign up:', error);
            alert('Server error. Ensure Node server is running.');
        }
    });
}

// Handle login form submission via API
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameInput, password: passwordInput })
            });

            const result = await response.json();

            if (result.success) {
                window.location.href = result.role === 'admin' ? 'dashboard.html' : 'shop.html';
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error during login:', error);
            alert('Server error. Ensure Node server is running.');
        }
    });
}

// Forgot password is a demo: no email service is connected
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
    forgotForm.addEventListener('submit', function (e) {
        e.preventDefault();
        alert('If this email is registered, a reset link will be sent. (Demo only: no email service connected.)');
        toggleForgotPass(false);
    });
}

// ---------- Shared helpers ----------

async function fetchSchema() {
    const response = await fetch('/api/schema');
    return response.json();
}

function hasTable(schema, tableName) {
    return Object.prototype.hasOwnProperty.call(schema, tableName);
}

function makeButton(label, onClick, extraClass) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (extraClass) button.className = extraClass;
    button.addEventListener('click', onClick);
    return button;
}

// ---------- Dashboard ----------

// Totals and low-stock alert, refreshed whenever the dashboard opens
async function loadSummary() {
    const box = document.getElementById('summary');
    if (!box) return;

    try {
        const response = await fetch('/api/reports/summary');
        const data = await response.json();

        const stats = [
            ['Customers', data.customers],
            ['Products', data.products],
            ['Orders', data.orders],
            ['Revenue (paid)', Number(data.revenue).toLocaleString()],
            ['Pending payments', data.pendingPayments],
            ['Pending returns', data.pendingReturns]
        ];

        stats.forEach(([label, value]) => {
            const stat = document.createElement('div');
            stat.className = 'stat';

            const number = document.createElement('span');
            number.className = 'stat-number';
            number.textContent = value;

            const text = document.createElement('span');
            text.className = 'stat-label';
            text.textContent = label;

            stat.appendChild(number);
            stat.appendChild(text);
            box.appendChild(stat);
        });

        if (data.lowStock.length > 0) {
            const alertBox = document.createElement('div');
            alertBox.className = 'alert-box';
            alertBox.textContent = `Low stock (${data.lowStockThreshold} or fewer units):`;
            const ul = document.createElement('ul');
            data.lowStock.forEach((item) => {
                const li = document.createElement('li');
                li.textContent = `${item.Product_Name}: ${item.Quantity_Available} left`;
                ul.appendChild(li);
            });
            alertBox.appendChild(ul);
            box.appendChild(alertBox);
        }
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

// Build one card per table (View, Update, Delete) and a sidebar link per table
async function loadDashboard() {
    const list = document.getElementById('tableList');
    if (!list) return;

    try {
        const schema = await fetchSchema();
        const sideNav = document.getElementById('sideNav');

        Object.keys(schema).forEach((tableName) => {
            const card = document.createElement('div');
            card.className = 'table-card';

            const title = document.createElement('strong');
            title.textContent = tableName;

            const actions = document.createElement('div');
            actions.className = 'actions';
            actions.appendChild(makeButton('View', () => viewTable(tableName)));
            actions.appendChild(makeButton('Update', () => goToUpdate(tableName)));
            actions.appendChild(makeButton('Delete', () => deleteTableRecord(tableName), 'btn-danger'));

            card.appendChild(title);
            card.appendChild(actions);
            list.appendChild(card);

            if (sideNav) {
                sideNav.appendChild(makeButton(tableName, () => viewTable(tableName), 'side-link'));
            }
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Server error. Ensure Node server is running.');
    }
}

// Sidebar links on the Update page (the dashboard builds its own in loadDashboard)
async function loadSideNav() {
    const nav = document.getElementById('sideNav');
    if (!nav || document.getElementById('tableList')) return;

    const current = new URLSearchParams(window.location.search).get('table');

    try {
        const schema = await fetchSchema();
        Object.keys(schema).forEach((tableName) => {
            const link = document.createElement('a');
            link.className = 'side-link' + (tableName === current ? ' active' : '');
            link.href = `update.html?table=${encodeURIComponent(tableName)}`;
            link.textContent = tableName;
            nav.appendChild(link);
        });
    } catch (error) {
        console.error('Error loading sidebar:', error);
    }
}

// Show all records of a table in the results area (with search, badges, close)
async function viewTable(tableName) {
    const results = document.getElementById('results');

    try {
        const response = await fetch(`/api/${encodeURIComponent(tableName)}`);
        if (!response.ok) {
            const failure = await response.json();
            alert(failure.message);
            return;
        }
        const rows = await response.json();
        const totalLabel = `${rows.length} record${rows.length === 1 ? '' : 's'}`;

        results.innerHTML = '';

        // Header bar: title, count badge, search box, close button
        const bar = document.createElement('div');
        bar.className = 'results-bar';

        const heading = document.createElement('h3');
        heading.textContent = tableName;

        const count = document.createElement('span');
        count.className = 'count-badge';
        count.textContent = totalLabel;

        const search = document.createElement('input');
        search.type = 'search';
        search.className = 'results-search';
        search.placeholder = `Search ${tableName.toLowerCase()}...`;

        const close = makeButton('Close', () => { results.innerHTML = ''; }, 'results-close');

        bar.appendChild(heading);
        bar.appendChild(count);
        bar.appendChild(search);
        bar.appendChild(close);
        results.appendChild(bar);
        results.scrollIntoView({ behavior: 'smooth' });

        if (rows.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'no-match';
            empty.textContent = 'No records in this table yet.';
            results.appendChild(empty);
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';

        const table = document.createElement('table');
        table.className = 'data-table';

        const headRow = table.createTHead().insertRow();
        Object.keys(rows[0]).forEach((column) => {
            const th = document.createElement('th');
            th.textContent = column;
            headRow.appendChild(th);
        });

        const body = table.createTBody();
        rows.forEach((row) => {
            const tr = body.insertRow();
            Object.entries(row).forEach(([column, value]) => {
                const cell = tr.insertCell();
                if (column === 'Package_status' || column === 'Status') {
                    const badge = document.createElement('span');
                    badge.className = 'badge badge-' + String(value).toLowerCase();
                    badge.textContent = value;
                    cell.appendChild(badge);
                } else {
                    cell.textContent = value;
                }
            });
        });

        wrapper.appendChild(table);
        results.appendChild(wrapper);

        const noMatch = document.createElement('p');
        noMatch.className = 'no-match';
        noMatch.style.display = 'none';
        noMatch.textContent = 'No records match your search.';
        results.appendChild(noMatch);

        // Filter rows as the user types
        search.addEventListener('input', () => {
            const query = search.value.trim().toLowerCase();
            let shown = 0;

            Array.from(body.rows).forEach((tr) => {
                const match = tr.textContent.toLowerCase().includes(query);
                tr.style.display = match ? '' : 'none';
                if (match) shown++;
            });

            count.textContent = query ? `${shown} of ${rows.length}` : totalLabel;
            noMatch.style.display = shown === 0 ? 'block' : 'none';
        });
    } catch (error) {
        console.error('Error loading records:', error);
        alert('Server error. Ensure Node server is running.');
    }
}

// Redirect to update.html with the selected table parameter
function goToUpdate(tableName) {
    window.location.href = `update.html?table=${encodeURIComponent(tableName)}`;
}

// Delete one record, chosen by its primary key
async function deleteTableRecord(tableName) {
    try {
        const schema = await fetchSchema();
        const pk = schema[tableName].pk;

        const id = prompt(`Enter the ${pk} of the ${tableName} record to delete:`);
        if (!id || id.trim() === '') return;

        if (!confirm(`Delete ${tableName} record with ${pk} = ${id.trim()}? This cannot be undone.`)) return;

        const response = await fetch(
            `/api/${encodeURIComponent(tableName)}/${encodeURIComponent(id.trim())}`,
            { method: 'DELETE' }
        );
        const result = await response.json();
        alert(result.message);

        // Refresh the totals so they reflect the deletion
        const summary = document.getElementById('summary');
        if (summary) {
            summary.innerHTML = '';
            loadSummary();
        }
    } catch (error) {
        console.error('Error deleting record:', error);
        alert('Server error. Ensure Node server is running.');
    }
}

// ---------- Update form ----------

function addOption(select, value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    select.appendChild(opt);
}

// Build one input from the field's validation rule.
// The primary key and optional fields are not required (blank = auto-filled / new record).
async function buildInput(field, rule, schema, isPk, isOptional) {
    let input;
    const blankLabel = isOptional ? 'Auto (leave blank)' : `Select ${field}`;

    if (rule.type === 'select') {
        input = document.createElement('select');
        addOption(input, '', blankLabel);
        rule.options.forEach((o) => addOption(input, o, o));
    } else if (rule.type === 'ref') {
        input = document.createElement('select');
        addOption(input, '', blankLabel);
        const rows = await (await fetch(`/api/${encodeURIComponent(rule.table)}`)).json();
        const parent = schema[rule.table];
        rows.forEach((r) => addOption(input, r[parent.pk], `${r[parent.pk]} - ${r[parent.columns[1]]}`));
    } else {
        input = document.createElement('input');
        input.type = rule.type || (field.toLowerCase().includes('date') ? 'date' : 'text');
        if (rule.min !== undefined) input.min = rule.min;
        if (rule.max !== undefined) input.max = rule.max;
        if (rule.step !== undefined) input.step = rule.step;
        if (rule.pattern) input.pattern = rule.pattern;
        if (field.endsWith('_ID') || field.endsWith('_No')) {
            input.type = 'number';
            input.min = 1;
            input.step = 1;
        }
        input.title = rule.hint || '';

        if (isPk) {
            input.placeholder = 'Leave blank for a new record';
        } else if (field === 'Image_URL') {
            input.placeholder = 'images/your-picture.jpg';
            note.textContent = 'Optional: path to a picture in public/images. Leave blank to show a "No image" placeholder.';
        } else if (isOptional) {
            input.placeholder = 'Filled in automatically';
        } else {
            input.placeholder = rule.hint || `Enter ${field}`;
        }
    }

    input.name = field;
    input.required = !isPk && !isOptional;
    return input;
}

// Generate form inputs from the selected table's schema
async function loadUpdateForm() {
    const form = document.getElementById('updateForm');
    const dynamicFields = document.getElementById('dynamicFields');
    const updateTitle = document.getElementById('updateTitle');
    if (!form || !dynamicFields) return;

    const tableName = new URLSearchParams(window.location.search).get('table');

    let schema;
    try {
        schema = await fetchSchema();
    } catch (error) {
        console.error('Error loading schema:', error);
        alert('Server error. Ensure Node server is running.');
        return;
    }

    if (!tableName || !hasTable(schema, tableName)) {
        updateTitle.innerText = 'Table not found';
        return;
    }

    const { pk, columns, optional = [], fields = {} } = schema[tableName];
    updateTitle.innerText = `Add / Update ${tableName}`;

    for (const field of columns) {
        const rule = fields[field] || {};
        const isPk = field === pk;
        const isOptional = optional.includes(field);

        const div = document.createElement('div');
        div.className = 'form-group';

        const label = document.createElement('label');
        label.innerText = field;

        div.appendChild(label);
        div.appendChild(await buildInput(field, rule, schema, isPk, isOptional));

        if (isPk || isOptional) {
            const note = document.createElement('div');
            note.className = 'field-note';
            note.textContent = isPk
                ? 'Auto-numbered when blank.'
                : 'Optional: the system fills this in if left blank.';
            div.appendChild(note);
        }

        dynamicFields.appendChild(div);
    }

    const pkInput = form.elements[pk];

    // Typing an existing ID loads that record so you can edit just what changed
    pkInput.addEventListener('change', async function () {
        const id = pkInput.value.trim();
        if (id === '') return;
        try {
            const response = await fetch(`/api/${encodeURIComponent(tableName)}/${encodeURIComponent(id)}`);
            if (!response.ok) {
                alert(`No ${tableName} record with ${pk} = ${id}. Clear the ID to add a new record.`);
                return;
            }
            const record = await response.json();
            columns.forEach((field) => {
                if (field !== pk) form.elements[field].value = record[field] ?? '';
            });
        } catch (error) {
            console.error('Error loading record:', error);
        }
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const data = {};
        new FormData(form).forEach((value, key) => {
            data[key] = value;
        });

        // Blank ID = create (POST); existing ID = update (PUT)
        const id = (data[pk] || '').trim();
        const url = id === ''
            ? `/api/${encodeURIComponent(tableName)}`
            : `/api/${encodeURIComponent(tableName)}/${encodeURIComponent(id)}`;

        try {
            const response = await fetch(url, {
                method: id === '' ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            alert(result.message);
            if (result.success) form.reset();
        } catch (error) {
            console.error('Error saving record:', error);
            alert('Server error. Ensure Node server is running.');
        }
    });
}

// ---------- Page setup ----------

// Dashboard and update pages: send visitors who are not logged in (or not admins) elsewhere
async function requireLogin() {
    const response = await fetch('/api/me');
    if (!response.ok) {
        window.location.href = 'index.html';
        return false;
    }
    const me = await response.json();
    if (me.role !== 'admin') {
        window.location.href = 'shop.html';
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', async function () {
    const isInnerPage = document.getElementById('tableList') || document.getElementById('updateForm');
    if (!isInnerPage) return;
    if (!(await requireLogin())) return;

    const logout = document.getElementById('logoutLink');
    if (logout) {
        logout.addEventListener('click', async function (e) {
            e.preventDefault();
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = 'index.html';
        });
    }

    loadSummary();
    loadDashboard();
    loadSideNav();
    loadUpdateForm();
});