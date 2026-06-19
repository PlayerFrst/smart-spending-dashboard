const fs = require('fs');
const path = require('path');

// Simple file-backed storage to simulate localStorage in Node
const STORAGE_FILE = path.join(__dirname, 'test-storage.json');
const StorageManager = (() => {
  const EXP_KEY = 'expenses';
  const KW_KEY = 'keywordMap';

  function saveAll(obj) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  }

  function loadAll() {
    try {
      if (!fs.existsSync(STORAGE_FILE)) return {};
      const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('loadAll error', e);
      return {};
    }
  }

  function saveExpenses(expenses) {
    const store = loadAll();
    store[EXP_KEY] = expenses;
    saveAll(store);
  }

  function loadExpenses() {
    const store = loadAll();
    return store[EXP_KEY] || [];
  }

  function saveKeywordMap(map) {
    const store = loadAll();
    store[KW_KEY] = map;
    saveAll(store);
  }

  function loadKeywordMap() {
    const store = loadAll();
    if (store[KW_KEY]) return store[KW_KEY];
    const defaults = {
      Food: ['coffee', 'starbucks', 'pizza', 'restaurant', 'grocery', 'supermarket', 'uber eats', 'doordash'],
      Transport: ['uber', 'lyft', 'gas', 'parking', 'transit', 'train', 'airline'],
      Entertainment: ['netflix', 'movie', 'concert', 'theater', 'game'],
      Utilities: ['electric', 'water', 'internet', 'phone', 'gas bill'],
      Shopping: ['amazon', 'mall', 'clothing', 'store'],
      Healthcare: ['pharmacy', 'doctor', 'hospital', 'medical'],
      Other: []
    };
    store[KW_KEY] = defaults;
    saveAll(store);
    return defaults;
  }

  return { saveExpenses, loadExpenses, saveKeywordMap, loadKeywordMap };
})();

// CategoryEngine (same logic as app.js)
const CategoryEngine = (() => {
  let keywordMap = StorageManager.loadKeywordMap();
  function normalize(text) { return (text||'').toString().toLowerCase(); }
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
  function autoFillCategory(description) { const category = matchKeyword(description); return { category, isAutoMatched: category !== 'Other' }; }
  function addKeyword(k, c) { keywordMap[c] = keywordMap[c]||[]; if (!keywordMap[c].includes(k)) { keywordMap[c].push(k); StorageManager.saveKeywordMap(keywordMap); return true; } return false; }
  function getKeywordMap() { return JSON.parse(JSON.stringify(keywordMap)); }
  return { matchKeyword, autoFillCategory, addKeyword, getKeywordMap };
})();

// ExpenseManager
const ExpenseManager = (() => {
  function load() { return StorageManager.loadExpenses(); }
  function save(list) { StorageManager.saveExpenses(list); }
  function addExpense(list, { date, description, amount, category, isAutoMatched=false }) {
    if (!description || String(description).trim() === '') throw new Error('Invalid description');
    const num = Number(amount);
    if (!Number.isFinite(num) || isNaN(num)) throw new Error('Invalid amount');
    if (num < 0) throw new Error('Invalid amount');
    const expense = { id: Date.now().toString(), date: date || new Date().toISOString().slice(0,10), description, amount: num, category: category||'Other', isAutoMatched };
    list.push(expense);
    save(list);
    return expense;
  }

  function deleteExpense(list, id) {
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    save(list);
    return true;
  }

  function updateExpense(list, id, updates) {
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) return false;
    const existing = list[idx];
    const merged = Object.assign({}, existing, updates);
    if (!merged.description || String(merged.description).trim() === '') throw new Error('Invalid description');
    const num = Number(merged.amount);
    if (!Number.isFinite(num) || isNaN(num) || num < 0) throw new Error('Invalid amount');
    merged.amount = num;
    list[idx] = merged;
    save(list);
    return merged;
  }

  return { load, save, addExpense, deleteExpense, updateExpense };
})();

// Chart helper functions
const ChartHelpers = (() => {
  function buildCategoryData(expenses) {
    const map = {};
    for (const e of expenses) {
      const cat = e.category || 'Other';
      map[cat] = (map[cat] || 0) + Number(e.amount || 0);
    }
    return map;
  }

  function buildTimeSeries(expenses) {
    const map = {};
    for (const e of expenses) {
      const d = e.date || (new Date()).toISOString().slice(0,10);
      map[d] = (map[d] || 0) + Number(e.amount || 0);
    }
    return map;
  }

  return { buildCategoryData, buildTimeSeries };
})();

// Simple asserts
function assert(cond, msg) { if (!cond) { console.error('❌ FAIL:', msg); process.exitCode = 2; throw new Error(msg); } }

// Clean previous test storage
if (fs.existsSync(STORAGE_FILE)) fs.unlinkSync(STORAGE_FILE);

console.log('Running logic tests...');

// Load initial state
let expenses = ExpenseManager.load();
assert(Array.isArray(expenses), 'expenses should be an array');

// Test 1: CategoryEngine matchKeyword
const result1 = CategoryEngine.matchKeyword('Starbucks coffee');
console.log('matchKeyword("Starbucks coffee") =>', result1);
assert(result1 === 'Food', 'Expected category "Food" for "Starbucks coffee"');

// Test 2: add expense without category should be auto-filled in app; here we simulate autoFill
const autofill = CategoryEngine.autoFillCategory('Starbucks coffee');
console.log('autoFillCategory =>', autofill);
assert(autofill.category === 'Food' && autofill.isAutoMatched, 'autoFillCategory should suggest Food and be autoMatched');

// Add expense using autoFill suggestion
const e1 = ExpenseManager.addExpense(expenses, { description: 'Starbucks coffee', amount: 5.25, category: autofill.category, isAutoMatched: autofill.isAutoMatched });
console.log('Added expense:', e1);

// Test 3: verify persistence by reloading
expenses = ExpenseManager.load();
assert(expenses.length === 1, 'Expected 1 expense after adding');
assert(expenses[0].category === 'Food', 'Persisted expense category should be Food');

// Test 4: another keyword
const result2 = CategoryEngine.matchKeyword('Uber ride downtown');
console.log('matchKeyword("Uber ride downtown") =>', result2);
assert(result2 === 'Transport', 'Expected category "Transport" for "Uber ride"');
const autofill2 = CategoryEngine.autoFillCategory('Uber ride downtown');
const e2 = ExpenseManager.addExpense(expenses, { description: 'Uber ride downtown', amount: 12.0, category: autofill2.category, isAutoMatched: autofill2.isAutoMatched });

// Reload and check both
expenses = ExpenseManager.load();
assert(expenses.length === 2, 'Expected 2 expenses after adding second');

// --- Additional Tests: Edge cases, aggregation, and CRUD ---
console.log('\nRunning extended tests...');

// 1) Edge Cases & Input Validation
console.log('\nEdge Cases & Input Validation tests:');
// Empty description
let threw = false;
try {
  ExpenseManager.addExpense(expenses, { description: '', amount: 10 });
} catch (e) { threw = true; }
assert(threw, 'Empty description should throw validation error');
console.log('✅ Empty description rejected');

// Negative amount
threw = false;
try {
  ExpenseManager.addExpense(expenses, { description: 'Negative amount', amount: -15 });
} catch (e) { threw = true; }
assert(threw, 'Negative amount should throw validation error');
console.log('✅ Negative amount rejected');

// Invalid amount (string / NaN)
threw = false;
try {
  ExpenseManager.addExpense(expenses, { description: 'Invalid amount', amount: 'free' });
} catch (e) { threw = true; }
assert(threw, 'Invalid amount should throw validation error');
console.log('✅ Invalid amount rejected');

// 2) Data Aggregation (chart helpers)
console.log('\nData Aggregation tests:');
const sampleExpenses = [
  { id: 'a1', date: '2026-06-01', description: 'Breakfast', amount: 8, category: 'Food' },
  { id: 'a2', date: '2026-06-01', description: 'Lunch', amount: 12, category: 'Food' },
  { id: 'a3', date: '2026-06-02', description: 'Snack', amount: 5, category: 'Food' },
  { id: 'b1', date: '2026-06-01', description: 'Uber', amount: 7, category: 'Transport' },
  { id: 'b2', date: '2026-06-02', description: 'Train', amount: 3, category: 'Transport' }
];

const catData = ChartHelpers.buildCategoryData(sampleExpenses);
assert(catData['Food'] === 25, 'Food total should be 25');
assert(catData['Transport'] === 10, 'Transport total should be 10');
console.log('✅ buildCategoryData sums per category are correct');

const ts = ChartHelpers.buildTimeSeries(sampleExpenses);
assert(ts['2026-06-01'] === 27, '2026-06-01 total should be 27 (8+12+7)');
assert(ts['2026-06-02'] === 8, '2026-06-02 total should be 8 (5+3)');
console.log('✅ buildTimeSeries sums per day are correct');

// 3) CRUD Operations: Delete and Update
console.log('\nCRUD tests (Delete & Update):');

// Ensure starting point is loaded fresh
expenses = ExpenseManager.load();

// Delete test
const toDelete = ExpenseManager.addExpense(expenses, { description: 'Temp to delete', amount: 4, category: 'Other' });
const deleteId = toDelete.id;
let deleted = ExpenseManager.deleteExpense(expenses, deleteId);
assert(deleted === true, 'deleteExpense should return true when an item is removed');
expenses = ExpenseManager.load();
assert(!expenses.find(e => e.id === deleteId), 'Deleted expense should not exist after delete');
console.log('✅ Delete operation removed the expense and persisted');

// Update test
const toUpdate = ExpenseManager.addExpense(expenses, { description: 'Temp to update', amount: 20, category: 'Shopping' });
const updateId = toUpdate.id;
const updated = ExpenseManager.updateExpense(expenses, updateId, { amount: 30, category: 'Food' });
assert(updated && updated.amount === 30 && updated.category === 'Food', 'updateExpense should return updated object with new values');
expenses = ExpenseManager.load();
const persisted = expenses.find(e => e.id === updateId);
assert(persisted && persisted.amount === 30 && persisted.category === 'Food', 'Updated expense should be persisted with new values');
console.log('✅ Update operation modified and persisted the expense');

// Final state and success
console.log('\nAll tests passed ✅');
console.log('Storage file created at:', STORAGE_FILE);
console.log('Saved content:\n', fs.readFileSync(STORAGE_FILE, 'utf8'));

process.exitCode = 0;
