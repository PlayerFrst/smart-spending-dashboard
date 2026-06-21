/* app.js - Phase 3: Expense Logic & LocalStorage Persistence
   Modules: StorageManager, ExpenseManager, CategoryEngine (minimal placeholder), UIController
*/

const StorageManager = (() => {
  const EXP_KEY = 'expenses';
  const KW_KEY = 'keywordMap';

  function saveExpenses(expenses) {
    localStorage.setItem(EXP_KEY, JSON.stringify(expenses));
  }

  function loadExpenses() {
    try {
      const raw = localStorage.getItem(EXP_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to load expenses from localStorage', e);
      return [];
    }
  }

  function saveKeywordMap(map) {
    localStorage.setItem(KW_KEY, JSON.stringify(map));
  }

  function loadKeywordMap() {
    try {
      const raw = localStorage.getItem(KW_KEY);
      if (raw) return JSON.parse(raw);
      // default map
      const defaults = {
        Food: ['coffee', 'starbucks', 'pizza', 'restaurant', 'grocery', 'supermarket', 'uber eats', 'doordash'],
        Transport: ['uber', 'lyft', 'gas', 'parking', 'transit', 'train', 'airline'],
        Entertainment: ['netflix', 'movie', 'concert', 'theater', 'game'],
        Utilities: ['electric', 'water', 'internet', 'phone', 'gas bill'],
        Shopping: ['amazon', 'mall', 'clothing', 'store'],
        Healthcare: ['pharmacy', 'doctor', 'hospital', 'medical'],
        Other: []
      };
      saveKeywordMap(defaults);
      return defaults;
    } catch (e) {
      console.error('Failed to load keyword map', e);
      return {};
    }
  }

  return { saveExpenses, loadExpenses, saveKeywordMap, loadKeywordMap };
})();

const ExpenseManager = (() => {
  let expenses = [];

  function load() {
    expenses = StorageManager.loadExpenses();
    // ensure date strings are ISO (YYYY-MM-DD)
    expenses = expenses.map(e => ({ ...e }));
    return expenses;
  }

  function save() {
    StorageManager.saveExpenses(expenses);
  }

  function getAllExpenses() {
    return [...expenses];
  }

  function addExpense({ date, description, amount, category, isAutoMatched = false }) {
    const expense = {
      id: Date.now().toString(),
      date: date || new Date().toISOString().slice(0, 10),
      description: description || '',
      amount: Number(amount) || 0,
      category: category || 'Other',
      isAutoMatched: !!isAutoMatched
    };
    expenses.push(expense);
    save();
    return expense;
  }

  function editExpense(id, updates) {
    const idx = expenses.findIndex(e => e.id === id);
    if (idx === -1) return null;
    expenses[idx] = { ...expenses[idx], ...updates };
    save();
    return expenses[idx];
  }

  function deleteExpense(id) {
    const idx = expenses.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const [deleted] = expenses.splice(idx, 1);
    save();
    return deleted;
  }

  function getExpensesByCategory(category) {
    return expenses.filter(e => e.category === category);
  }

  function getExpensesByDateRange(startDate, endDate) {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return expenses.filter(e => {
      const d = new Date(e.date);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }

  function getTotalSpent(filtered = null) {
    const list = filtered || expenses;
    return list.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }

  function getAverageSpent(filtered = null) {
    const list = filtered || expenses;
    if (list.length === 0) return 0;
    return getTotalSpent(list) / list.length;
  }

  function getCategoryTotals() {
    return expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
      return acc;
    }, {});
  }

  function init() {
    load();
  }

  return {
    init,
    load,
    save,
    getAllExpenses,
    addExpense,
    editExpense,
    deleteExpense,
    getExpensesByCategory,
    getExpensesByDateRange,
    getTotalSpent,
    getAverageSpent,
    getCategoryTotals
  };
})();

// CategoryEngine: Phase 4 - auto-categorization, user keyword learning
const CategoryEngine = (() => {
  let keywordMap = StorageManager.loadKeywordMap();

  function normalize(text) {
    return (text || '').toString().toLowerCase();
  }

  function matchKeyword(description) {
    if (!description) return 'Other';
    const txt = normalize(description);
    for (const [cat, keywords] of Object.entries(keywordMap)) {
      for (const kw of keywords) {
        if (!kw) continue;
        if (txt.includes(normalize(kw))) return cat;
      }
    }
    return 'Other';
  }

  // Suggest category and indicate whether it was matched
  function autoFillCategory(description) {
    const category = matchKeyword(description);
    return { category, isAutoMatched: category !== 'Other' };
  }

  function getKeywordMap() {
    // return deep copy to avoid accidental mutation
    return JSON.parse(JSON.stringify(keywordMap || {}));
  }

  function addKeyword(keyword, category) {
    if (!keyword || !category) return false;
    keywordMap[category] = keywordMap[category] || [];
    const kw = keyword.trim();
    if (!keywordMap[category].includes(kw)) {
      keywordMap[category].push(kw);
      StorageManager.saveKeywordMap(keywordMap);
      return true;
    }
    return false;
  }

  function removeKeyword(keyword, category) {
    if (!keyword || !category) return false;
    if (!keywordMap[category]) return false;
    const before = keywordMap[category].length;
    keywordMap[category] = keywordMap[category].filter(k => k !== keyword);
    StorageManager.saveKeywordMap(keywordMap);
    return keywordMap[category].length < before;
  }

  // Allow replacing the whole map (useful for import/export or bulk edits)
  function setKeywordMap(map) {
    keywordMap = map || {};
    StorageManager.saveKeywordMap(keywordMap);
  }

  return { matchKeyword, autoFillCategory, getKeywordMap, addKeyword, removeKeyword, setKeywordMap };
})();

/* UIController: DOM bindings, rendering, event handlers */
const UIController = (() => {
  // DOM refs
  const refs = {
    expenseForm: document.getElementById('expenseForm'),
    toggleFormBtn: document.getElementById('toggleFormBtn'),
    cancelEditBtn: document.getElementById('cancelEditBtn'),
    expenseDate: document.getElementById('expenseDate'),
    expenseDateHelper: document.getElementById('expenseDateHelper'),
    expenseDescription: document.getElementById('expenseDescription'),
    expenseAmount: document.getElementById('expenseAmount'),
    expenseCategory: document.getElementById('expenseCategory'),
    autoMatched: document.getElementById('autoMatched'),
    submitBtn: document.getElementById('submitBtn'),
    resetFormBtn: document.getElementById('resetFormBtn'),
    formTitle: document.getElementById('formTitle'),

    filterSearch: document.getElementById('filterSearch'),
    filterCategory: document.getElementById('filterCategory'),
    filterDateFrom: document.getElementById('filterDateFrom'),
    filterDateTo: document.getElementById('filterDateTo'),
    sortBy: document.getElementById('sortBy'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn'),

    categoryChart: document.getElementById('categoryChart'),
    timeSeriesChart: document.getElementById('timeSeriesChart'),

    expensesTableBody: document.getElementById('expensesTableBody'),
    expensesTable: document.getElementById('expensesTable'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageInfo: document.getElementById('pageInfo'),

    exportCsvBtn: document.getElementById('exportCsvBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn'),
    manageKeywordsBtn: document.getElementById('manageKeywordsBtn'),

    keywordModal: document.getElementById('keywordModal'),
    closeKeywordModalBtn: document.getElementById('closeKeywordModalBtn'),
    closeKeywordBtn: document.getElementById('closeKeywordBtn'),
    newKeyword: document.getElementById('newKeyword'),
    newKeywordCategory: document.getElementById('newKeywordCategory'),
    addKeywordBtn: document.getElementById('addKeywordBtn'),
    keywordsDisplay: document.getElementById('keywordsDisplay'),

    deleteConfirmModal: document.getElementById('deleteConfirmModal'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),

    totalSpent: document.getElementById('totalSpent'),
    avgTransaction: document.getElementById('avgTransaction'),
    topCategory: document.getElementById('topCategory'),
    transactionCount: document.getElementById('transactionCount'),
  };

  let editingId = null;
  let idToDelete = null;
  let currentPage = 1;
  const pageSize = 20;
  let currentFilteredList = [];

  function formatCurrency(n) {
    return `$${Number(n || 0).toFixed(2)}`;
  }

  function clearForm() {
    refs.expenseForm.reset();
    refs.autoMatched.checked = false;
    editingId = null;
    refs.formTitle.textContent = 'Add New Expense';
    refs.submitBtn.textContent = 'Add Expense';
    refs.cancelEditBtn.style.display = 'none';
    // ensure date defaults to today after reset
    try {
      refs.expenseDate.value = getTodayISO();
    } catch (e) {}
    updateDateHelper();
  }

  function populateForm(expense) {
    editingId = expense.id;
    refs.expenseDate.value = expense.date;
    refs.expenseDescription.value = expense.description;
    refs.expenseAmount.value = expense.amount;
    refs.expenseCategory.value = expense.category;
    refs.autoMatched.checked = !!expense.isAutoMatched;
    refs.formTitle.textContent = 'Edit Expense';
    refs.submitBtn.textContent = 'Save Changes';
    refs.cancelEditBtn.style.display = 'inline-block';
    // ensure form is visible
    refs.expenseForm.style.display = '';
    window.scrollTo({ top: refs.expenseForm.offsetTop - 20, behavior: 'smooth' });
    updateDateHelper();
  }

  // Helper: return today's date as YYYY-MM-DD
  function getTodayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Show/hide the (Today's date) helper based on current value
  function updateDateHelper() {
    if (!refs.expenseDate || !refs.expenseDateHelper) return;
    const val = refs.expenseDate.value || '';
    if (val === getTodayISO()) {
      refs.expenseDateHelper.style.display = '';
      refs.expenseDateHelper.textContent = "(Today's date)";
    } else {
      refs.expenseDateHelper.style.display = 'none';
      refs.expenseDateHelper.textContent = '';
    }
  }

  // Ensure year is at most 4 digits and update helper visibility
  function onDateInput(e) {
    const v = e.target.value || '';
    if (!v) { updateDateHelper(); return; }
    const parts = v.split('-');
    if (parts.length >= 1) {
      const year = parts[0] || '';
      if (year.length > 4) {
        parts[0] = year.slice(0, 4);
        // reconstruct and set value
        const newVal = parts.join('-');
        refs.expenseDate.value = newVal;
      }
    }
    updateDateHelper();
  }

  function renderExpensesTable(list) {
    const rows = [];
    if (!list || list.length === 0) {
      refs.expensesTableBody.innerHTML = `\n        <tr class="empty-state">\n          <td colspan="5">No expenses yet. Add one to get started!</td>\n        </tr>`;
      // update pagination UI
      refs.pageInfo.textContent = '';
      refs.prevPageBtn.style.display = 'none';
      refs.nextPageBtn.style.display = 'none';
      currentFilteredList = [];
      return;
    }

    // Pagination
    const totalItems = list.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const pageItems = list.slice(start, start + pageSize);

    pageItems.forEach(exp => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', exp.id);
      tr.setAttribute('data-category', exp.category);
      tr.setAttribute('data-amount', exp.amount);

      const dateTd = document.createElement('td');
      dateTd.textContent = exp.date;

      const descTd = document.createElement('td');
      descTd.textContent = exp.description;

      const catTd = document.createElement('td');
      catTd.textContent = exp.category;
      catTd.className = `category-${exp.category.toLowerCase()}`;

      const amountTd = document.createElement('td');
      amountTd.textContent = formatCurrency(exp.amount);

      const actionsTd = document.createElement('td');
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'table-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-secondary';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => onEditClick(exp.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => onDeleteClick(exp.id));

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(deleteBtn);
      actionsTd.appendChild(actionsDiv);

      tr.appendChild(dateTd);
      tr.appendChild(descTd);
      tr.appendChild(catTd);
      tr.appendChild(amountTd);
      tr.appendChild(actionsTd);

      rows.push(tr);
    });

    refs.expensesTableBody.innerHTML = '';
    rows.forEach(r => refs.expensesTableBody.appendChild(r));
    // update pagination UI
    refs.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    refs.prevPageBtn.style.display = currentPage > 1 ? '' : 'none';
    refs.nextPageBtn.style.display = currentPage < totalPages ? '' : 'none';
    currentFilteredList = list;
  }

  function refreshUI() {
    const all = ExpenseManager.getAllExpenses();
    // default sort: date desc
    all.sort((a, b) => new Date(b.date) - new Date(a.date));

    // reset to first page on full refresh
    currentPage = 1;
    renderExpensesTable(all);
    updateSummary(all);
    updateChartsPlaceholder(all);
  }

  function updateSummary(list) {
    const total = ExpenseManager.getTotalSpent(list);
    const avg = ExpenseManager.getAverageSpent(list);
    const categoryTotals = ExpenseManager.getCategoryTotals();
    const topCat = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

    refs.totalSpent.textContent = formatCurrency(total);
    refs.avgTransaction.textContent = formatCurrency(avg);
    refs.transactionCount.textContent = list.length;
    refs.topCategory.textContent = topCat ? `${topCat[0]} (${formatCurrency(topCat[1])})` : '-';
  }

  function updateChartsPlaceholder(list) {
    // Placeholder for Phase 5; ensure function exists to avoid errors when called
    if (window.ChartManager && typeof window.ChartManager.refresh === 'function') {
      window.ChartManager.refresh(list);
    }
  }

  // Event handlers
  function onToggleForm() {
    if (refs.expenseForm.style.display === 'none' || refs.expenseForm.style.display === '') {
      // show
      refs.expenseForm.style.display = 'block';
      window.scrollTo({ top: refs.expenseForm.offsetTop - 20, behavior: 'smooth' });
    } else {
      refs.expenseForm.style.display = 'none';
    }
  }

  function onSubmitForm(e) {
    e.preventDefault();
    const date = refs.expenseDate.value || new Date().toISOString().slice(0, 10);
    const description = refs.expenseDescription.value.trim();
    const amount = parseFloat(refs.expenseAmount.value);
    let category = refs.expenseCategory.value;

    if (!description || isNaN(amount) || amount <= 0) {
      alert('Please provide a valid description and amount (> 0).');
      return;
    }

    // if category empty, try auto-match
    let autoMatched = false;
    if (!category) {
      const matched = CategoryEngine.matchKeyword(description);
      category = matched || 'Other';
      autoMatched = matched !== 'Other';
    }

    if (editingId) {
      ExpenseManager.editExpense(editingId, { date, description, amount, category, isAutoMatched: autoMatched });
      clearForm();
    } else {
      ExpenseManager.addExpense({ date, description, amount, category, isAutoMatched: autoMatched });
      clearForm();
    }

    refreshUI();
  }

  // Live description input --> auto-suggest category
  function onDescriptionInput(e) {
    const text = e.target.value || '';
      if (!text.trim()) {
        refs.expenseCategory.value = '';
        refs.autoMatched.checked = false;
        return;
      }
    const suggestion = CategoryEngine.autoFillCategory(text);
    if (suggestion && suggestion.isAutoMatched) {
      // only set category if user hasn't manually chosen one
      if (!refs.expenseCategory.value || refs.expenseCategory.value === 'Other') {
        refs.expenseCategory.value = suggestion.category;
        refs.autoMatched.checked = true;
      } else {
        // if category already selected, do not override; just indicate if matched
        refs.autoMatched.checked = refs.expenseCategory.value === suggestion.category;
      }
    } else {
      // no suggestion
      // do not clear user selection, just unset autoMatched flag
      refs.autoMatched.checked = false;
    }
  }

  function onResetForm() {
    clearForm();
  }

  function onEditClick(id) {
    const all = ExpenseManager.getAllExpenses();
    const exp = all.find(e => e.id === id);
    if (!exp) return;
    populateForm(exp);
  }

  function onDeleteClick(id) {
    idToDelete = id;
    refs.deleteConfirmModal.style.display = 'flex';
  }

  function onConfirmDelete() {
    if (!idToDelete) return;
    ExpenseManager.deleteExpense(idToDelete);
    idToDelete = null;
    refs.deleteConfirmModal.style.display = 'none';
    refreshUI();
  }

  function onCancelDelete() {
    idToDelete = null;
    refs.deleteConfirmModal.style.display = 'none';
  }

  function onSearchFiltersChanged() {
    const search = refs.filterSearch.value.trim().toLowerCase();
    const category = refs.filterCategory.value;
    const from = refs.filterDateFrom.value;
    const to = refs.filterDateTo.value;
    const sort = refs.sortBy.value;

    let list = ExpenseManager.getAllExpenses();

    if (search) {
      list = list.filter(e => e.description.toLowerCase().includes(search));
    }

    if (category) {
      list = list.filter(e => e.category === category);
    }

    if (from || to) {
      list = list.filter(e => {
        const d = new Date(e.date);
        if (from && d < new Date(from)) return false;
        if (to && d > new Date(to)) return false;
        return true;
      });
    }

    // sorting
    if (sort === 'date-desc') list.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sort === 'date-asc') list.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sort === 'amount-desc') list.sort((a, b) => b.amount - a.amount);
    if (sort === 'amount-asc') list.sort((a, b) => a.amount - b.amount);
    if (sort === 'category') list.sort((a, b) => a.category.localeCompare(b.category));

    // reset to first page on filter change
    currentPage = 1;
    renderExpensesTable(list);
    updateSummary(list);
    updateChartsPlaceholder(list);
  }

  function onClearFilters() {
    refs.filterSearch.value = '';
    refs.filterCategory.value = '';
    refs.filterDateFrom.value = '';
    refs.filterDateTo.value = '';
    refs.sortBy.value = 'date-desc';
    currentPage = 1;
    refreshUI();
  }

  function onExportJSON() {
    const data = currentFilteredList && currentFilteredList.length ? currentFilteredList : ExpenseManager.getAllExpenses();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function convertToCSV(rows) {
    const header = ['date', 'description', 'category', 'amount'];
    const lines = [header.join(',')];
    rows.forEach(r => {
      const vals = [r.date, `"${(r.description || '').replace(/"/g, '""')}"`, r.category, Number(r.amount).toFixed(2)];
      lines.push(vals.join(','));
    });
    return lines.join('\n');
  }

  function onExportCSV() {
    const data = currentFilteredList && currentFilteredList.length ? currentFilteredList : ExpenseManager.getAllExpenses();
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Keyword modal handlers (basic)
  function onOpenKeywordModal() {
    renderKeywordMap();
    refs.keywordModal.style.display = 'flex';
    // focus first input
    setTimeout(() => refs.newKeyword.focus(), 50);
  }

  function onCloseKeywordModal() {
    refs.keywordModal.style.display = 'none';
  }

  function renderKeywordMap() {
    const map = CategoryEngine.getKeywordMap();
    refs.keywordsDisplay.innerHTML = '';
    for (const [cat, kws] of Object.entries(map)) {
      const div = document.createElement('div');
      div.className = 'keyword-category';
      const title = document.createElement('div');
      title.className = 'keyword-category-title';
      title.textContent = cat;
      div.appendChild(title);

      const list = document.createElement('div');
      list.className = 'keyword-list';
      if (!kws || kws.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = '—';
        list.appendChild(empty);
      } else {
        kws.forEach(k => {
          const badge = document.createElement('div');
          badge.className = 'keyword-badge';
          badge.textContent = k;
          const rem = document.createElement('button');
          rem.className = 'keyword-badge-remove';
          rem.textContent = '✕';
          rem.title = `Remove ${k} from ${cat}`;
          rem.addEventListener('click', () => {
            if (confirm(`Remove keyword "${k}" from ${cat}?`)) {
              CategoryEngine.removeKeyword(k, cat);
              renderKeywordMap();
            }
          });
          badge.appendChild(rem);
          list.appendChild(badge);
        });
      }

      div.appendChild(list);
      refs.keywordsDisplay.appendChild(div);
    }
  }

  function onAddKeyword() {
    const kw = refs.newKeyword.value.trim();
    const cat = refs.newKeywordCategory.value;
    if (!kw || !cat) return alert('Please enter a keyword and select a category');
    CategoryEngine.addKeyword(kw, cat);
    refs.newKeyword.value = '';
    refs.newKeywordCategory.value = '';
    renderKeywordMap();
  }

  // Pagination controls
  function onPrevPage() {
    if (currentPage > 1) {
      currentPage -= 1;
      renderExpensesTable(currentFilteredList.length ? currentFilteredList : ExpenseManager.getAllExpenses());
    }
  }

  function onNextPage() {
    const list = currentFilteredList.length ? currentFilteredList : ExpenseManager.getAllExpenses();
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (currentPage < totalPages) {
      currentPage += 1;
      renderExpensesTable(list);
    }
  }

  // Debounce helper
  function debounce(fn, delay = 300) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function bindEvents() {
    refs.toggleFormBtn.addEventListener('click', onToggleForm);
    refs.expenseForm.addEventListener('submit', onSubmitForm);
    refs.resetFormBtn.addEventListener('click', onResetForm);
    refs.cancelEditBtn.addEventListener('click', clearForm);

    refs.filterSearch.addEventListener('input', onSearchFiltersChanged);
    refs.expenseDescription.addEventListener('input', onDescriptionInput);
    refs.expenseDate.addEventListener('input', onDateInput);
    // debounce search input
    refs.filterSearch.removeEventListener('input', onSearchFiltersChanged);
    refs.filterSearch.addEventListener('input', debounce(onSearchFiltersChanged, 250));
    refs.filterCategory.addEventListener('change', onSearchFiltersChanged);
    refs.filterDateFrom.addEventListener('change', onSearchFiltersChanged);
    refs.filterDateTo.addEventListener('change', onSearchFiltersChanged);
    refs.sortBy.addEventListener('change', onSearchFiltersChanged);
    refs.clearFiltersBtn.addEventListener('click', onClearFilters);

    refs.exportCsvBtn.addEventListener('click', onExportCSV);
    refs.exportJsonBtn.addEventListener('click', onExportJSON);
    refs.manageKeywordsBtn.addEventListener('click', onOpenKeywordModal);
    refs.closeKeywordModalBtn.addEventListener('click', onCloseKeywordModal);
    refs.closeKeywordBtn.addEventListener('click', onCloseKeywordModal);
    refs.addKeywordBtn.addEventListener('click', onAddKeyword);

    refs.confirmDeleteBtn.addEventListener('click', onConfirmDelete);
    refs.cancelDeleteBtn.addEventListener('click', onCancelDelete);
    refs.prevPageBtn.addEventListener('click', onPrevPage);
    refs.nextPageBtn.addEventListener('click', onNextPage);

    // Global key handling
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // close modals or cancel edit
        if (refs.keywordModal.style.display === 'flex') onCloseKeywordModal();
        if (refs.deleteConfirmModal.style.display === 'flex') onCancelDelete();
        // hide form if visible
        if (refs.expenseForm.style.display === 'block') {
          clearForm();
          refs.expenseForm.style.display = 'none';
        }
      }
    });

    // close modals on overlay click
    refs.keywordModal.addEventListener('click', (e) => { if (e.target === refs.keywordModal) onCloseKeywordModal(); });
    refs.deleteConfirmModal.addEventListener('click', (e) => { if (e.target === refs.deleteConfirmModal) onCancelDelete(); });
  }

  function init() {
    ExpenseManager.init();
    bindEvents();
    // reset form to defaults (sets today's date and helper)
    clearForm();
    refreshUI();
  }

  return { init };
})();

// Initialize on DOMContentLoaded
// ChartManager: Phase 5 - Chart.js visualizations
window.ChartManager = (() => {
  const catCanvas = document.getElementById('categoryChart');
  const timeCanvas = document.getElementById('timeSeriesChart');
  let catChart = null;
  let timeChart = null;

  function getCSSVar(name) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name);
      return v ? v.trim() : null;
    } catch (e) {
      return null;
    }
  }

  const categoryColors = {
    Food: getCSSVar('--color-food') || '#ef5350',
    Transport: getCSSVar('--color-transport') || '#42a5f5',
    Entertainment: getCSSVar('--color-entertainment') || '#ab47bc',
    Utilities: getCSSVar('--color-utilities') || '#ffa726',
    Shopping: getCSSVar('--color-shopping') || '#ec407a',
    Healthcare: getCSSVar('--color-healthcare') || '#29b6f6',
    Other: getCSSVar('--color-other') || '#90a4ae'
  };

  function buildCategoryData(list) {
    const totals = {};
    list.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + Number(e.amount || 0);
    });
    const labels = Object.keys(totals);
    const data = labels.map(l => totals[l]);
    const bg = labels.map(l => categoryColors[l] || '#ccc');
    return { labels, data, bg };
  }

  function buildTimeSeries(list, days = 30) {
    const labels = [];
    const data = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      labels.push(key);
      data.push(0);
    }
    const idx = labels.reduce((acc, l, i) => (acc[l] = i, acc), {});
    list.forEach(e => {
      const dt = (e.date || '').slice(0, 10);
      if (dt in idx) data[idx[dt]] += Number(e.amount || 0);
    });
    return { labels, data };
  }

  function createOrUpdateCategoryChart(list) {
    if (!catCanvas || typeof Chart === 'undefined') return;
    const { labels, data, bg } = buildCategoryData(list);
    if (catChart) {
      catChart.data.labels = labels;
      catChart.data.datasets[0].data = data;
      catChart.data.datasets[0].backgroundColor = bg;
      catChart.update();
      return;
    }
    catChart = new Chart(catCanvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: bg }] },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label(ctx) {
                const v = ctx.raw || 0;
                return `${ctx.label}: $${Number(v).toFixed(2)}`;
              }
            }
          }
        }
      }
    });
  }

  function createOrUpdateTimeChart(list) {
    if (!timeCanvas || typeof Chart === 'undefined') return;
    const { labels, data } = buildTimeSeries(list, 30);
    if (timeChart) {
      timeChart.data.labels = labels;
      timeChart.data.datasets[0].data = data;
      timeChart.update();
      return;
    }
    timeChart = new Chart(timeCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Daily Spend',
          data,
          borderColor: getCSSVar('--color-primary') || '#1976d2',
          backgroundColor: 'rgba(25,118,210,0.08)',
          fill: true,
          tension: 0.25
        }]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });
  }

  function refresh(list) {
    try {
      createOrUpdateCategoryChart(list);
      createOrUpdateTimeChart(list);
    } catch (e) {
      console.error('ChartManager refresh error', e);
    }
  }

  return { refresh };
})();

// Initialize UI after defining ChartManager
window.addEventListener('DOMContentLoaded', () => {
  UIController.init();
});
