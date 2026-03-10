// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD7CSsPu6jk82HyteIaVZ5XR9gv9HiqExg",
    authDomain: "final-19d78.firebaseapp.com",
    projectId: "final-19d78",
    storageBucket: "final-19d78.firebasestorage.app",
    messagingSenderId: "1031737862367",
    appId: "1:1031737862367:web:c2676fb3a718622f25e16a",
    measurementId: "G-5TST3CWW7B"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const collectionName = "textile_stock";

// DOM Elements
const loginSection = document.getElementById('login-section');
const mainContent = document.getElementById('main-content');
const sidebar = document.getElementById('sidebar');
const loginForm = document.getElementById('login-form');
const loginIdInput = document.getElementById('login-id');
const loginPassInput = document.getElementById('login-pass');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const toastContainer = document.getElementById('toast-container');

// Navigation Elements
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.content-section');

// Stock Form Elements
const stockForm = document.getElementById('stock-form');
const stockIdInput = document.getElementById('stock-id');
const fabricTypeInput = document.getElementById('fabric-type');
const fabricColorNameInput = document.getElementById('fabric-color-name');
const fabricQtyInput = document.getElementById('fabric-qty');
const fabricDateInput = document.getElementById('fabric-date');
const fabricPriceInput = document.getElementById('fabric-price');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');

// Sales Form Elements
const salesForm = document.getElementById('sales-form');
const saleStockSelect = document.getElementById('sale-stock-item');
const saleQtyInput = document.getElementById('sale-qty');
const salePriceInput = document.getElementById('sale-price');
const saleDateInput = document.getElementById('sale-date');
const availableQtyMsg = document.getElementById('available-qty-msg');

// Tables & Stats
const stockTableBody = document.getElementById('stock-table-body');
const salesTableBody = document.getElementById('sales-table-body');
const activityLogsBody = document.getElementById('activity-logs-body');
const recentLogsList = document.getElementById('recent-logs-list');

const totalStockCount = document.getElementById('total-stock-count');
const totalSalesValue = document.getElementById('total-sales-value');
const totalProfitValue = document.getElementById('total-profit-value');
const lowStockCount = document.getElementById('low-stock-count');
const filterSearch = document.getElementById('filter-search');

// State
let stockData = [];
let salesData = [];
let currentUser = "Admin";

// --- Navigation Logic ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetSection = item.getAttribute('data-section');

        // Update active nav
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Show target section
        sections.forEach(sec => {
            sec.classList.add('d-none');
            if (sec.id === targetSection) sec.classList.remove('d-none');
        });
    });
});

// --- Authentication Logic ---
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = loginIdInput.value.trim();
    const pass = loginPassInput.value.trim();

    if (id === "ADMIN" && pass === "PASS123") {
        loginSection.classList.add('d-none');
        mainContent.classList.remove('d-none');
        sidebar.classList.remove('d-none');
        loadAllData();
    } else {
        loginError.classList.remove('d-none');
        setTimeout(() => loginError.classList.add('d-none'), 3000);
    }
});

logoutBtn.addEventListener('click', () => {
    mainContent.classList.add('d-none');
    sidebar.classList.add('d-none');
    loginSection.classList.remove('d-none');
    loginForm.reset();
});

// --- Data Loading ---
function loadAllData() {
    // Real-time Stock
    db.collection("textile_stock").orderBy("date", "desc").onSnapshot(snapshot => {
        stockData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderStockTable();
        updateSalesStockDropdown();
        calculateStats();
        updateChart(stockData);
        triggerAutoAI(); // Auto-pilot business audit
    });

    // Real-time Sales
    db.collection("sales").orderBy("date", "desc").onSnapshot(snapshot => {
        salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSalesTable();
        calculateStats();
        triggerAutoAI(); // Updated insights based on sales
    });

    // Real-time Logs
    db.collection("activity_logs").orderBy("timestamp", "desc").limit(50).onSnapshot(snapshot => {
        const logs = snapshot.docs.map(doc => doc.data());
        renderLogs(logs);
    });
}

// --- Firestore Logic ---

// --- Logging Logic ---
function logAction(action, category, details) {
    const logEntry = {
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        action: action, // 'CREATE', 'UPDATE', 'DELETE'
        category: category, // 'STOCK', 'SALE'
        details: details,
        user: currentUser
    };
    db.collection("activity_logs").add(logEntry);
}

function renderLogs(logs) {
    activityLogsBody.innerHTML = "";
    recentLogsList.innerHTML = "";

    logs.forEach(log => {
        const time = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : "Just now";

        // Full Log Table
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${time}</td>
            <td><span class="badge ${log.action === 'CREATE' ? 'bg-success' : log.action === 'DELETE' ? 'bg-danger' : 'bg-warning'}">${log.action}</span></td>
            <td>${log.category}</td>
            <td>${log.details}</td>
            <td>${log.user}</td>
        `;
        activityLogsBody.appendChild(row);

        // Recent Activity List (Dashboard)
        const item = document.createElement('div');
        item.className = `activity-item ${log.action.toLowerCase()}`;
        item.innerHTML = `
            <div class="d-flex justify-content-between">
                <strong>${log.category}: ${log.action}</strong>
                <small>${time}</small>
            </div>
            <div class="small">${log.details}</div>
        `;
        recentLogsList.appendChild(item);
    });
}

// Add / Update Stock
stockForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = stockIdInput.value;
    const qty = parseFloat(fabricQtyInput.value);

    const stockItem = {
        type: fabricTypeInput.value,
        colorName: fabricColorNameInput.value.trim(),
        qty: qty,
        date: fabricDateInput.value,
        price: parseFloat(fabricPriceInput.value),
        total: qty * parseFloat(fabricPriceInput.value)
    };

    if (id) {
        db.collection("textile_stock").doc(id).update(stockItem)
            .then(() => {
                logAction('UPDATE', 'STOCK', `Updated stock: ${stockItem.type} (${stockItem.qty}KG)`);
                resetForm();
                showToast("Stock updated successfully!", 'success');
            });
    } else {
        db.collection("textile_stock").add(stockItem)
            .then(() => {
                logAction('CREATE', 'STOCK', `Added new stock: ${stockItem.type} (${stockItem.qty}KG)`);
                resetForm();
                showToast("New stock added successfully!", 'success');
            });
    }
});

// --- Sales Logic ---
function updateSalesStockDropdown() {
    saleStockSelect.innerHTML = '<option value="" disabled selected>Select from Stock</option>';
    stockData.forEach(item => {
        if (item.qty > 0) {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.type} - ${item.colorName} (${item.qty}KG)`;
            saleStockSelect.appendChild(option);
        }
    });
}

saleStockSelect.addEventListener('change', () => {
    const item = stockData.find(s => s.id === saleStockSelect.value);
    if (item) {
        availableQtyMsg.textContent = `Available: ${item.qty} KG | Cost: ₹${item.price}/KG`;
        salePriceInput.value = item.price + 50; // Suggested markup
    }
});

salesForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const stockId = saleStockSelect.value;
    const qtySold = parseFloat(saleQtyInput.value);
    const sellPrice = parseFloat(salePriceInput.value);
    const stockItem = stockData.find(s => s.id === stockId);

    if (qtySold > stockItem.qty) {
        showToast("Insufficient stock!", "error");
        return;
    }

    const saleEntry = {
        stockId: stockId,
        itemType: stockItem.type,
        qty: qtySold,
        costPrice: stockItem.price,
        sellPrice: sellPrice,
        totalSale: qtySold * sellPrice,
        profit: (sellPrice - stockItem.price) * qtySold,
        date: saleDateInput.value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Update Stock Qty and Record Sale
    const batch = db.batch();
    const stockRef = db.collection("textile_stock").doc(stockId);
    const saleRef = db.collection("sales").doc();

    batch.update(stockRef, { qty: stockItem.qty - qtySold });
    batch.set(saleRef, saleEntry);

    batch.commit().then(() => {
        logAction('CREATE', 'SALE', `Sold ${qtySold}KG of ${stockItem.type} for ₹${saleEntry.totalSale}`);
        salesForm.reset();
        availableQtyMsg.textContent = "";
        showToast("Sale completed successfully!", "success");
    }).catch(err => {
        showToast("Sale failed: " + err.message, "error");
    });
});


function resetForm() {
    stockForm.reset();
    stockIdInput.value = "";
    // Reset Color Picker default

    saveBtn.innerHTML = "Save Stock";
    saveBtn.classList.remove('btn-warning');
    saveBtn.classList.add('btn-success');
    cancelBtn.classList.add('d-none');
}

cancelBtn.addEventListener('click', resetForm);

// Edit Stock
window.editStock = (id) => {
    const item = stockData.find(s => s.id === id);
    if (!item) return;

    stockIdInput.value = item.id;
    fabricTypeInput.value = item.type || "";
    fabricColorNameInput.value = item.colorName || "";
    // fabricColorHexInput.value = item.colorHex || "#000000"; // Removed
    fabricQtyInput.value = item.qty;
    fabricDateInput.value = item.date;
    fabricPriceInput.value = item.price;

    saveBtn.innerHTML = "Update Stock";
    saveBtn.classList.remove('btn-success');
    saveBtn.classList.add('btn-warning');
    cancelBtn.classList.remove('d-none');

    // Scroll to form
    stockForm.scrollIntoView({ behavior: 'smooth' });
};

// Delete Stock
window.deleteStock = (id) => {
    if (confirm("Are you sure you want to delete this item?")) {
        db.collection(collectionName).doc(id).delete()
            .then(() => showToast("Item deleted successfully!", 'success'))
            .catch((error) => {
                console.error("Error removing document: ", error);
                showToast("Error deleting item: " + error.message, 'error');
            });
    }
};

// --- UI Rendering ---
function renderStockTable(dataToRender = null) {
    const displayData = dataToRender || stockData;
    stockTableBody.innerHTML = "";
    displayData.forEach(item => {
        const row = document.createElement('tr');
        const status = item.qty < 50 ? 'Low' : 'OK';
        row.innerHTML = `
            <td>${item.date}</td>
            <td class="fw-bold">${item.type}</td>
            <td>${item.colorName}</td>
            <td><span class="badge ${status === 'Low' ? 'bg-danger' : 'bg-success'}">${status}</span></td>
            <td>${item.qty} KG</td>
            <td>₹${item.price}</td>
            <td>
                <button class="btn btn-sm glass-btn-sm text-warning" onclick="editStock('${item.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm glass-btn-sm text-danger" onclick="deleteStock('${item.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        stockTableBody.appendChild(row);
    });
}

function renderSalesTable() {
    salesTableBody.innerHTML = "";
    salesData.forEach(sale => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sale.date}</td>
            <td class="fw-bold">${sale.itemType}</td>
            <td>${sale.qty} KG</td>
            <td>₹${sale.sellPrice}</td>
            <td class="text-success">₹${sale.totalSale.toFixed(2)}</td>
            <td class="text-info">+₹${sale.profit.toFixed(2)}</td>
        `;
        salesTableBody.appendChild(row);
    });
}

function calculateStats() {
    const totalQty = stockData.reduce((sum, item) => sum + item.qty, 0);
    const lowCount = stockData.filter(item => item.qty < 50).length;
    const totalSales = salesData.reduce((sum, sale) => sum + sale.totalSale, 0);
    const totalProfit = salesData.reduce((sum, sale) => sum + sale.profit, 0);

    totalStockCount.innerText = totalQty.toLocaleString();
    totalSalesValue.innerText = `₹${totalSales.toLocaleString()}`;
    totalProfitValue.innerText = `₹${totalProfit.toLocaleString()}`;
    lowStockCount.innerText = lowCount;

    // Performance Optimization: Update Date & Time
    const dt = new Date().toLocaleString();
    const dtElem = document.getElementById('current-date-time');
    if (dtElem) dtElem.innerText = dt;
}

let chartInstance = null;
function updateChart(data) {
    const canvas = document.getElementById('stockChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const groupedData = {};
    data.forEach(item => {
        groupedData[item.type] = (groupedData[item.type] || 0) + item.qty;
    });

    const labels = Object.keys(groupedData);
    const values = Object.values(groupedData);

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line', // Optimized for trend view
        data: {
            labels: labels,
            datasets: [{
                label: 'Stock KG',
                data: values,
                borderColor: '#764ba2',
                backgroundColor: 'rgba(118, 75, 162, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: 'white' } } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'white' } },
                x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'white' } }
            }
        }
    });
}

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(amount);
};

// --- Filtering ---

function applyFilters() {
    const searchVal = filterSearch.value.toLowerCase();

    const filtered = stockData.filter(item => {
        const matchesSearch = (item.type || "").toLowerCase().includes(searchVal) ||
            (item.colorName || "").toLowerCase().includes(searchVal);
        return matchesSearch;
    });

    renderStockTable(filtered); // Use the correct table rendering function
    updateChart(filtered);
}

if (filterSearch) {
    filterSearch.addEventListener('input', applyFilters);
}

// --- Export to CSV ---
const exportBtn = document.getElementById('export-btn');

function exportToCSV() {
    if (stockData.length === 0) {
        showToast("No data available to export.", 'error');
        return;
    }

    try {
        // CSV Headers
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Date,Type,Color Name,Status,Quantity (KG),Price,Total Value\n";

        stockData.forEach(item => {
            const row = [
                item.date,
                item.type,
                item.colorName,
                item.status,
                item.qty,
                item.price,
                item.total.toFixed(2)
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "rs_textile_stock.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast("Stock data exported successfully!", 'success');
    } catch (error) {
        console.error("Export error:", error);
        showToast("Failed to export data.", 'error');
    }
}

exportBtn.addEventListener('click', exportToCSV);

// --- Chart.js ---

function updateChart(data) {
    const ctx = document.getElementById('stockChart').getContext('2d');

    // Group data by Fabric Type
    const groupedData = {};
    data.forEach(item => {
        const type = item.type || "Other";
        if (!groupedData[type]) groupedData[type] = 0;
        groupedData[type] += item.qty;
    });

    const labels = Object.keys(groupedData);
    const values = Object.values(groupedData);

    const backgroundColors = [
        'rgba(255, 99, 132, 0.7)',
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(153, 102, 255, 0.7)',
        'rgba(255, 159, 64, 0.7)'
    ];

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Stock Quantity',
                data: values,
                backgroundColor: backgroundColors,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: 'white' }
                },
                title: {
                    display: true,
                    text: 'Stock by Fabric Type (Dynamic)',
                    color: 'white'
                }
            }
        }
    });
}