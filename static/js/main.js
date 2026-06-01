/* ==========================================================================
   Antant Boutique Webapp Core Interactions (main.js)
   ========================================================================== */

// Client-side cache for autocomplete systems
let inventoryCache = {
    materials: [],
    designs: [],
    products: []
};

let customersCache = [];

// Category hints matching old bot prodtype options
const categorySuggestions = [
    "saree", "suit", "kurti", "blouse", "dress", "shawl", "fabric", "dupatta"
];

// Document Ready Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch logs
    loadDashboard();
    syncInventoryCache();
    loadCustomersCache();
    loadOrders();
    loadDues();

    // Auto-calculating hooks
    recalcDesignTotal();
    recalcBillTotal();
});

// ----------------- TAB WORKSPACE SYSTEM -----------------

function switchTab(event, tabId) {
    if (event) event.preventDefault();
    
    // Deactivate active items
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));
    
    // Activate target panel
    if (event) event.currentTarget.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Trigger tab specific syncs
    if (tabId === 'dashboard') loadDashboard();
    if (tabId === 'catalog') renderCatalogGrid();
    if (tabId === 'orders') loadOrders();
}

// ----------------- SYNCHRONIZE CACHES -----------------

async function loadDashboard() {
    try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();
        
        if (data.status === 'success') {
            // Update financial metric tiles
            document.getElementById('metricCashBalance').innerText = `Rs. ${parseFloat(data.wallet.cash).toFixed(2)}`;
            document.getElementById('metricCardBalance').innerText = `Rs. ${parseFloat(data.wallet.card).toFixed(2)}`;
            document.getElementById('metricTotalBalance').innerText = `Rs. ${parseFloat(data.wallet.total).toFixed(2)}`;
            document.getElementById('quickTotalWallet').innerText = `Rs. ${parseFloat(data.wallet.total).toFixed(2)}`;
            
            const dateStr = data.wallet.date || '--';
            document.getElementById('metricCashDate').innerText = `Last Balance Check: ${dateStr}`;
            document.getElementById('metricCardDate').innerText = `Last Balance Check: ${dateStr}`;
            
            // Update inventory tallies
            document.getElementById('metricMaterials').innerText = data.inventory.materials;
            document.getElementById('metricDesigns').innerText = data.inventory.designs;
            document.getElementById('metricProducts').innerText = data.inventory.products;
            
            // Build transaction list statement rows
            const tbody = document.getElementById('transactionLogBody');
            tbody.innerHTML = '';
            
            if (data.transactions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="placeholder-text">No statements recorded yet.</td></tr>';
            } else {
                data.transactions.forEach(row => {
                    const tr = document.createElement('tr');
                    
                    // Card flow signs
                    const cardTrx = row.card_credit > 0 ? `+${row.card_credit}` : (row.card_debit > 0 ? `-${row.card_debit}` : '0.00');
                    const cardClass = row.card_credit > 0 ? 'text-green' : (row.card_debit > 0 ? 'text-red' : '');
                    
                    // Cash flow signs
                    const cashTrx = row.cash_credit > 0 ? `+${row.cash_credit}` : (row.cash_debit > 0 ? `-${row.cash_debit}` : '0.00');
                    const cashClass = row.cash_credit > 0 ? 'text-green' : (row.cash_debit > 0 ? 'text-red' : '');

                    tr.innerHTML = `
                        <td>${row.date}</td>
                        <td>${row.remarks}</td>
                        <td class="${cardClass}">Rs. ${parseFloat(cardTrx).toFixed(2)}</td>
                        <td class="${cashClass}">Rs. ${parseFloat(cashTrx).toFixed(2)}</td>
                        <td>Rs. ${row.card_balance.toFixed(2)}</td>
                        <td>Rs. ${row.cash_balance.toFixed(2)}</td>
                        <td class="highlight-total">Rs. ${row.total_balance.toFixed(2)}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
    } catch (e) {
        console.error("Dashboard failed to sync:", e);
    }
}

async function syncInventoryCache() {
    try {
        const res = await fetch('/api/inventory');
        const data = await res.json();
        if (data.status === 'success') {
            inventoryCache = data;
        }
    } catch (e) {
        console.error("Inventory Cache failed:", e);
    }
}

async function loadCustomersCache() {
    try {
        const res = await fetch('/api/customers');
        const data = await res.json();
        if (data.status === 'success') {
            customersCache = data.customers;
        }
    } catch (e) {
        console.error("Customer Cache failed:", e);
    }
}

// ----------------- MATERIALS BULK ENTRY -----------------

function addMaterialRow() {
    const tbody = document.querySelector('#materialsEntryTable tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" name="source" placeholder="e.g. Bhagaban-Fulia" required></td>
        <td><input type="text" name="material" placeholder="e.g. Comfortable-cotton" required></td>
        <td><input type="text" name="color" placeholder="e.g. Bottle-green" required></td>
        <td><input type="number" step="0.01" name="quantity" placeholder="e.g. 5.5" required></td>
        <td><input type="number" step="0.01" name="price" placeholder="e.g. 360" required></td>
        <td><button type="button" class="btn btn-icon btn-danger" onclick="removeRow(this)"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
}

function removeRow(btn) {
    const row = btn.closest('tr');
    const table = row.closest('table');
    // Maintain at least one row in input forms
    if (table.querySelectorAll('tbody tr').length > 1) {
        row.remove();
    }
}

async function submitMaterials(event) {
    event.preventDefault();
    const form = event.target;
    
    // Gather multi-row items
    const rows = form.querySelectorAll('tbody tr');
    const payload = {
        source: [],
        material: [],
        color: [],
        quantity: [],
        price: []
    };
    
    rows.forEach(row => {
        payload.source.push(row.querySelector('input[name="source"]').value);
        payload.material.push(row.querySelector('input[name="material"]').value);
        payload.color.push(row.querySelector('input[name="color"]').value);
        payload.quantity.push(row.querySelector('input[name="quantity"]').value);
        payload.price.push(row.querySelector('input[name="price"]').value);
    });
    
    try {
        const response = await fetch('/api/materials/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.status === 'success') {
            alert(result.summary);
            form.reset();
            // Maintain single row
            const tbody = form.querySelector('tbody');
            tbody.innerHTML = `
                <tr>
                    <td><input type="text" name="source" placeholder="e.g. Bhagaban-Fulia" required></td>
                    <td><input type="text" name="material" placeholder="e.g. Comfortable-cotton" required></td>
                    <td><input type="text" name="color" placeholder="e.g. Bottle-green" required></td>
                    <td><input type="number" step="0.01" name="quantity" placeholder="e.g. 5.5" required></td>
                    <td><input type="number" step="0.01" name="price" placeholder="e.g. 360" required></td>
                    <td><button type="button" class="btn btn-icon btn-danger" onclick="removeRow(this)"><i class="fa-solid fa-trash"></i></button></td>
                </tr>
            `;
            syncInventoryCache();
            loadDashboard();
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        alert("Upload failed. Check server status.");
    }
}

// ----------------- TEXTILE DESIGN SYSTEM -----------------

function addDesignMaterialRow() {
    const tbody = document.querySelector('#designMaterialsTable tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="autocomplete-td">
            <input type="text" name="materials[]" placeholder="Type to search fabric..." onfocus="showMaterialSuggestions(this)" oninput="filterMaterialSuggestions(this)" required>
            <div class="autocomplete-suggestions"></div>
        </td>
        <td><input type="number" step="0.01" name="measures[]" placeholder="e.g. 5.5" oninput="recalcDesignTotal()" required></td>
        <td><button type="button" class="btn btn-icon btn-danger" onclick="removeRow(this); recalcDesignTotal();"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
}

// Autocomplete filter: Materials
function showMaterialSuggestions(input) {
    const list = input.parentNode.querySelector('.autocomplete-suggestions');
    list.style.display = 'block';
    filterMaterialSuggestions(input);
}

function filterMaterialSuggestions(input) {
    const val = input.value.toLowerCase();
    const list = input.parentNode.querySelector('.autocomplete-suggestions');
    list.innerHTML = '';
    
    // 1. Match against raw fabrics
    const matchesRaw = inventoryCache.materials.filter(m => 
        m.code.toLowerCase().includes(val) || 
        m.fabric.toLowerCase().includes(val) ||
        m.color.toLowerCase().includes(val)
    );

    // 2. Match against intermediate designed fabrics (non-finished products)
    const matchesDesigns = [];
    if (inventoryCache.designs) {
        inventoryCache.designs.forEach(d => {
            if (!d.catalogued && d.code.toLowerCase().includes(val)) {
                const baseCode = d.code.split('-P')[0];
                const rawMatch = inventoryCache.materials.find(m => m.code === baseCode);
                matchesDesigns.push({
                    code: d.code,
                    fabric: rawMatch ? rawMatch.fabric : 'Designed Fabric',
                    color: rawMatch ? rawMatch.color : '',
                    length: d.length,
                    tppl: d.length > 0 ? (d.production_cost / d.length) : 0,
                    isDesign: true
                });
            }
        });
    }

    const matches = [...matchesRaw, ...matchesDesigns];

    if (matches.length === 0) {
        list.innerHTML = '<div class="suggestion-item">No fabrics match</div>';
    } else {
        matches.slice(0, 8).forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `<strong>${item.code}</strong> - ${item.color} ${item.fabric} (${item.length} m)`;
            div.onclick = () => {
                input.value = item.code;
                list.style.display = 'none';
                recalcDesignTotal();
            };
            list.appendChild(div);
        });
    }
}

// Hide autocomplete on click outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-td')) {
        document.querySelectorAll('.autocomplete-suggestions').forEach(el => el.style.display = 'none');
    }
});

// Category hierarchy suggestions
function showCategorySuggestions(input) {
    const list = input.parentNode.querySelector('.autocomplete-suggestions');
    list.style.display = 'block';
    filterCategorySuggestions(input);
}

function filterCategorySuggestions(input) {
    const val = input.value.toLowerCase();
    const list = input.parentNode.querySelector('.autocomplete-suggestions');
    list.innerHTML = '';
    
    const matches = categorySuggestions.filter(c => c.includes(val));
    matches.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerText = item;
        div.onclick = () => {
            input.value = item;
            list.style.display = 'none';
        };
        list.appendChild(div);
    });
}

function togglePriceField(chk) {
    const priceInput = document.getElementById('designProductPrice');
    priceInput.disabled = chk.checked;
    if (chk.checked) priceInput.value = '';
}

// Calculate production cost & specs on-the-fly
function recalcDesignTotal() {
    const form = document.getElementById('designForm');
    const materialsRows = form.querySelectorAll('#designMaterialsTable tbody tr');
    
    let baseSum = 0;
    const specContainer = document.getElementById('designMaterialsSpecList');
    specContainer.innerHTML = '';
    
    materialsRows.forEach(row => {
        const code = row.querySelector('input[name="materials[]"]').value.trim();
        const measure = parseFloat(row.querySelector('input[name="measures[]"]').value) || 0;
        
        if (code) {
            // First search in raw materials
            let fabricMatch = inventoryCache.materials.find(m => m.code === code);
            if (fabricMatch) {
                const specItem = document.createElement('div');
                specItem.className = 'spec-row';
                
                // Base Cost = length * price_per_meter
                const cost = measure * fabricMatch.tppl;
                baseSum += cost;
                
                specItem.innerHTML = `
                    <strong>${code} (${fabricMatch.color} ${fabricMatch.fabric})</strong>
                    <span>Use: ${measure} m @ Rs. ${fabricMatch.tppl.toFixed(2)}/m -> Cost: Rs. ${cost.toFixed(2)}</span>
                `;
                specContainer.appendChild(specItem);
            } else {
                // Search in designed materials (intermediate designed fabrics)
                let designMatch = inventoryCache.designs ? inventoryCache.designs.find(d => d.code === code) : null;
                if (designMatch) {
                    const baseCode = code.split('-P')[0];
                    const rawMatch = inventoryCache.materials.find(m => m.code === baseCode);
                    const specItem = document.createElement('div');
                    specItem.className = 'spec-row';
                    
                    const unitCost = designMatch.length > 0 ? (designMatch.production_cost / designMatch.length) : 0;
                    const cost = measure * unitCost;
                    baseSum += cost;
                    
                    specItem.innerHTML = `
                        <strong>${code} (${rawMatch ? rawMatch.color : ''} ${rawMatch ? rawMatch.fabric : 'Designed Fabric'})</strong>
                        <span>Use: ${measure} m @ Rs. ${unitCost.toFixed(2)}/m -> Cost: Rs. ${cost.toFixed(2)}</span>
                    `;
                    specContainer.appendChild(specItem);
                }
            }
        }
    });
    
    if (specContainer.innerHTML === '') {
        specContainer.innerHTML = '<p class="placeholder-text">Please select materials to inspect specs...</p>';
    }
    
    // Ops debit charges
    const block = parseFloat(form.querySelector('input[name="handBlockCost"]').value) || 0;
    const paint = parseFloat(form.querySelector('input[name="handPaintCost"]').value) || 0;
    const embroidery = parseFloat(form.querySelector('input[name="handEmbroideryCost"]').value) || 0;
    const applique = parseFloat(form.querySelector('input[name="handAppliqueCost"]').value) || 0;
    const tailoring = parseFloat(form.querySelector('input[name="tailoringCost"]').value) || 0;
    
    const opsSum = block + paint + embroidery + applique + tailoring;
    const totalProd = baseSum + opsSum;
    const qty = parseFloat(form.querySelector('input[name="productQty"]').value) || 1;
    const unitProd = totalProd / qty;
    
    // Update math cards
    document.getElementById('mathBaseCost').innerText = `Rs. ${baseSum.toFixed(2)}`;
    document.getElementById('mathOpsCost').innerText = `Rs. ${opsSum.toFixed(2)}`;
    document.getElementById('mathTotalCost').innerText = `Rs. ${totalProd.toFixed(2)}`;
    document.getElementById('mathUnitCost').innerText = `Rs. ${unitProd.toFixed(2)}`;
}

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function submitDesign(event) {
    event.preventDefault();
    const form = event.target;
    
    // Build JSON payload
    const data = {
        'materials[]': [],
        'measures[]': [],
        handBlockCost: form.querySelector('input[name="handBlockCost"]').value,
        handPaintCost: form.querySelector('input[name="handPaintCost"]').value,
        handEmbroideryCost: form.querySelector('input[name="handEmbroideryCost"]').value,
        handAppliqueCost: form.querySelector('input[name="handAppliqueCost"]').value,
        tailoringCost: form.querySelector('input[name="tailoringCost"]').value,
        cashHB: form.querySelector('input[name="cashHB"]').checked ? 'on' : 'off',
        cashHP: form.querySelector('input[name="cashHP"]').checked ? 'on' : 'off',
        cashHE: form.querySelector('input[name="cashHE"]').checked ? 'on' : 'off',
        cashHA: form.querySelector('input[name="cashHA"]').checked ? 'on' : 'off',
        cashTL: form.querySelector('input[name="cashTL"]').checked ? 'on' : 'off',
        mergeMaterials: form.querySelector('input[name="mergeMaterials"]').checked ? 'on' : 'off',
        category: form.querySelector('input[name="category"]').value,
        combineWith: form.querySelector('input[name="combineWith"]').value,
        productQty: form.querySelector('input[name="productQty"]').value,
        suggestPrice: form.querySelector('input[name="suggestPrice"]').checked ? 'on' : 'off',
        productPrice: form.querySelector('input[name="productPrice"]').value
    };
    
    form.querySelectorAll('#designMaterialsTable tbody tr').forEach(row => {
        data['materials[]'].push(row.querySelector('input[name="materials[]"]').value);
        data['measures[]'].push(row.querySelector('input[name="measures[]"]').value);
    });
    
    // Handle stage image upload if chosen
    const designImageInput = document.getElementById('designImageInput');
    if (designImageInput && designImageInput.files && designImageInput.files[0]) {
        try {
            data['design_image_base64'] = await getBase64(designImageInput.files[0]);
        } catch (err) {
            console.error("Error reading design stage image file:", err);
        }
    }
    
    try {
        const response = await fetch('/api/designs/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        
        if (result.status === 'success') {
            if (result.suggested_prices) {
                // Open price wizard modal
                openPriceWizard(result.product_code, result.suggested_prices);
            } else {
                alert(result.summary);
            }
            form.reset();
            recalcDesignTotal();
            syncInventoryCache();
            loadDashboard();
        } else {
            alert("Design failed: " + result.message);
        }
    } catch (e) {
        alert("Server failed to respond.");
    }
}

// Suggest Price selection modal options
function openPriceWizard(modelNo, suggestions) {
    const modal = document.getElementById('suggestedPriceModal');
    const container = document.getElementById('pricingOptionsContainer');
    document.getElementById('pricingModelNo').value = modelNo;
    document.getElementById('customPriceOverrideInput').value = '';
    
    // Clear catalog inputs
    document.getElementById('catalogProductNameInput').value = '';
    document.getElementById('catalogProductDescInput').value = '';
    document.getElementById('catalogProductImageInput').value = '';
    
    container.innerHTML = '';
    
    suggestions.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = `pricing-option-card ${idx === 1 ? 'selected' : ''}`; // default second item selected
        div.onclick = () => {
            container.querySelectorAll('.pricing-option-card').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
        };
        div.setAttribute('data-price', opt.price);
        div.innerHTML = `
            <h4>${opt.label}</h4>
            <span>Rs. ${opt.price}</span>
        `;
        container.appendChild(div);
    });
    
    modal.classList.add('active');
}

async function confirmSelectedPrice() {
    const modelNo = document.getElementById('pricingModelNo').value;
    const customPrice = parseFloat(document.getElementById('customPriceOverrideInput').value);
    
    let finalPrice = 0;
    if (customPrice > 0) {
        finalPrice = customPrice;
    } else {
        const selected = document.querySelector('#pricingOptionsContainer .pricing-option-card.selected');
        if (selected) {
            finalPrice = parseFloat(selected.getAttribute('data-price'));
        }
    }
    
    if (finalPrice <= 0) {
        alert("Please select a price option or input an override.");
        return;
    }
    
    // Read website catalog inputs
    const catalogName = document.getElementById('catalogProductNameInput').value;
    const catalogDesc = document.getElementById('catalogProductDescInput').value;
    const catalogImgInput = document.getElementById('catalogProductImageInput');
    
    let product_image_base64 = '';
    if (catalogImgInput && catalogImgInput.files && catalogImgInput.files[0]) {
        try {
            product_image_base64 = await getBase64(catalogImgInput.files[0]);
        } catch (err) {
            console.error("Error reading catalog image file:", err);
        }
    }
    
    try {
        const response = await fetch('/api/products/finalize-price', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                model_no: modelNo, 
                price: finalPrice,
                name: catalogName,
                description: catalogDesc,
                product_image_base64: product_image_base64
            })
        });
        const res = await response.json();
        if (res.status === 'success') {
            alert(res.message);
            document.getElementById('suggestedPriceModal').classList.remove('active');
            syncInventoryCache();
        }
    } catch (e) {
        alert("Failed to finalize pricing.");
    }
}

// ----------------- POINT OF SALE (POS) BILLING -----------------

function addCartRow() {
    const tbody = document.querySelector('#billCartTable tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="autocomplete-td">
            <input type="text" name="models[]" placeholder="Search product model code..." onfocus="showProductSuggestions(this)" oninput="filterProductSuggestions(this)" required>
            <div class="autocomplete-suggestions"></div>
        </td>
        <td><input type="number" name="quantities[]" value="1" min="1" oninput="recalcBillTotal()" required></td>
        <td><input type="number" class="row-rate" readonly value="0.00"></td>
        <td><input type="number" class="row-amount" readonly value="0.00"></td>
        <td><button type="button" class="btn btn-icon btn-danger" onclick="removeRow(this); recalcBillTotal();"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
}

function showProductSuggestions(input) {
    const list = input.parentNode.querySelector('.autocomplete-suggestions');
    list.style.display = 'block';
    filterProductSuggestions(input);
}

function filterProductSuggestions(input) {
    const val = input.value.toLowerCase();
    const list = input.parentNode.querySelector('.autocomplete-suggestions');
    list.innerHTML = '';
    
    const matches = inventoryCache.products.filter(p => 
        p.code.toLowerCase().includes(val) || 
        p.name.toLowerCase().includes(val) || 
        p.category.toLowerCase().includes(val)
    );
    
    if (matches.length === 0) {
        list.innerHTML = '<div class="suggestion-item">No stock matched</div>';
    } else {
        matches.slice(0, 8).forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `<strong>${item.code}</strong> - ${item.name} (Rs. ${item.price} | Qty: ${item.qty})`;
            div.onclick = () => {
                input.value = item.code;
                list.style.display = 'none';
                
                // prefill rate
                const row = input.closest('tr');
                row.querySelector('.row-rate').value = item.price;
                recalcBillTotal();
            };
            list.appendChild(div);
        });
    }
}

function toggleDiscountField(chk) {
    const discInput = document.getElementById('billDiscount');
    discInput.disabled = !chk.checked;
    recalcBillTotal();
}

function toggleFullPaid(chk) {
    const paidInput = document.getElementById('billPaidAmount');
    paidInput.disabled = chk.checked;
    if (chk.checked) {
        // paidAmount will match payable
        recalcBillTotal();
    }
}

function recalcBillTotal() {
    const form = document.getElementById('billingForm');
    const cartRows = form.querySelectorAll('#billCartTable tbody tr');
    
    let subtotal = 0;
    
    cartRows.forEach(row => {
        const qty = parseFloat(row.querySelector('input[name="quantities[]"]').value) || 0;
        const rate = parseFloat(row.querySelector('.row-rate').value) || 0;
        const amount = qty * rate;
        
        row.querySelector('.row-amount').value = amount.toFixed(2);
        subtotal += amount;
    });
    
    // Add Accessories
    const acc = parseFloat(document.getElementById('billAccessories').value) || 0;
    subtotal += acc;
    
    // Apply Discount
    let discountVal = 0;
    const discChecked = form.querySelector('input[name="discount"]').checked;
    if (discChecked) {
        const discPct = parseFloat(document.getElementById('billDiscount').value) || 0;
        discountVal = Math.round(subtotal * discPct / 100);
    }
    
    const payable = subtotal - discountVal;
    
    // Adjust with Customer Wallet Credit
    const walletText = document.getElementById('checkoutWalletBal').innerText;
    const preCredit = parseFloat(walletText.replace('Rs. ', '')) || 0;
    
    let paidAmt = parseFloat(document.getElementById('billPaidAmount').value) || 0;
    const fullPaidChecked = document.getElementById('billFullPaid').checked;
    
    if (fullPaidChecked) {
        paidAmt = Math.max(0, payable - preCredit);
        document.getElementById('billPaidAmount').value = paidAmt;
    }
    
    const totalPayments = paidAmt + preCredit;
    const dueAmt = Math.max(0, payable - totalPayments);
    
    // Update math fields
    document.getElementById('billSubtotal').innerText = `Rs. ${subtotal.toFixed(2)}`;
    document.getElementById('billDiscountAmount').innerText = `Rs. ${discountVal.toFixed(2)}`;
    document.getElementById('billPayable').innerText = `Rs. ${payable.toFixed(2)}`;
    document.getElementById('billDueAmt').innerText = `Rs. ${dueAmt.toFixed(2)}`;
}

// Autocomplete filter: Customers
function showCustomerSuggestions(input, mode) {
    const list = input.closest('.autocomplete-td').querySelector('.autocomplete-suggestions');
    list.style.display = 'block';
    filterCustomerSuggestions(input, mode);
}

function filterCustomerSuggestions(input, mode) {
    const val = input.value.trim().toLowerCase();
    const list = input.closest('.autocomplete-td').querySelector('.autocomplete-suggestions');
    list.innerHTML = '';
    
    // Search both keys and values of customersCache
    const matches = customersCache.filter(c => 
        c.phone.toLowerCase().includes(val) || 
        c.name.toLowerCase().includes(val)
    );
    
    if (matches.length === 0) {
        list.innerHTML = '<div class="suggestion-item">No customers found</div>';
    } else {
        matches.slice(0, 6).forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `<strong>${item.phone}</strong> - ${item.name}`;
            div.onclick = () => {
                input.value = item.phone;
                list.style.display = 'none';
                
                if (mode === 'billing') {
                    document.getElementById('billContact').value = item.phone;
                    document.getElementById('billName').value = item.name;
                    document.getElementById('billAddress').value = item.address || '';
                    if (item.wallet_balance > 0) {
                        document.getElementById('checkoutWalletBal').innerText = `Rs. ${item.wallet_balance.toFixed(2)}`;
                        document.getElementById('checkoutWalletBadge').style.display = 'block';
                    } else {
                        document.getElementById('checkoutWalletBadge').style.display = 'none';
                        document.getElementById('checkoutWalletBal').innerText = 'Rs. 0.00';
                    }
                    recalcBillTotal();
                } else if (mode === 'orders') {
                    document.getElementById('orderContact').value = item.phone;
                    document.getElementById('orderName').value = item.name;
                    document.getElementById('orderAddress').value = item.address || '';
                }
            };
            list.appendChild(div);
        });
    }
}

// Hide autocomplete on clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-td')) {
        document.querySelectorAll('.autocomplete-suggestions').forEach(el => el.style.display = 'none');
    }
});

// Prefill Client details from cash profile
async function handleCustomerPhoneInput(phone) {
    // Instant client-side lookup from cache
    const matched = customersCache.find(c => c.phone === phone.trim());
    if (matched) {
        document.getElementById('billName').value = matched.name;
        document.getElementById('billAddress').value = matched.address || '';
        if (matched.wallet_balance > 0) {
            document.getElementById('checkoutWalletBal').innerText = `Rs. ${matched.wallet_balance.toFixed(2)}`;
            document.getElementById('checkoutWalletBadge').style.display = 'block';
        } else {
            document.getElementById('checkoutWalletBadge').style.display = 'none';
            document.getElementById('checkoutWalletBal').innerText = 'Rs. 0.00';
        }
        recalcBillTotal();
        return;
    }

    // Fallback direct endpoint hit if not matched in cache
    if (phone.length === 10) {
        try {
            const res = await fetch(`/api/customer/${phone}`);
            const data = await res.json();
            if (data.status === 'success') {
                document.getElementById('billName').value = data.name;
                document.getElementById('billAddress').value = data.address;
                
                // Show wallet adjustments badge
                if (data.wallet_balance > 0) {
                    document.getElementById('checkoutWalletBal').innerText = `Rs. ${data.wallet_balance.toFixed(2)}`;
                    document.getElementById('checkoutWalletBadge').style.display = 'block';
                } else {
                    document.getElementById('checkoutWalletBadge').style.display = 'none';
                    document.getElementById('checkoutWalletBal').innerText = 'Rs. 0.00';
                }
                recalcBillTotal();
            }
        } catch (e) {
            console.error(e);
        }
    }
}


async function submitBilling(event) {
    event.preventDefault();
    const form = event.target;
    
    const data = {
        customerName: document.getElementById('billName').value,
        customerContact: document.getElementById('billContact').value,
        customerAddress: document.getElementById('billAddress').value,
        'models[]': [],
        'quantities[]': [],
        accessories: document.getElementById('billAccessories').value,
        discount: form.querySelector('input[name="discount"]').checked ? 'on' : 'off',
        addDiscount: document.getElementById('billDiscount').value,
        paidAmount: document.getElementById('billPaidAmount').value,
        fullpaid: document.getElementById('billFullPaid').checked ? 'on' : 'off',
        upiQR: form.querySelector('input[name="upiQR"]').checked ? 'on' : 'off',
        cash: form.querySelector('input[name="cash"]').checked ? 'on' : 'off',
        INVCno: document.getElementById('billInvcNo').value
    };
    
    form.querySelectorAll('#billCartTable tbody tr').forEach(row => {
        data['models[]'].push(row.querySelector('input[name="models[]"]').value);
        data['quantities[]'].push(row.querySelector('input[name="quantities[]"]').value);
    });
    
    try {
        const response = await fetch('/api/billing/invoice', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        
        if (result.status === 'success') {
            form.reset();
            // Maintain single cart row
            document.querySelector('#billCartTable tbody').innerHTML = `
                <tr>
                    <td class="autocomplete-td">
                        <input type="text" name="models[]" placeholder="Search product model code..." onfocus="showProductSuggestions(this)" oninput="filterProductSuggestions(this)" required>
                        <div class="autocomplete-suggestions"></div>
                    </td>
                    <td><input type="number" name="quantities[]" value="1" min="1" oninput="recalcBillTotal()" required></td>
                    <td><input type="number" class="row-rate" readonly value="0.00"></td>
                    <td><input type="number" class="row-amount" readonly value="0.00"></td>
                    <td><button type="button" class="btn btn-icon btn-danger" onclick="removeRow(this); recalcBillTotal();"><i class="fa-solid fa-trash"></i></button></td>
                </tr>
            `;
            document.getElementById('checkoutWalletBadge').style.display = 'none';
            document.getElementById('checkoutWalletBal').innerText = 'Rs. 0.00';
            recalcBillTotal();
            
            // Show Thermal invoice Preview Modal
            openInvoiceModal(result.invoice_id);
            syncInventoryCache();
            loadDashboard();
            loadDues();
        } else {
            alert("Checkout failed: " + result.message);
        }
    } catch (e) {
        alert("Billing transaction failed.");
    }
}

async function openInvoiceModal(invoiceId) {
    try {
        const res = await fetch(`/api/dues`); // dues slips endpoint holds details
        const data = await res.json();
        
        // Find matching slip
        let billData = data.dues.find(d => d.invoice_id === invoiceId);
        
        // If not found in dues (means fully paid), retrieve or display receipt details
        const container = document.getElementById('invoiceViewArea');
        container.innerHTML = `
            <div style="text-align:center; padding:10px;">
                <h3>ANTANT BOUTIQUE</h3>
                <p>fits you inside</p>
                <p>Date: ${new Date().toLocaleDateString()}</p>
                <p>Invoice #: ${invoiceId}</p>
                <hr style="border:1px dashed #ccc; margin:10px 0;">
                <p>Transaction processed successfully.</p>
                <p>Local PDF generated at: LocalInvoicePDFs/${invoiceId}.pdf</p>
                <hr style="border:1px dashed #ccc; margin:10px 0;">
                <h4>Thank You</h4>
            </div>
        `;
        
        document.getElementById('invoiceModal').classList.add('active');
        // Save current active invoice ID inside modal trigger
        document.getElementById('invoiceModal').setAttribute('data-invoice-id', invoiceId);
    } catch (e) {
        console.error(e);
    }
}

function closeInvoiceModal() {
    document.getElementById('invoiceModal').classList.remove('active');
}

async function printReceipt() {
    const invoiceId = document.getElementById('invoiceModal').getAttribute('data-invoice-id');
    try {
        const response = await fetch('/api/billing/print', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({invoice_id: invoiceId})
        });
        const res = await response.json();
        alert(res.message);
    } catch (e) {
        alert("Printing command failed.");
    }
}

// ----------------- CUSTOM ORDERS SYSTEM -----------------

function addOrderRow() {
    const tbody = document.querySelector('#orderItemsTable tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" name="products[]" placeholder="e.g. Potochitra Saree" required></td>
        <td class="autocomplete-td">
            <input type="text" name="models[]" placeholder="Select material code... (Optional)" onfocus="showMaterialSuggestions(this)" oninput="filterMaterialSuggestions(this)">
            <div class="autocomplete-suggestions"></div>
        </td>
        <td><input type="number" name="quantities[]" value="1" min="1" required></td>
        <td><button type="button" class="btn btn-icon btn-danger" onclick="removeRow(this)"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
}


async function handleOrderPhoneInput(phone) {
    // Instant client-side lookup from cache
    const matched = customersCache.find(c => c.phone === phone.trim());
    if (matched) {
        document.getElementById('orderName').value = matched.name;
        document.getElementById('orderAddress').value = matched.address || '';
        return;
    }

    if (phone.length === 10) {
        try {
            const res = await fetch(`/api/customer/${phone}`);
            const data = await res.json();
            if (data.status === 'success') {
                document.getElementById('orderName').value = data.name;
                document.getElementById('orderAddress').value = data.address;
            }
        } catch (e) {
            console.error(e);
        }
    }
}


async function submitOrder(event) {
    event.preventDefault();
    const form = event.target;
    
    const data = {
        customerName: document.getElementById('orderName').value,
        customerContact: document.getElementById('orderContact').value,
        customerAddress: document.getElementById('orderAddress').value,
        'products[]': [],
        'models[]': [],
        'quantities[]': [],
        accessories: form.querySelector('input[name="accessories"]').value,
        ORDERno: document.getElementById('orderNoInput').value
    };
    
    form.querySelectorAll('#orderItemsTable tbody tr').forEach(row => {
        data['products[]'].push(row.querySelector('input[name="products[]"]').value);
        data['models[]'].push(row.querySelector('input[name="models[]"]').value);
        data['quantities[]'].push(row.querySelector('input[name="quantities[]"]').value);
    });
    
    try {
        const response = await fetch('/api/orders/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        
        if (result.status === 'success') {
            alert(`Custom order card processed successfully! OrderID: #${result.order_id}`);
            form.reset();
            
            // Restore header and button state if form was morphed to update state
            const formCard = document.querySelector('#tab-orders .form-section');
            formCard.querySelector('h2').innerText = "Submit Custom Order";
            formCard.querySelector('button[type="submit"]').innerHTML = `<i class="fa-solid fa-folder-plus"></i> Register Custom Order Card`;
            document.getElementById('orderNoInput').value = '';
            
            document.querySelector('#orderItemsTable tbody').innerHTML = `
                <tr>
                    <td><input type="text" name="products[]" placeholder="e.g. Potochitra Saree" required></td>
                    <td class="autocomplete-td">
                        <input type="text" name="models[]" placeholder="Select material code... (Optional)" onfocus="showMaterialSuggestions(this)" oninput="filterMaterialSuggestions(this)">
                        <div class="autocomplete-suggestions"></div>
                    </td>
                    <td><input type="number" name="quantities[]" value="1" min="1" required></td>
                    <td><button type="button" class="btn btn-icon btn-danger" onclick="removeRow(this)"><i class="fa-solid fa-trash"></i></button></td>
                </tr>
            `;

            loadOrders();
            loadDashboard();
        } else {
            alert("Failed to submit custom order card: " + result.message);
        }
    } catch (e) {
        alert("Server failed to respond.");
    }
}

// Sync Board custom orders
async function loadOrders() {
    const container = document.getElementById('orderCardsContainer');
    container.innerHTML = '<p class="placeholder-text">Syncing board or loading custom orders...</p>';
    
    try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        
        if (data.status === 'success') {
            container.innerHTML = '';
            if (data.orders.length === 0) {
                container.innerHTML = '<p class="placeholder-text">No custom orders found on board.</p>';
                return;
            }
            
            data.orders.forEach(card => {
                const div = document.createElement('div');
                div.className = 'order-tracker-card';
                
                let productListHtml = '';
                card.products.forEach((prod, index) => {
                    const stage = card.status[prod] || 0;
                    const stageLabels = ["Unassigned", "Material Assigned", "Printing & Dye", "Stitching & Tailoring", "Finished Outfit"];
                    
                    productListHtml += `
                        <div class="ot-card-products">
                            <strong>${card.quantities[index]}x</strong> ${prod} (${card.mat_codes[index]})
                            <div class="ot-card-slider-group">
                                <label>Stage: <span>${stageLabels[stage]} (${stage}/4)</span></label>
                                <input type="range" min="1" max="4" value="${stage}" class="ot-stage-slider" onchange="updateCardStatus('${card.id}', '${prod}', this.value)">
                            </div>
                        </div>
                    `;
                });
                
                div.innerHTML = `
                    <div class="ot-card-header">
                        <h4>OrderID: #${card.id}</h4>
                        <div class="ot-card-header-actions" style="display:flex; gap:8px; align-items:center;">
                            <button class="btn btn-secondary btn-sm" onclick="editCustomOrder('${card.id}')" style="padding: 4px 8px; font-size: 0.75rem;"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteCustomOrder('${card.id}')" style="padding: 4px 8px; font-size: 0.75rem; background-color:var(--accent-red); border-color:var(--accent-red);"><i class="fa-solid fa-trash"></i> Delete</button>
                            <span style="font-size:0.75rem; color:var(--text-sub);">${card.products.length} outfits</span>
                        </div>
                    </div>
                    <div class="ot-card-client">
                        Client: <strong>${card.customer}</strong> (${card.contact})
                        <br>Address: <i>${card.address || 'None'}</i>
                    </div>
                    ${productListHtml}
                `;


                container.appendChild(div);
            });
        }
    } catch (e) {
        container.innerHTML = '<p class="placeholder-text text-red">Failed to sync board from backend.</p>';
    }
}

async function updateCardStatus(orderId, product, newStage) {
    try {
        const response = await fetch('/api/orders/status/update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({order_id: orderId, product: product, stage: newStage})
        });
        const res = await response.json();
        if (res.status === 'success') {
            loadOrders();
        }
    } catch (e) {
        alert("Failed to update status.");
    }
}

function editCustomOrder(orderId) {
    // Fetch current orders to find the target card
    fetch('/api/orders')
        .then(res => res.json())
        .then(data => {
            const card = data.orders.find(o => o.id === orderId);
            if (card) {
                // Switch tab view to submit order form
                switchTab(null, 'orders');
                
                // Prefill Client details
                document.getElementById('orderContact').value = card.contact;
                document.getElementById('orderName').value = card.customer;
                document.getElementById('orderAddress').value = card.address || '';
                document.getElementById('orderNoInput').value = card.id;
                
                // Morphs form section header to update state
                const formCard = document.querySelector('#tab-orders .form-section');
                formCard.querySelector('h2').innerText = `Update Custom Order #${card.id}`;
                formCard.querySelector('button[type="submit"]').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Update Custom Order Card`;
                
                // Populate rows inside outfits mapping table
                const tbody = document.querySelector('#orderItemsTable tbody');
                tbody.innerHTML = '';
                
                card.products.forEach((prod, index) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><input type="text" name="products[]" value="${prod}" placeholder="e.g. Potochitra Saree" required></td>
                        <td class="autocomplete-td">
                            <input type="text" name="models[]" value="${card.mat_codes[index] || ''}" placeholder="Select material code... (Optional)" onfocus="showMaterialSuggestions(this)" oninput="filterMaterialSuggestions(this)">
                            <div class="autocomplete-suggestions"></div>
                        </td>
                        <td><input type="number" name="quantities[]" value="${card.quantities[index]}" min="1" required></td>
                        <td><button type="button" class="btn btn-icon btn-danger" onclick="removeRow(this)"><i class="fa-solid fa-trash"></i></button></td>
                    `;
                    tbody.appendChild(tr);
                });
                
                // Scroll view smoothly up to the editor
                formCard.scrollIntoView({ behavior: 'smooth' });
            }
        });
}

async function deleteCustomOrder(orderId) {
    const warn = confirm(`⚠️ WARNING: Are you sure you want to permanently delete Custom Order #${orderId}?\n\nThis will untag all associated material codes from this order ID and completely remove this card from the tracking board. This action cannot be undone.`);
    if (warn) {
        try {
            const response = await fetch(`/api/orders/delete/${orderId}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });
            const result = await response.json();
            if (result.status === 'success') {
                alert(result.message);
                loadOrders();
                loadDashboard();
            } else {
                alert(`Deletion failed: ${result.message}`);
            }
        } catch (e) {
            alert("Network error: failed to delete order card.");
        }
    }
}

// ----------------- CATALOG VIEW & FILTERS -----------------



function renderCatalogGrid() {
    const grid = document.getElementById('catalogGrid');
    grid.innerHTML = '';
    
    if (inventoryCache.products.length === 0) {
        grid.innerHTML = '<div class="info-splash"><p>Inventory catalog is currently empty.</p></div>';
        return;
    }
    
    inventoryCache.products.forEach(p => {
        const div = document.createElement('div');
        const isOut = p.qty <= 0;
        div.className = `product-catalog-card ${isOut ? 'out-of-stock' : ''}`;
        
        div.innerHTML = `
            <div class="pcard-code">
                <span>${p.code}</span>
                <span class="pcard-qty">${isOut ? 'Out of Stock' : p.qty + ' in stock'}</span>
            </div>
            <div class="pcard-category">${p.category}</div>
            <div class="pcard-desc">${p.name || 'Handcrafted Design (' + p.mat_code + ')'}</div>
            <div class="pcard-price">Rs. ${p.price.toFixed(2)}</div>
        `;
        grid.appendChild(div);
    });
}

function filterCatalog(query) {
    const cards = document.querySelectorAll('.product-catalog-card');
    const val = query.toLowerCase();
    
    cards.forEach(card => {
        const code = card.querySelector('.pcard-code span').innerText.toLowerCase();
        const category = card.querySelector('.pcard-category').innerText.toLowerCase();
        const desc = card.querySelector('.pcard-desc').innerText.toLowerCase();
        
        if (code.includes(val) || category.includes(val) || desc.includes(val)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
}

// ----------------- DUES & OVERLAY PANEL -----------------

function toggleDueSlipsPane(show) {
    const pane = document.getElementById('dueSlipsPane');
    if (show) {
        loadDues();
        pane.classList.add('active');
    } else {
        pane.classList.remove('active');
    }
}

async function loadDues() {
    const container = document.getElementById('dueSlipsContainer');
    try {
        const res = await fetch('/api/dues');
        const data = await res.json();
        
        if (data.status === 'success') {
            document.getElementById('dueSlipsCount').innerText = data.dues.length;
            container.innerHTML = '';
            
            if (data.dues.length === 0) {
                container.innerHTML = '<p class="placeholder-text">No pending outstanding invoices!</p>';
                return;
            }
            
            data.dues.forEach(due => {
                const div = document.createElement('div');
                div.className = 'due-invoice-slip-card';
                div.innerHTML = `
                    <div class="due-card-header">
                        <span>Invoice: ${due.invoice_id}</span>
                        <span class="due-card-due">Due: Rs. ${due.due.toFixed(2)}</span>
                    </div>
                    <div class="due-card-client">
                        Customer: <strong>${due.name}</strong> (${due.contact})
                    </div>
                    <div class="due-card-items">
                        Outfits: ${due.models.join(', ')}
                        <br>Total bill: Rs. ${due.payable.toFixed(2)} | Paid: Rs. ${due.paid.toFixed(2)}
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="prefillDueSlipsPayment('${due.invoice_id}')"><i class="fa-solid fa-credit-card"></i> Pay Remaining Due</button>
                `;
                container.appendChild(div);
            });
        }
    } catch (e) {
        console.error(e);
    }
}

function prefillDueSlipsPayment(invoiceId) {
    // Prefill billing POS panel with due slips parameters
    fetch('/api/dues')
        .then(res => res.json())
        .then(data => {
            const due = data.dues.find(d => d.invoice_id === invoiceId);
            if (due) {
                switchTab(null, 'billing');
                toggleDueSlipsPane(false);
                
                // Prefill fields
                document.getElementById('billContact').value = due.contact;
                document.getElementById('billName').value = due.name;
                document.getElementById('billAddress').value = due.address;
                document.getElementById('billInvcNo').value = due.invoice_id;
                
                // Load cart items
                const tbody = document.querySelector('#billCartTable tbody');
                tbody.innerHTML = '';
                
                due.models.forEach((model, index) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="autocomplete-td">
                            <input type="text" name="models[]" value="${model}" required>
                            <div class="autocomplete-suggestions"></div>
                        </td>
                        <td><input type="number" name="quantities[]" value="${due.quantities[index]}" min="1" oninput="recalcBillTotal()" required></td>
                        <td><input type="number" class="row-rate" readonly value="0.00"></td>
                        <td><input type="number" class="row-amount" readonly value="0.00"></td>
                        <td><button type="button" class="btn btn-icon btn-danger" onclick="removeRow(this); recalcBillTotal();"><i class="fa-solid fa-trash"></i></button></td>
                    `;
                    
                    // fetch rate from product cache
                    const pMatch = inventoryCache.products.find(p => p.code === model);
                    const rate = pMatch ? pMatch.price : 0;
                    tr.querySelector('.row-rate').value = rate;
                    
                    tbody.appendChild(tr);
                });
                
                document.getElementById('billAccessories').value = due.accessories;
                
                // setup discount checks
                if (due.discount > 0) {
                    const chk = document.querySelector('input[name="discount"]');
                    chk.checked = true;
                    document.getElementById('billDiscount').disabled = false;
                    document.getElementById('billDiscount').value = due.discount;
                }
                
                // set paid amount to remaining due
                document.getElementById('billPaidAmount').value = due.due;
                document.getElementById('billFullPaid').checked = true;
                document.getElementById('billPaidAmount').disabled = true;
                
                recalcBillTotal();
            }
        });
}

// ----------------- SEARCH & INFO LOOKUP -----------------

async function executeLookup() {
    const code = document.getElementById('lookupCodeInput').value.trim();
    if (!code) {
        alert("Please enter a code to lookup!");
        return;
    }
    
    const container = document.getElementById('lookupResultsContainer');
    container.innerHTML = '<div class="placeholder-text">Searching records...</div>';
    
    try {
        const res = await fetch(`/api/info/${code}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            container.innerHTML = '';
            const card = document.createElement('div');
            card.className = 'lookup-card';
            
            let specsHtml = '';
            
            if (data.type === 'material') {
                specsHtml = `
                    <div class="lookup-card-title">
                        <span>FABRIC SPEC SHEET</span>
                        <h2>${data.code}</h2>
                    </div>
                    <div class="lookup-spec-grid">
                        <div class="lookup-spec-item"><label>Fabric</label><span>${data.fabric}</span></div>
                        <div class="lookup-spec-item"><label>Color/Print</label><span>${data.color}</span></div>
                        <div class="lookup-spec-item"><label>Source Shop</label><span>${data.source}</span></div>
                        <div class="lookup-spec-item"><label>Available Length</label><span>${data.length} m</span></div>
                        <div class="lookup-spec-item"><label>Surcharge per Length (TPPL)</label><strong>Rs. ${data.tppl.toFixed(2)}</strong></div>
                        <div class="lookup-spec-item"><label>Linked OrderID</label><span>${data.order_id || 'None'}</span></div>
                    </div>
                `;
            } else if (data.type === 'design') {
                specsHtml = `
                    <div class="lookup-card-title">
                        <span>FABRIC DESIGN SHEET</span>
                        <h2>${data.code}</h2>
                    </div>
                    <div class="lookup-spec-grid">
                        <div class="lookup-spec-item"><label>Base Fabric</label><span>${data.color} ${data.fabric}</span></div>
                        <div class="lookup-spec-item"><label>Length designed</label><span>${data.length} m</span></div>
                        <div class="lookup-spec-item"><label>Base Price</label><span>Rs. ${data.base.toFixed(2)}</span></div>
                        <div class="lookup-spec-item"><label>Print & Dye Cost</label><span>Rs. ${data.print_dye.toFixed(2)}</span></div>
                        <div class="lookup-spec-item"><label>Stitch & Applique Cost</label><span>Rs. ${data.stitch_applique.toFixed(2)}</span></div>
                        <div class="lookup-spec-item"><label>Total Production Cost</label><strong>Rs. ${data.production_cost.toFixed(2)}</strong></div>
                        <div class="lookup-spec-item"><label>Added to Catalog</label><span>${data.catalogued ? 'Yes (Price Set)' : 'No (Pending Finalization)'}</span></div>
                        <div class="lookup-spec-item"><label>Linked OrderID</label><span>${data.order_id || 'None'}</span></div>
                    </div>
                `;
            } else if (data.type === 'product') {
                specsHtml = `
                    <div class="lookup-card-title">
                        <span>PRODUCT SPEC SHEET</span>
                        <h2>${data.code}</h2>
                    </div>
                    <div class="lookup-spec-grid">
                        <div class="lookup-spec-item"><label>Category Hierarchy</label><span>${data.category}</span></div>
                        <div class="lookup-spec-item"><label>Linked Fabric Code</label><span>${data.mat_code}</span></div>
                        <div class="lookup-spec-item"><label>Description</label><span>${data.name || 'Boutique handcrafted item'}</span></div>
                        <div class="lookup-spec-item"><label>Inventory Stock Qty</label><span>${data.qty} pcs</span></div>
                        <div class="lookup-spec-item"><label>Retail Price</label><strong>Rs. ${data.price.toFixed(2)}</strong></div>
                        <div class="lookup-spec-item"><label>Combined With</label><span>${data.combine || 'None'}</span></div>
                    </div>
                `;
            } else if (data.type === 'multiple') {
                let listHtml = `
                    <div class="lookup-card-title">
                        <span>SEARCH RESULTS FOR "${data.query.toUpperCase()}"</span>
                        <h2>Found ${data.matches.length} matches:</h2>
                    </div>
                    <div class="lookup-multiple-grid">
                `;
                data.matches.forEach(m => {
                    listHtml += `
                        <div class="multiple-search-row" onclick="triggerExactLookup('${m.code}')">
                            <div class="search-row-meta">
                                <span class="search-row-code">${m.code}</span>
                                <span class="search-row-type badge-${m.type}">${m.type.toUpperCase()}</span>
                            </div>
                            <div class="search-row-details">${m.details}</div>
                        </div>
                    `;
                });
                listHtml += `</div>`;
                specsHtml = listHtml;
            }
            
            card.innerHTML = specsHtml;
            container.appendChild(card);
        } else {
            container.innerHTML = `
                <div class="info-splash">
                    <i class="fa-solid fa-circle-exclamation" style="color:var(--accent-red);"></i>
                    <p>No material, design, or product matches code **${code}** in active databases.</p>
                </div>
            `;
        }
    } catch (e) {
        container.innerHTML = '<div class="placeholder-text text-red">Failed to query lookup info.</div>';
    }
}

function triggerExactLookup(exactCode) {
    document.getElementById('lookupCodeInput').value = exactCode;
    executeLookup();
}


// Global search bar dispatcher
function handleGlobalSearch(query) {
    if (query.length > 2) {
        // Prefill lookup search input, switch to search tab and search!
        switchTab(null, 'search');
        document.getElementById('lookupCodeInput').value = query;
        executeLookup();
    }
}

function handleLookupInput(query) {
    const trimmed = query.trim();
    if (trimmed.length > 2) {
        executeLookup();
    } else if (trimmed.length === 0) {
        document.getElementById('lookupResultsContainer').innerHTML = `
            <div class="info-splash">
                <i class="fa-solid fa-box-open"></i>
                <p>Enter any code in the box above to break down cost components and inventory specs.</p>
            </div>
        `;
    }
}
