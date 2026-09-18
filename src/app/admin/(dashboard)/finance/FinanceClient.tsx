"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LightButton, LightCard, LightField, LightSectionHeader, LightSeamDivider, LightStatCard } from "@/components/ui/light";
import { addTransaction, deleteTransaction, markTeamEntryFeePaid, addCategory } from "./actions";

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Ziina", "Other"];
const NEW_CATEGORY_VALUE = "__new__";

function emptyEntry() {
  return { type: "Expense", category: "", description: "", amount: "", txn_date: new Date().toISOString().slice(0, 10), payment_method: "Cash", notes: "" };
}

export default function FinanceClient({ initialTransactions, teams, initialCategories, currentRole }: any) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [categories, setCategories] = useState(initialCategories);
  const [entry, setEntry] = useState(emptyEntry());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [markingTeam, setMarkingTeam] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  const canAccess = currentRole === "Super Admin";

  const summary = useMemo(() => {
    const income = transactions.filter((t: any) => t.type === "Income").reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const expense = transactions.filter((t: any) => t.type === "Expense").reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    const byCategory: Record<string, number> = {};
    for (const t of transactions) {
      const key = `${t.type}: ${t.category}`;
      byCategory[key] = (byCategory[key] || 0) + Number(t.amount || 0);
    }
    return { income, expense, net: income - expense, byCategory };
  }, [transactions]);

  const categoryOptions = useMemo(() => categories.filter((c: any) => c.type === entry.type), [categories, entry.type]);

  async function handleAdd() {
    setSaving(true);
    setErr("");
    const res: any = await addTransaction({ ...entry, amount: Number(entry.amount) });
    setSaving(false);
    if (res.error) setErr(res.error);
    else {
      setEntry(emptyEntry());
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;
    const res: any = await deleteTransaction(id);
    if (res.error) setErr(res.error);
    else {
      setTransactions((prev: any[]) => prev.filter((t) => t.id !== id));
    }
  }

  async function handleMarkPaid(teamId: string, amount: number) {
    setMarkingTeam(teamId);
    const res: any = await markTeamEntryFeePaid(teamId, amount);
    setMarkingTeam(null);
    if (res.error) setErr(res.error);
    else router.refresh();
  }

  function handleCategorySelect(value: string) {
    if (value === NEW_CATEGORY_VALUE) {
      setEntry((f) => ({ ...f, category: NEW_CATEGORY_VALUE }));
    } else {
      setEntry((f) => ({ ...f, category: value }));
    }
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    setErr("");
    const res: any = await addCategory(entry.type, newCategoryName);
    setAddingCategory(false);
    if (res.error) setErr(res.error);
    else {
      const added = { id: crypto.randomUUID(), type: entry.type, name: newCategoryName.trim() };
      setCategories((prev: any[]) => [...prev, added]);
      setEntry((f) => ({ ...f, category: added.name }));
      setNewCategoryName("");
      router.refresh();
    }
  }

  if (!canAccess) {
    return (
      <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg light-form" style={{ minHeight: "100vh" }}>
        <LightSectionHeader eyebrow="Admin" title="Finance Tracker" />
        <LightSeamDivider />
        <LightCard className="p-4 text-sm text-orange" style={{ borderColor: "rgba(255,122,61,0.3)" }}>
          Only Super Admin can access the Finance Tracker.
        </LightCard>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 -mt-20 md:-mt-8 -mb-16 px-4 sm:px-6 pt-20 md:pt-8 pb-16 bg-adminBg light-form" style={{ minHeight: "100vh" }}>
      <LightSectionHeader eyebrow="Admin · Super Admin Only" title="Finance Tracker" />
      <LightSeamDivider />

      <div className="grid grid-cols-3 gap-2 my-5">
        <LightStatCard label="Total Income" value={`AED ${summary.income.toLocaleString()}`} tone="green" />
        <LightStatCard label="Total Expenses" value={`AED ${summary.expense.toLocaleString()}`} tone="red" />
        <LightStatCard label="Net Balance" value={`AED ${summary.net.toLocaleString()}`} tone={summary.net >= 0 ? "gold" : "red"} />
      </div>

      <LightCard className="p-4 mb-5">
        <div className="text-xs font-bold uppercase tracking-wide mb-3 text-slateText">Breakdown by Category</div>
        <div className="space-y-1">
          {Object.entries(summary.byCategory).map(([key, amt]) => (
            <div key={key} className="flex justify-between text-sm py-1 border-b last:border-0 border-black/5">
              <span className="text-slateText">{key}</span>
              <span className="font-semibold text-navyText">AED {amt.toLocaleString()}</span>
            </div>
          ))}
          {Object.keys(summary.byCategory).length === 0 && <div className="text-sm text-slateText">No entries yet.</div>}
        </div>
      </LightCard>

      <LightCard className="p-4 mb-5">
        <div className="text-xs font-bold uppercase tracking-wide mb-3 text-slateText">Team Entry Fees (AED 1,500 each)</div>
        <div className="space-y-2">
          {teams.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0 border-black/5">
              <div>
                <div className="text-sm font-semibold text-navyText">{t.name}</div>
                <div className="text-[11px] text-slateText">
                  {t.entry_fee_status === "Paid" ? `Paid on ${t.entry_fee_paid_date}` : "Not yet paid"}
                </div>
              </div>
              {t.entry_fee_status === "Paid" ? (
                <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: "rgba(61,220,151,0.15)", color: "#1D9A63" }}>PAID</span>
              ) : (
                <LightButton variant="primary" size="sm" onClick={() => handleMarkPaid(t.id, t.entry_fee_amount || 1500)} disabled={markingTeam === t.id}>
                  {markingTeam === t.id ? "Saving…" : "Mark as Paid"}
                </LightButton>
              )}
            </div>
          ))}
        </div>
      </LightCard>

      <LightCard className="p-4 mb-5">
        <div className="text-xs font-bold uppercase tracking-wide mb-3 text-slateText">Add Entry</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <LightField label="Type">
            <select value={entry.type} onChange={(e) => setEntry((f) => ({ ...f, type: e.target.value, category: "" }))}>
              <option>Expense</option>
              <option>Income</option>
            </select>
          </LightField>
          <LightField label="Category">
            <select value={entry.category} onChange={(e) => handleCategorySelect(e.target.value)}>
              <option value="">Select</option>
              {categoryOptions.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
              <option value={NEW_CATEGORY_VALUE}>+ Add New Category</option>
            </select>
          </LightField>
        </div>

        {entry.category === NEW_CATEGORY_VALUE && (
          <div className="flex gap-2 items-end mb-4 -mt-2">
            <div style={{ flex: 1 }}>
              <LightField label="New Category Name">
                <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder={`e.g. ${entry.type === "Income" ? "Sponsorship" : "Ground Booking"}`} />
              </LightField>
            </div>
            <LightButton variant="primary" size="sm" onClick={handleAddCategory} disabled={addingCategory || !newCategoryName.trim()}>
              {addingCategory ? "Adding…" : "Add"}
            </LightButton>
          </div>
        )}

        <LightField label="Description">
          <input value={entry.description} onChange={(e) => setEntry((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Ground booking for auction day" />
        </LightField>
        <div className="grid sm:grid-cols-3 gap-3">
          <LightField label="Amount (AED)">
            <input type="number" value={entry.amount} onChange={(e) => setEntry((f) => ({ ...f, amount: e.target.value }))} />
          </LightField>
          <LightField label="Date">
            <input type="date" value={entry.txn_date} onChange={(e) => setEntry((f) => ({ ...f, txn_date: e.target.value }))} />
          </LightField>
          <LightField label="Payment Method">
            <select value={entry.payment_method} onChange={(e) => setEntry((f) => ({ ...f, payment_method: e.target.value }))}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </LightField>
        </div>
        <LightField label="Notes (optional)">
          <textarea value={entry.notes} onChange={(e) => setEntry((f) => ({ ...f, notes: e.target.value }))} rows={2} />
        </LightField>
        {err && <div className="text-xs mb-3 text-red">{err}</div>}
        <LightButton variant="primary" onClick={handleAdd} disabled={saving || !entry.category || entry.category === NEW_CATEGORY_VALUE || !entry.amount}>
          {saving ? "Saving…" : "Add Entry"}
        </LightButton>
      </LightCard>

      <div className="text-xs font-bold uppercase tracking-wide mb-3 text-slateText">All Entries</div>
      <div className="space-y-2">
        {transactions.length === 0 && <LightCard className="p-8 text-center text-sm text-slateText">No transactions recorded yet.</LightCard>}
        {transactions.map((t: any) => (
          <LightCard key={t.id} className="p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-navyText">
                  {t.description || t.category}
                  <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.type === "Income" ? "rgba(61,220,151,0.15)" : "rgba(255,93,108,0.15)", color: t.type === "Income" ? "#1D9A63" : "#C0374A" }}>
                    {t.type}
                  </span>
                </div>
                <div className="text-[11px] text-slateText">{t.category} · {t.txn_date} · {t.payment_method} {t.source && t.source !== "manual" ? "· Auto-recorded" : ""}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-navyText">AED {Number(t.amount).toLocaleString()}</span>
                <button onClick={() => handleDelete(t.id)} className="text-xs text-red underline">Delete</button>
              </div>
            </div>
          </LightCard>
        ))}
      </div>
    </div>
  );
}
