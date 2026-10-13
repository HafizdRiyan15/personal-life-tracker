import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const state = {
    user: null,
    habits: [],
    habitLogs: [],
    entries: [],
    goals: [],
    transactions: [],
    busy: false
};

const today = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
};

const daysAgo = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
};

const money = (amount) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(amount) || 0);

const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);

function notify(message, type = "success") {
    const box = $("appMessage");
    if (!box) {
        console[type === "error" ? "error" : "log"](message);
        return;
    }

    box.textContent = message;
    box.className = `notice notice-${type}`;
    box.hidden = false;
}

function clearNotify() {
    const box = $("appMessage");
    if (!box) return;

    box.textContent = "";
    box.className = "notice";
    box.hidden = true;
}

async function runAction(action, successMessage) {
    if (state.busy) return;

    clearNotify();

    try {
        await action();
        if (successMessage) notify(successMessage);
    } catch (error) {
        console.error(error);
        notify(error.message || "Terjadi kesalahan.", "error");
    }
}

function on(id, event, callback) {
    $(id)?.addEventListener(event, callback);
}

async function getRows(table, build = (query) => query) {
    const { data, error } = await build(
        supabase.from(table).select("*")
    );

    if (error) throw error;
    return data || [];
}

// ======================================
// MEMUAT DATA SUPABASE
// ======================================

async function loadAll() {
    const selectedDate = $("habitDate")?.value || today();

    // Data mencakup tujuh hari terakhir dan tanggal habit yang dipilih.
    const startDate = daysAgo(6);
    const endDate = selectedDate > today() ? selectedDate : today();

    const [habits, logs, entries, goals, transactions] =
        await Promise.all([
            getRows("plt_habits", q =>
                q.order("created_at", { ascending: false })
            ),
            getRows("plt_habit_logs", q =>
                q.gte("log_date", startDate).lte("log_date", endDate)
            ),
            getRows("plt_entries", q =>
                q.order("entry_date", { ascending: false })
            ),
            getRows("plt_goals", q =>
                q.order("created_at", { ascending: false })
            ),
            getRows("plt_transactions", q =>
                q.order("transaction_date", { ascending: false })
            )
        ]);

    state.habits = habits;
    state.habitLogs = logs;
    state.entries = entries;
    state.goals = goals;
    state.transactions = transactions;

    renderAll();
}

function renderAll() {
    renderHabits();
    renderJournals();
    renderGoals();
    renderTransactions();
    renderSummary();
    renderStatistics();
}

// ======================================
// HABIT TRACKER
// ======================================

function renderHabits() {
    const list = $("habitList");
    if (!list) return;

    const date = $("habitDate")?.value || today();

    if (!state.habits.length) {
        list.innerHTML =
            '<div class="empty-state">Belum ada habit. Tambahkan kebiasaan pertamamu.</div>';
        return;
    }

    list.innerHTML = state.habits.map(habit => {
        const log = state.habitLogs.find(item =>
            String(item.habit_id) === String(habit.id) &&
            item.log_date === date
        );

        const completed = Boolean(log?.completed);

        return `
            <div class="item-row">
                <div class="item-main">
                    <input type="checkbox"
                        data-action="toggle-habit"
                        data-id="${esc(habit.id)}"
                        ${completed ? "checked" : ""}
                        aria-label="Tandai habit selesai">

                    <div>
                        <strong class="${completed ? "completed-text" : ""}">
                            ${esc(habit.title)}
                        </strong>
                        <p>${completed ? "Selesai" : "Belum selesai"} · ${esc(date)}</p>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="button-outline" type="button"
                        data-action="edit-habit" data-id="${esc(habit.id)}">Edit</button>
                    <button class="button-danger" type="button"
                        data-action="delete-habit" data-id="${esc(habit.id)}">Hapus</button>
                </div>
            </div>`;
    }).join("");
}

async function addHabit(event) {
    event.preventDefault();

    const title = $("habitName")?.value.trim();
    if (!title) throw new Error("Nama habit wajib diisi.");

    const { error } = await supabase.from("plt_habits").insert({
        user_id: state.user.id,
        title
    });

    if (error) throw error;

    $("habitName").value = "";
    await loadAll();
}

async function toggleHabit(id, checked) {
    const date = $("habitDate")?.value || today();

    const existing = state.habitLogs.find(item =>
        String(item.habit_id) === String(id) &&
        item.log_date === date
    );

    let result;

    if (existing) {
        result = await supabase.from("plt_habit_logs")
            .update({ completed: checked })
            .eq("id", existing.id);
    } else {
        result = await supabase.from("plt_habit_logs").insert({
            user_id: state.user.id,
            habit_id: id,
            log_date: date,
            completed: checked
        });
    }

    if (result.error) throw result.error;
    await loadAll();
}

async function editHabit(id) {
    const habit = state.habits.find(item =>
        String(item.id) === String(id)
    );
    if (!habit) return;

    const title = prompt("Ubah nama habit:", habit.title);
    if (title === null) return;
    if (!title.trim()) throw new Error("Nama habit tidak boleh kosong.");

    const { error } = await supabase.from("plt_habits")
        .update({ title: title.trim() })
        .eq("id", id);

    if (error) throw error;
    await loadAll();
}

async function deleteHabit(id) {
    if (!confirm("Hapus habit beserta seluruh riwayatnya?")) return;

    const { error: logError } = await supabase.from("plt_habit_logs")
        .delete().eq("habit_id", id);

    if (logError) throw logError;

    const { error } = await supabase.from("plt_habits")
        .delete().eq("id", id);

    if (error) throw error;
    await loadAll();
}

// ======================================
// JOURNAL
// ======================================

function renderJournals() {
    const list = $("journalList");
    if (!list) return;

    const search = ($("journalSearch")?.value || "").trim().toLowerCase();
    const date = $("journalFilterDate")?.value || "";
    const sort = $("journalSort")?.value || "newest";

    const entries = state.entries
        .filter(item =>
            `${item.title} ${item.content}`.toLowerCase().includes(search) &&
            (!date || item.entry_date === date)
        )
        .sort((a, b) => {
            const comparison = a.entry_date.localeCompare(b.entry_date);
            return sort === "oldest" ? comparison : -comparison;
        });

    if (!entries.length) {
        list.innerHTML =
            '<div class="empty-state">Belum ada jurnal yang cocok.</div>';
        return;
    }

    list.innerHTML = entries.map(entry => `
        <article class="item-row">
            <div class="item-main">
                <div>
                    <strong>${esc(entry.title)}</strong>
                    <p>${esc(entry.entry_date)}</p>
                    <p>${esc(entry.content.length > 180
                        ? entry.content.slice(0, 180) + "..."
                        : entry.content)}</p>
                </div>
            </div>
            <div class="item-actions">
                <button class="button-outline" type="button"
                    data-action="edit-journal" data-id="${esc(entry.id)}">Edit</button>
                <button class="button-danger" type="button"
                    data-action="delete-journal" data-id="${esc(entry.id)}">Hapus</button>
            </div>
        </article>
    `).join("");
}

async function saveJournal(event) {
    event.preventDefault();

    const id = $("journalId")?.value;
    const payload = {
        user_id: state.user.id,
        title: $("journalTitle").value.trim(),
        content: $("journalContent").value.trim(),
        entry_date: $("journalDate").value
    };

    if (!payload.title || !payload.content || !payload.entry_date) {
        throw new Error("Lengkapi judul, isi, dan tanggal jurnal.");
    }

    const result = id
        ? await supabase.from("plt_entries").update(payload).eq("id", id)
        : await supabase.from("plt_entries").insert(payload);

    if (result.error) throw result.error;

    resetJournalForm();
    await loadAll();
}

function resetJournalForm() {
    $("journalForm")?.reset();
    if ($("journalId")) $("journalId").value = "";
    if ($("journalDate")) $("journalDate").value = today();
    if ($("journalSubmit")) $("journalSubmit").textContent = "Simpan Catatan";
    if ($("journalFormTitle")) $("journalFormTitle").textContent = "Tulis Catatan Baru";
    if ($("journalCancel")) $("journalCancel").hidden = true;
}

function editJournal(id) {
    const entry = state.entries.find(item => String(item.id) === String(id));
    if (!entry) return;

    $("journalId").value = entry.id;
    $("journalTitle").value = entry.title;
    $("journalContent").value = entry.content;
    $("journalDate").value = entry.entry_date;

    if ($("journalSubmit")) $("journalSubmit").textContent = "Simpan Perubahan";
    if ($("journalFormTitle")) $("journalFormTitle").textContent = "Edit Catatan";
    if ($("journalCancel")) $("journalCancel").hidden = false;

    $("journalForm")?.scrollIntoView({ behavior: "smooth" });
}

async function deleteJournal(id) {
    if (!confirm("Hapus jurnal ini secara permanen?")) return;

    const { error } = await supabase.from("plt_entries")
        .delete().eq("id", id);

    if (error) throw error;

    if (String($("journalId")?.value) === String(id)) resetJournalForm();
    await loadAll();
}

// ======================================
// GOALS
// ======================================

function renderGoals() {
    const list = $("goalList");
    if (!list) return;

    if (!state.goals.length) {
        list.innerHTML =
            '<div class="empty-state">Belum ada target. Tambahkan target pertamamu.</div>';
        return;
    }

    list.innerHTML = state.goals.map(goal => `
        <div class="item-row">
            <div class="item-main">
                <input type="checkbox" data-action="toggle-goal"
                    data-id="${esc(goal.id)}" ${goal.is_completed ? "checked" : ""}
                    aria-label="Tandai target tercapai">
                <div>
                    <strong class="${goal.is_completed ? "completed-text" : ""}">
                        ${esc(goal.title)}
                    </strong>
                    <p>Tenggat: ${goal.deadline ? esc(goal.deadline) : "Belum ditentukan"}</p>
                    <p>${goal.is_completed ? "Target tercapai" : "Target masih berjalan"}</p>
                </div>
            </div>
            <div class="item-actions">
                <button class="button-outline" type="button"
                    data-action="edit-goal" data-id="${esc(goal.id)}">Edit</button>
                <button class="button-danger" type="button"
                    data-action="delete-goal" data-id="${esc(goal.id)}">Hapus</button>
            </div>
        </div>
    `).join("");
}

async function saveGoal(event) {
    event.preventDefault();

    const id = $("goalId")?.value;
    const payload = {
        user_id: state.user.id,
        title: $("goalTitle").value.trim(),
        deadline: $("goalDeadline").value || null
    };

    if (!payload.title) throw new Error("Nama target wajib diisi.");

    const result = id
        ? await supabase.from("plt_goals").update(payload).eq("id", id)
        : await supabase.from("plt_goals").insert(payload);

    if (result.error) throw result.error;

    resetGoalForm();
    await loadAll();
}

function resetGoalForm() {
    $("goalForm")?.reset();
    if ($("goalId")) $("goalId").value = "";
    if ($("goalSubmit")) $("goalSubmit").textContent = "Tambah Goal";
    if ($("goalCancel")) $("goalCancel").hidden = true;
}

function editGoal(id) {
    const goal = state.goals.find(item => String(item.id) === String(id));
    if (!goal) return;

    $("goalId").value = goal.id;
    $("goalTitle").value = goal.title;
    $("goalDeadline").value = goal.deadline || "";

    if ($("goalSubmit")) $("goalSubmit").textContent = "Simpan Perubahan";
    if ($("goalCancel")) $("goalCancel").hidden = false;

    $("goalForm")?.scrollIntoView({ behavior: "smooth" });
}

async function toggleGoal(id, checked) {
    const { error } = await supabase.from("plt_goals")
        .update({ is_completed: checked }).eq("id", id);

    if (error) throw error;
    await loadAll();
}

async function deleteGoal(id) {
    if (!confirm("Hapus target ini?")) return;

    const { error } = await supabase.from("plt_goals")
        .delete().eq("id", id);

    if (error) throw error;

    if (String($("goalId")?.value) === String(id)) resetGoalForm();
    await loadAll();
}

// ======================================
// FINANCE
// ======================================

function getFilteredTransactions() {
    const type = $("financeTypeFilter")?.value || "all";
    const start = $("financeStartDate")?.value || "";
    const end = $("financeEndDate")?.value || "";

    if (start && end && start > end) {
        notify("Tanggal awal tidak boleh melewati tanggal akhir.", "error");
        return [];
    }

    return state.transactions.filter(item =>
        (type === "all" || item.transaction_type === type) &&
        (!start || item.transaction_date >= start) &&
        (!end || item.transaction_date <= end)
    );
}

function renderTransactions() {
    const list = $("transactionList");
    const transactions = getFilteredTransactions();

    const income = transactions
        .filter(item => item.transaction_type === "income")
        .reduce((sum, item) => sum + Number(item.amount), 0);

    const expense = transactions
        .filter(item => item.transaction_type === "expense")
        .reduce((sum, item) => sum + Number(item.amount), 0);

    if ($("incomeSummary")) $("incomeSummary").textContent = money(income);
    if ($("expenseSummary")) $("expenseSummary").textContent = money(expense);

    if (!list) return;

    if (!transactions.length) {
        list.innerHTML =
            '<div class="empty-state">Belum ada transaksi pada filter ini.</div>';
        return;
    }

    list.innerHTML = transactions.map(item => {
        const isIncome = item.transaction_type === "income";

        return `
            <div class="item-row">
                <div class="item-main">
                    <div>
                        <strong>${esc(item.category)}</strong>
                        <p>${esc(item.transaction_date)} · ${isIncome ? "Pemasukan" : "Pengeluaran"}</p>
                        ${item.note ? `<p>${esc(item.note)}</p>` : ""}
                        <strong class="${isIncome ? "money-positive" : "money-negative"}">
                            ${isIncome ? "+" : "-"}${money(item.amount)}
                        </strong>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="button-outline" type="button"
                        data-action="edit-transaction" data-id="${esc(item.id)}">Edit</button>
                    <button class="button-danger" type="button"
                        data-action="delete-transaction" data-id="${esc(item.id)}">Hapus</button>
                </div>
            </div>`;
    }).join("");
}

async function saveTransaction(event) {
    event.preventDefault();

    const id = $("transactionId")?.value;
    const amount = Number($("transactionAmount").value);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error("Nominal harus bilangan bulat lebih dari nol.");
    }

    const payload = {
        user_id: state.user.id,
        transaction_type: $("transactionType").value,
        amount,
        category: $("transactionCategory").value.trim(),
        transaction_date: $("transactionDate").value,
        note: $("transactionNote").value.trim() || null
    };

    if (!["income", "expense"].includes(payload.transaction_type)) {
        throw new Error("Jenis transaksi tidak valid.");
    }

    if (!payload.category || !payload.transaction_date) {
        throw new Error("Kategori dan tanggal transaksi wajib diisi.");
    }

    const result = id
        ? await supabase.from("plt_transactions").update(payload).eq("id", id)
        : await supabase.from("plt_transactions").insert(payload);

    if (result.error) throw result.error;

    resetTransactionForm();
    await loadAll();
}

function resetTransactionForm() {
    $("transactionForm")?.reset();
    if ($("transactionId")) $("transactionId").value = "";
    if ($("transactionDate")) $("transactionDate").value = today();
    if ($("transactionSubmit")) $("transactionSubmit").textContent = "Simpan Transaksi";
    if ($("transactionFormTitle")) $("transactionFormTitle").textContent = "Tambah Transaksi";
    if ($("transactionCancel")) $("transactionCancel").hidden = true;
}

function editTransaction(id) {
    const item = state.transactions.find(t => String(t.id) === String(id));
    if (!item) return;

    $("transactionId").value = item.id;
    $("transactionType").value = item.transaction_type;
    $("transactionAmount").value = item.amount;
    $("transactionCategory").value = item.category;
    $("transactionDate").value = item.transaction_date;
    $("transactionNote").value = item.note || "";

    if ($("transactionSubmit")) $("transactionSubmit").textContent = "Simpan Perubahan";
    if ($("transactionFormTitle")) $("transactionFormTitle").textContent = "Edit Transaksi";
    if ($("transactionCancel")) $("transactionCancel").hidden = false;

    $("transactionForm")?.scrollIntoView({ behavior: "smooth" });
}

async function deleteTransaction(id) {
    if (!confirm("Hapus transaksi ini?")) return;

    const { error } = await supabase.from("plt_transactions")
        .delete().eq("id", id);

    if (error) throw error;

    if (String($("transactionId")?.value) === String(id)) {
        resetTransactionForm();
    }

    await loadAll();
}

// ======================================
// DASHBOARD & STATISTIK
// ======================================

function renderSummary() {
    if ($("habitSummary")) {
        const date = $("habitDate")?.value || today();
        const completed = state.habitLogs.filter(log =>
            log.log_date === date && log.completed &&
            state.habits.some(habit => String(habit.id) === String(log.habit_id))
        ).length;

        $("habitSummary").textContent = `${completed}/${state.habits.length}`;
    }

    if ($("journalSummary")) {
        $("journalSummary").textContent = state.entries.length;
    }

    if ($("goalSummary")) {
        $("goalSummary").textContent =
            state.goals.filter(goal => !goal.is_completed).length;
    }

    if ($("balanceSummary")) {
        const income = state.transactions
            .filter(t => t.transaction_type === "income")
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const expense = state.transactions
            .filter(t => t.transaction_type === "expense")
            .reduce((sum, t) => sum + Number(t.amount), 0);

        $("balanceSummary").textContent = money(income - expense);
    }
}

function renderStatistics() {
    const start = daysAgo(6);
    const end = today();

    const recentEntries = state.entries.filter(entry =>
        entry.entry_date >= start && entry.entry_date <= end
    );

    const recentLogs = state.habitLogs.filter(log =>
        log.log_date >= start && log.log_date <= end && log.completed &&
        state.habits.some(habit => String(habit.id) === String(log.habit_id))
    );

    if ($("weeklyHabitSummary")) {
        $("weeklyHabitSummary").textContent = recentLogs.length;
    }

    if ($("weeklyJournalSummary")) {
        $("weeklyJournalSummary").textContent = recentEntries.length;
    }

    if ($("completedGoalSummary")) {
        $("completedGoalSummary").textContent =
            state.goals.filter(goal => goal.is_completed).length;
    }

    if ($("transactionCountSummary")) {
        $("transactionCountSummary").textContent = state.transactions.length;
    }

    const list = $("weeklyHabitList");
    if (!list) return;

    if (!state.habits.length) {
        list.innerHTML =
            '<div class="empty-state">Statistik muncul setelah kamu menambahkan habit.</div>';
        return;
    }

    list.innerHTML = state.habits.map(habit => {
        const count = recentLogs.filter(log =>
            String(log.habit_id) === String(habit.id)
        ).length;

        return `
            <div class="item-row">
                <div class="item-main">
                    <div>
                        <strong>${esc(habit.title)}</strong>
                        <p>${count} kali selesai dalam 7 hari terakhir</p>
                    </div>
                </div>
            </div>`;
    }).join("");
}

// ======================================
// AKSI TOMBOL
// ======================================

function handleListAction(event) {
    const control = event.target.closest("[data-action]");
    if (!control) return;

    const { action, id } = control.dataset;

    runAction(async () => {
        switch (action) {
            case "toggle-habit":
                await toggleHabit(id, control.checked);
                break;
            case "edit-habit":
                await editHabit(id);
                break;
            case "delete-habit":
                await deleteHabit(id);
                break;
            case "edit-journal":
                editJournal(id);
                break;
            case "delete-journal":
                await deleteJournal(id);
                break;
            case "toggle-goal":
                await toggleGoal(id, control.checked);
                break;
            case "edit-goal":
                editGoal(id);
                break;
            case "delete-goal":
                await deleteGoal(id);
                break;
            case "edit-transaction":
                editTransaction(id);
                break;
            case "delete-transaction":
                await deleteTransaction(id);
                break;
        }
    });
}

function setInitialDates() {
    if ($("habitDate")) $("habitDate").value = today();
    if ($("journalDate")) $("journalDate").value = today();
    if ($("transactionDate")) $("transactionDate").value = today();

    ["journalCancel", "goalCancel", "transactionCancel"].forEach(id => {
        if ($(id)) $(id).hidden = true;
    });

    if ($("year")) $("year").textContent = new Date().getFullYear();
}

function attachEvents() {
    on("logoutButton", "click", () => runAction(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.replace("../login.html");
    }));

    on("refreshButton", "click", () =>
        runAction(loadAll, "Data berhasil diperbarui.")
    );

    on("habitForm", "submit", event =>
        runAction(() => addHabit(event), "Habit berhasil disimpan.")
    );

    on("habitDate", "change", () => runAction(loadAll));

    on("habitList", "click", event => {
        if (event.target.matches('input[type="checkbox"][data-action]')) return;
        handleListAction(event);
    });

    on("habitList", "change", event => {
        if (event.target.matches('[data-action="toggle-habit"]')) {
            handleListAction(event);
        }
    });

    on("journalForm", "submit", event =>
        runAction(() => saveJournal(event), "Catatan berhasil disimpan.")
    );

    on("journalCancel", "click", resetJournalForm);
    on("journalList", "click", handleListAction);
    on("journalSearch", "input", renderJournals);
    on("journalFilterDate", "change", renderJournals);
    on("journalSort", "change", renderJournals);

    on("goalForm", "submit", event =>
        runAction(() => saveGoal(event), "Target berhasil disimpan.")
    );

    on("goalCancel", "click", resetGoalForm);

    on("goalList", "click", event => {
        if (event.target.matches('input[type="checkbox"][data-action]')) return;
        handleListAction(event);
    });

    on("goalList", "change", event => {
        if (event.target.matches('[data-action="toggle-goal"]')) {
            handleListAction(event);
        }
    });

    on("transactionForm", "submit", event =>
        runAction(() => saveTransaction(event), "Transaksi berhasil disimpan.")
    );

    on("transactionCancel", "click", resetTransactionForm);
    on("transactionList", "click", handleListAction);

    ["financeTypeFilter", "financeStartDate", "financeEndDate"].forEach(id => {
        on(id, "change", renderTransactions);
    });

    on("menuToggle", "click", () => {
        const menu = $("featureMenu");
        if (!menu) return;

        menu.hidden = !menu.hidden;
        $("menuToggle").setAttribute("aria-expanded", String(!menu.hidden));
    });

    document.addEventListener("click", event => {
        const menu = $("featureMenu");
        const toggle = $("menuToggle");

        if (!menu || !toggle || menu.hidden) return;

        if (!menu.contains(event.target) && !toggle.contains(event.target)) {
            menu.hidden = true;
            toggle.setAttribute("aria-expanded", "false");
        }
    });
}

// ======================================
// INISIALISASI
// ======================================

async function init() {
    setInitialDates();

    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!data.session) {
            window.location.replace("../login.html");
            return;
        }

        state.user = data.session.user;

        const name = state.user.user_metadata?.full_name;

        if ($("welcomeText")) {
            $("welcomeText").textContent =
                `Halo, ${name || state.user.email}! Yuk lanjutkan perkembanganmu.`;
        }

        attachEvents();
        await loadAll();
    } catch (error) {
        console.error(error);
        notify(
            "Gagal memuat aplikasi. Periksa koneksi internet, tabel Supabase, dan kebijakan RLS. Detail: " +
            error.message,
            "error"
        );
    }
}

init();