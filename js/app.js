import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

const state = {
    user: null,
    habits: [],
    habitLogs: [],
    entries: [],
    goals: [],
    transactions: []
};

const today = () => {
    const date = new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

const money = (amount) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(amount) || 0);

const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);

function notify(message, type = "success") {
    const box = $("appMessage");
    box.textContent = message;
    box.className = `notice notice-${type}`;
}

function clearNotify() {
    $("appMessage").textContent = "";
    $("appMessage").className = "notice";
}

async function runAction(action, successMessage) {
    clearNotify();

    try {
        await action();
        if (successMessage) notify(successMessage, "success");
    } catch (error) {
        console.error(error);
        notify(error.message || "Terjadi kesalahan. Coba lagi.", "error");
    }
}

async function getRows(table, queryBuilder) {
    const { data, error } = await queryBuilder(
        supabase.from(table).select("*")
    );

    if (error) throw error;
    return data || [];
}

async function loadAll() {
    const selectedDate = $("habitDate").value || today();

    const [habits, logs, entries, goals, transactions] = await Promise.all([
        getRows("plt_habits", (query) =>
            query.order("created_at", { ascending: false })
        ),
        getRows("plt_habit_logs", (query) =>
            query.eq("log_date", selectedDate)
        ),
        getRows("plt_entries", (query) =>
            query.order("entry_date", { ascending: false })
        ),
        getRows("plt_goals", (query) =>
            query.order("created_at", { ascending: false })
        ),
        getRows("plt_transactions", (query) =>
            query.order("transaction_date", { ascending: false })
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

function renderHabits() {
    const list = $("habitList");
    const selectedDate = $("habitDate").value || today();

    if (!state.habits.length) {
        list.innerHTML = '<div class="empty-state">Belum ada habit. Tambahkan kebiasaan pertamamu.</div>';
        return;
    }

    list.innerHTML = state.habits.map((habit) => {
        const log = state.habitLogs.find((item) => item.habit_id === habit.id);
        const completed = Boolean(log?.completed);

        return `
            <div class="item-row">
                <div class="item-main">
                    <input
                        type="checkbox"
                        data-action="toggle-habit"
                        data-id="${habit.id}"
                        aria-label="Tandai habit selesai"
                        ${completed ? "checked" : ""}
                    >
                    <div>
                        <strong class="${completed ? "completed-text" : ""}">${escapeHTML(habit.title)}</strong>
                        <p>${completed ? "Selesai" : "Belum selesai"} · ${escapeHTML(selectedDate)}</p>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="button-outline" data-action="edit-habit" data-id="${habit.id}" type="button">Edit</button>
                    <button class="button-danger" data-action="delete-habit" data-id="${habit.id}" type="button">Hapus</button>
                </div>
            </div>`;
    }).join("");
}

function renderJournals() {
    const list = $("journalList");
    const search = $("journalSearch").value.trim().toLowerCase();
    const dateFilter = $("journalFilterDate").value;
    const sort = $("journalSort").value;

    let entries = state.entries.filter((entry) => {
        const matchesSearch =
            `${entry.title} ${entry.content}`.toLowerCase().includes(search);
        const matchesDate = !dateFilter || entry.entry_date === dateFilter;
        return matchesSearch && matchesDate;
    });

    entries.sort((a, b) => {
        const comparison = a.entry_date.localeCompare(b.entry_date);
        return sort === "oldest" ? comparison : -comparison;
    });

    if (!entries.length) {
        list.innerHTML = '<div class="empty-state">Tidak ada jurnal yang cocok dengan pencarianmu.</div>';
        return;
    }

    list.innerHTML = entries.map((entry) => `
        <article class="item-row">
            <div class="item-main">
                <div>
                    <strong>${escapeHTML(entry.title)}</strong>
                    <p>${escapeHTML(entry.entry_date)}</p>
                    <p>${escapeHTML(entry.content.length > 180
                        ? entry.content.slice(0, 180) + "..."
                        : entry.content)}</p>
                </div>
            </div>
            <div class="item-actions">
                <button class="button-outline" data-action="edit-journal" data-id="${entry.id}" type="button">Edit</button>
                <button class="button-danger" data-action="delete-journal" data-id="${entry.id}" type="button">Hapus</button>
            </div>
        </article>
    `).join("");
}

function renderGoals() {
    const list = $("goalList");

    if (!state.goals.length) {
        list.innerHTML = '<div class="empty-state">Belum ada target. Tambahkan satu target kecil terlebih dahulu.</div>';
        return;
    }

    list.innerHTML = state.goals.map((goal) => `
        <div class="item-row">
            <div class="item-main">
                <input
                    type="checkbox"
                    data-action="toggle-goal"
                    data-id="${goal.id}"
                    aria-label="Tandai target tercapai"
                    ${goal.is_completed ? "checked" : ""}
                >
                <div>
                    <strong class="${goal.is_completed ? "completed-text" : ""}">${escapeHTML(goal.title)}</strong>
                    <p>Tenggat: ${goal.deadline ? escapeHTML(goal.deadline) : "Belum ditentukan"}</p>
                    <p>${goal.is_completed ? "Target tercapai" : "Target masih berjalan"}</p>
                </div>
            </div>
            <div class="item-actions">
                <button class="button-outline" data-action="edit-goal" data-id="${goal.id}" type="button">Edit</button>
                <button class="button-danger" data-action="delete-goal" data-id="${goal.id}" type="button">Hapus</button>
            </div>
        </div>
    `).join("");
}

function getFilteredTransactions() {
    const type = $("financeTypeFilter").value;
    const start = $("financeStartDate").value;
    const end = $("financeEndDate").value;

    return state.transactions.filter((item) => {
        if (type !== "all" && item.transaction_type !== type) return false;
        if (start && item.transaction_date < start) return false;
        if (end && item.transaction_date > end) return false;
        return true;
    });
}

function renderTransactions() {
    const list = $("transactionList");
    const transactions = getFilteredTransactions();

    const income = transactions
        .filter((item) => item.transaction_type === "income")
        .reduce((sum, item) => sum + Number(item.amount), 0);

    const expense = transactions
        .filter((item) => item.transaction_type === "expense")
        .reduce((sum, item) => sum + Number(item.amount), 0);

    $("incomeSummary").textContent = money(income);
    $("expenseSummary").textContent = money(expense);

    if (!transactions.length) {
        list.innerHTML = '<div class="empty-state">Belum ada transaksi pada filter ini.</div>';
        return;
    }

    list.innerHTML = transactions.map((item) => {
        const isIncome = item.transaction_type === "income";
        return `
            <div class="item-row">
                <div class="item-main">
                    <div>
                        <strong>${escapeHTML(item.category)}</strong>
                        <p>${escapeHTML(item.transaction_date)} · ${isIncome ? "Pemasukan" : "Pengeluaran"}</p>
                        ${item.note ? `<p>${escapeHTML(item.note)}</p>` : ""}
                        <strong class="${isIncome ? "money-positive" : "money-negative"}">
                            ${isIncome ? "+" : "-"}${money(item.amount)}
                        </strong>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="button-outline" data-action="edit-transaction" data-id="${item.id}" type="button">Edit</button>
                    <button class="button-danger" data-action="delete-transaction" data-id="${item.id}" type="button">Hapus</button>
                </div>
            </div>`;
    }).join("");
}

function renderSummary() {
    const completedToday = state.habitLogs.filter((item) => item.completed).length;
    $("habitSummary").textContent = `${completedToday}/${state.habits.length}`;
    $("journalSummary").textContent = String(state.entries.length);
    $("goalSummary").textContent = String(state.goals.filter((item) => !item.is_completed).length);

    const income = state.transactions
        .filter((item) => item.transaction_type === "income")
        .reduce((sum, item) => sum + Number(item.amount), 0);

    const expense = state.transactions
        .filter((item) => item.transaction_type === "expense")
        .reduce((sum, item) => sum + Number(item.amount), 0);

    $("balanceSummary").textContent = money(income - expense);
}

function renderStatistics() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6);

    const startDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 10);

    const recentEntries = state.entries.filter((item) => item.entry_date >= startDate);
    const recentLogs = state.habitLogs.filter((item) =>
        item.log_date >= startDate && item.completed
    );

    $("weeklyHabitSummary").textContent = String(recentLogs.length);
    $("weeklyJournalSummary").textContent = String(recentEntries.length);
    $("completedGoalSummary").textContent =
        String(state.goals.filter((item) => item.is_completed).length);
    $("transactionCountSummary").textContent = String(state.transactions.length);

    const list = $("weeklyHabitList");
    if (!state.habits.length) {
        list.innerHTML = '<div class="empty-state">Statistik habit akan muncul setelah kamu menambahkan kebiasaan.</div>';
        return;
    }

    list.innerHTML = state.habits.map((habit) => {
        const logs = state.habitLogs.filter((item) =>
            item.habit_id === habit.id && item.completed
        ).length;

        return `
            <div class="item-row">
                <div class="item-main">
                    <div style="width:100%">
                        <strong>${escapeHTML(habit.title)}</strong>
                        <p>${logs} habit selesai pada tanggal yang sedang dipilih</p>
                    </div>
                </div>
            </div>`;
    }).join("");
}

async function addHabit(event) {
    event.preventDefault();
    const title = $("habitName").value.trim();
    if (!title) return;

    const { error } = await supabase.from("plt_habits").insert({
        user_id: state.user.id,
        title
    });

    if (error) throw error;

    $("habitName").value = "";
    await loadAll();
}

async function toggleHabit(id, checked) {
    const selectedDate = $("habitDate").value || today();
    const existing = state.habitLogs.find((item) => item.habit_id === id);

    if (existing) {
        const { error } = await supabase
            .from("plt_habit_logs")
            .update({ completed: checked })
            .eq("id", existing.id);

        if (error) throw error;
    } else {
        const { error } = await supabase.from("plt_habit_logs").insert({
            user_id: state.user.id,
            habit_id: id,
            log_date: selectedDate,
            completed: checked
        });

        if (error) throw error;
    }

    await loadAll();
}

async function editHabit(id) {
    const habit = state.habits.find((item) => item.id === id);
    if (!habit) return;

    const title = prompt("Ubah nama habit:", habit.title);
    if (title === null) return;
    if (!title.trim()) throw new Error("Nama habit tidak boleh kosong.");

    const { error } = await supabase
        .from("plt_habits")
        .update({ title: title.trim() })
        .eq("id", id);

    if (error) throw error;
    await loadAll();
}

async function deleteHabit(id) {
    if (!confirm("Hapus habit ini beserta riwayatnya?")) return;

    const { error } = await supabase.from("plt_habits").delete().eq("id", id);
    if (error) throw error;

    await loadAll();
}

async function saveJournal(event) {
    event.preventDefault();

    const id = $("journalId").value;
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
    $("journalForm").reset();
    $("journalId").value = "";
    $("journalDate").value = today();
    $("journalSubmit").textContent = "Simpan Jurnal";
}

function editJournal(id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;

    $("journalId").value = entry.id;
    $("journalTitle").value = entry.title;
    $("journalContent").value = entry.content;
    $("journalDate").value = entry.entry_date;
    $("journalSubmit").textContent = "Simpan Perubahan";
    $("journal").scrollIntoView({ behavior: "smooth" });
}

async function deleteJournal(id) {
    if (!confirm("Hapus jurnal ini secara permanen?")) return;

    const { error } = await supabase.from("plt_entries").delete().eq("id", id);
    if (error) throw error;

    if ($("journalId").value === id) resetJournalForm();
    await loadAll();
}

async function saveGoal(event) {
    event.preventDefault();

    const id = $("goalId").value;
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
    $("goalForm").reset();
    $("goalId").value = "";
    $("goalSubmit").textContent = "Tambah Target";
}

function editGoal(id) {
    const goal = state.goals.find((item) => item.id === id);
    if (!goal) return;

    $("goalId").value = goal.id;
    $("goalTitle").value = goal.title;
    $("goalDeadline").value = goal.deadline || "";
    $("goalSubmit").textContent = "Simpan Perubahan";
    $("goals").scrollIntoView({ behavior: "smooth" });
}

async function toggleGoal(id, checked) {
    const { error } = await supabase
        .from("plt_goals")
        .update({ is_completed: checked })
        .eq("id", id);

    if (error) throw error;
    await loadAll();
}

async function deleteGoal(id) {
    if (!confirm("Hapus target ini?")) return;

    const { error } = await supabase.from("plt_goals").delete().eq("id", id);
    if (error) throw error;

    if ($("goalId").value === id) resetGoalForm();
    await loadAll();
}

async function saveTransaction(event) {
    event.preventDefault();

    const id = $("transactionId").value;
    const amount = Number($("transactionAmount").value);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error("Nominal harus berupa bilangan bulat lebih dari nol.");
    }

    const payload = {
        user_id: state.user.id,
        transaction_type: $("transactionType").value,
        amount,
        category: $("transactionCategory").value.trim(),
        transaction_date: $("transactionDate").value,
        note: $("transactionNote").value.trim() || null
    };

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
    $("financeForm").reset();
    $("transactionId").value = "";
    $("transactionDate").value = today();
    $("transactionSubmit").textContent = "Simpan Transaksi";
}

function editTransaction(id) {
    const item = state.transactions.find((transaction) => transaction.id === id);
    if (!item) return;

    $("transactionId").value = item.id;
    $("transactionType").value = item.transaction_type;
    $("transactionAmount").value = item.amount;
    $("transactionCategory").value = item.category;
    $("transactionDate").value = item.transaction_date;
    $("transactionNote").value = item.note || "";
    $("transactionSubmit").textContent = "Simpan Perubahan";
    $("finance").scrollIntoView({ behavior: "smooth" });
}

async function deleteTransaction(id) {
    if (!confirm("Hapus transaksi ini?")) return;

    const { error } = await supabase
        .from("plt_transactions")
        .delete()
        .eq("id", id);

    if (error) throw error;

    if ($("transactionId").value === id) resetTransactionForm();
    await loadAll();
}

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
    $("habitDate").value = today();
    $("journalDate").value = today();
    $("transactionDate").value = today();
    $("journalCancel").hidden = true;
    $("goalCancel").hidden = true;
    $("transactionCancel").hidden = true;
}

function attachEvents() {
    $("logoutButton").addEventListener("click", () => runAction(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.replace("./login.html");
    }));

    $("refreshButton").addEventListener("click", () =>
        runAction(loadAll, "Data berhasil diperbarui.")
    );

    $("habitForm").addEventListener("submit", (event) =>
        runAction(() => addHabit(event), "Habit berhasil disimpan.")
    );

    $("habitDate").addEventListener("change", () =>
        runAction(loadAll)
    );

    $("habitList").addEventListener("click", handleListAction);
    $("habitList").addEventListener("change", (event) => {
        if (event.target.dataset.action === "toggle-habit") {
            handleListAction(event);
        }
    });

    $("journalForm").addEventListener("submit", (event) =>
        runAction(() => saveJournal(event), "Jurnal berhasil disimpan.")
    );

    $("journalCancel").addEventListener("click", resetJournalForm);
    $("journalList").addEventListener("click", handleListAction);
    $("journalSearch").addEventListener("input", renderJournals);
    $("journalFilterDate").addEventListener("change", renderJournals);
    $("journalSort").addEventListener("change", renderJournals);

    $("goalForm").addEventListener("submit", (event) =>
        runAction(() => saveGoal(event), "Target berhasil disimpan.")
    );

    $("goalCancel").addEventListener("click", resetGoalForm);
    $("goalList").addEventListener("click", handleListAction);
    $("goalList").addEventListener("change", (event) => {
        if (event.target.dataset.action === "toggle-goal") {
            handleListAction(event);
        }
    });

    $("financeForm").addEventListener("submit", (event) =>
        runAction(() => saveTransaction(event), "Transaksi berhasil disimpan.")
    );

    $("transactionCancel").addEventListener("click", resetTransactionForm);
    $("transactionList").addEventListener("click", handleListAction);

    ["financeTypeFilter", "financeStartDate", "financeEndDate"].forEach((id) => {
        $(id).addEventListener("change", renderTransactions);
    });

    $("journalCancel").hidden = false;
    $("goalCancel").hidden = false;
    $("transactionCancel").hidden = false;
}

async function init() {
    setInitialDates();

    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
        window.location.replace("./login.html");
        return;
    }

    state.user = data.session.user;

    const fullName = state.user.user_metadata?.full_name;
    $("welcomeText").textContent =
        `Halo, ${fullName || state.user.email}! Yuk lanjutkan perkembanganmu.`;

    attachEvents();

    try {
        await loadAll();
    } catch (error) {
        console.error(error);
        notify(
            "Data belum berhasil dimuat. Pastikan tabel Supabase sudah dibuat dan kebijakan RLS aktif. Detail: " + error.message,
            "error"
        );
    }

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
            window.location.replace("./login.html");
        }
    });
}

init();