"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2, Wallet, BookMarked, Plus, X, Pencil, Check,
  AlertCircle, Clock, Star, ExternalLink, ChevronDown, ChevronUp,
  Award, BookOpen,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RawAssociation {
  id: string; name: string; acronym?: string; website?: string;
  member_since?: string; membership_expires?: string;
  fee_amount?: number; fee_currency: string; fee_period: string;
  status: string; notes?: string;
}
export interface AccreditationRequirement {
  id: string; association_id: string; year: number;
  supervision_hours_required: number; learning_hours_required: number;
  therapy_hours_required: number; conference_hours_required: number;
  deadline?: string; notes?: string;
}
export interface AccreditationActual {
  supervision: number; intervision: number; therapy: number;
  learning: number; conference: number;
}
export interface RawExpense {
  id: string; title: string; expense_type: string;
  amount: number; currency: string; paid_date?: string;
  is_paid: boolean; is_tax_deductible: boolean; notes?: string;
}
export interface RawReading {
  id: string; title: string; author?: string; reading_type: string;
  status: string; started_date?: string; completed_date?: string;
  rating?: number; notes?: string; url?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const EXPENSE_LABELS: Record<string, string> = {
  course: "Обучение", supervision: "Супервизия", therapy: "Личная терапия",
  membership: "Членство в ассоциации", book: "Книги", conference: "Конференция", other: "Другое",
};
const EXPENSE_COLORS: Record<string, string> = {
  course: "#3a5ff8", supervision: "#7C3AED", therapy: "#EC4899",
  membership: "#D97706", book: "#16A34A", conference: "#0891B2", other: "#6B7280",
};
const READ_STATUS: Record<string, string> = {
  want_to_read: "Хочу прочитать", reading: "Читаю",
  completed: "Прочитал", abandoned: "Брошено",
};
const ASSOC_STATUS_COLORS: Record<string, string> = {
  active: "#16A34A", inactive: "#6B7280", pending: "#D97706", expired: "#EF4444",
};
const ASSOC_STATUS_LABELS: Record<string, string> = {
  active: "Активное", inactive: "Неактивное", pending: "Ожидание", expired: "Истекло",
};

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/professional-development${path}`, init);
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`); }
  return res.status === 204 ? null : res.json();
}

const INPUT = "w-full rounded-xl border px-3 py-2 text-sm outline-none bg-[#F3EBDD] border-[#CFC0A9] text-[#3D3228]";
const CURRENT_YEAR = new Date().getFullYear();

// ── Shared sub-components ─────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium mb-1" style={{ color: "#6B7280" }}>{label}</label>{children}</div>;
}

function IconBtn({ icon: Icon, onClick, title }: { icon: React.ElementType; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title}
      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
      style={{ color: "#9C8E80" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#E8E0D4"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
      <Icon size={14} />
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/30 backdrop-blur-sm lg:p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl lg:rounded-2xl shadow-2xl"
        style={{ background: "#FBF8F5" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#E5E5E5" }}>
          <h2 className="font-semibold text-sm" style={{ color: "#3D3228" }}>{title}</h2>
          <IconBtn icon={X} onClick={onClose} title="Закрыть" />
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc, action }: {
  icon: React.ElementType; title: string; desc: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
        <Icon size={24} style={{ color: "#9C8E80" }} />
      </div>
      <div className="text-sm font-semibold mb-1" style={{ color: "#3D3228" }}>{title}</div>
      <div className="text-sm max-w-xs" style={{ color: "#9C8E80" }}>{desc}</div>
      {action && (
        <button onClick={action.onClick} className="mt-5 flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> {action.label}
        </button>
      )}
    </div>
  );
}

function TabSkeleton() {
  return <div className="px-4 lg:px-6 py-4 space-y-3">{[1,2,3].map(i => <div key={i} className="rounded-2xl h-20 animate-pulse" style={{ background: "#F3EBDD" }} />)}</div>;
}

function TabError({ msg }: { msg: string }) {
  return (
    <div className="px-4 lg:px-6 py-8 flex flex-col items-center gap-3">
      <AlertCircle size={24} style={{ color: "#EF4444" }} />
      <div className="text-sm text-center" style={{ color: "#6B7280" }}>{msg}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSOCIATIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════

export function AssociationsTab({ onToast }: { onToast: (m: string, t?: "ok"|"err") => void }) {
  const [assocs, setAssocs]       = useState<RawAssociation[]>([]);
  const [accData, setAccData]     = useState<{ associations: (RawAssociation & { requirements: AccreditationRequirement | null; actual: AccreditationActual })[] } | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [editing, setEditing]     = useState<RawAssociation | null>(null);
  const [formOpen, setFormOpen]   = useState(false);
  const [reqTarget, setReqTarget] = useState<RawAssociation | null>(null);
  const [year, setYear]           = useState(CURRENT_YEAR);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/associations"),
      apiFetch(`/accreditation?year=${year}`),
    ]).then(([a, acc]) => { setAssocs(a); setAccData(acc); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { load(); }, [load]);

  async function del(id: string) {
    if (!confirm("Удалить ассоциацию и все требования к ней?")) return;
    try {
      await apiFetch(`/associations/${id}`, { method: "DELETE" });
      setAssocs(p => p.filter(a => a.id !== id));
      onToast("Ассоциация удалена");
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
  }

  if (loading) return <TabSkeleton />;
  if (error)   return <TabError msg={error} />;

  const accMap = new Map((accData?.associations ?? []).map(a => [a.id, a]));

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="rounded-xl border px-2.5 py-1.5 text-sm outline-none"
          style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}>
          {[CURRENT_YEAR, CURRENT_YEAR-1, CURRENT_YEAR+1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => { setEditing(null); setFormOpen(true); }}
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> Добавить ассоциацию
        </button>
      </div>

      {assocs.length === 0 ? (
        <EmptyState icon={Building2} title="Ассоциаций пока нет"
          desc="Добавьте ассоциации, членом которых вы являетесь, и настройте требования для аккредитации"
          action={{ label: "Добавить", onClick: () => { setEditing(null); setFormOpen(true); } }} />
      ) : (
        <div className="space-y-4">
          {assocs.map(a => {
            const acc = accMap.get(a.id);
            const req = acc?.requirements;
            const actual = acc?.actual;
            const expires = a.membership_expires ? new Date(a.membership_expires) : null;
            const daysLeft = expires ? Math.ceil((expires.getTime() - Date.now()) / 86400000) : null;
            const expColor = daysLeft == null ? "#9C8E80" : daysLeft < 30 ? "#EF4444" : daysLeft < 60 ? "#D97706" : "#16A34A";

            return (
              <div key={a.id} className="rounded-2xl p-4" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: "#3D3228" }}>{a.name}</span>
                      {a.acronym && <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: "#E8EEF9", color: "#3a5ff8" }}>{a.acronym}</span>}
                      <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                        style={{ background: `${ASSOC_STATUS_COLORS[a.status]}18`, color: ASSOC_STATUS_COLORS[a.status] }}>
                        {ASSOC_STATUS_LABELS[a.status]}
                      </span>
                    </div>
                    {expires && (
                      <div className="text-xs mt-1 flex items-center gap-1" style={{ color: expColor }}>
                        <Clock size={11} />
                        Членство до {expires.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                        {daysLeft != null && daysLeft <= 60 && ` · осталось ${daysLeft} дн.`}
                      </div>
                    )}
                    {a.fee_amount && (
                      <div className="text-xs mt-0.5" style={{ color: "#9C8E80" }}>
                        Взнос: {a.fee_amount} {a.fee_currency} / {a.fee_period === "annual" ? "год" : a.fee_period === "biennial" ? "2 года" : a.fee_period === "monthly" ? "мес." : "разово"}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {a.website && (
                      <a href={a.website} target="_blank" rel="noopener noreferrer"
                        className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "#9C8E80" }}>
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <IconBtn icon={Pencil} onClick={() => { setEditing(a); setFormOpen(true); }} title="Редактировать" />
                    <IconBtn icon={X} onClick={() => del(a.id)} title="Удалить" />
                  </div>
                </div>

                {/* Accreditation requirements */}
                {req ? (
                  <div className="space-y-2 pt-3 border-t" style={{ borderColor: "#DDD4C6" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9C8E80" }}>
                        Требования {year}
                      </span>
                      <button onClick={() => setReqTarget(a)} className="text-xs" style={{ color: "#3a5ff8" }}>Изменить</button>
                    </div>
                    {[
                      { label: "Супервизия", req: req.supervision_hours_required, actual: actual?.supervision ?? 0 },
                      { label: "Обучение",   req: req.learning_hours_required,    actual: actual?.learning   ?? 0 },
                      { label: "Терапия",    req: req.therapy_hours_required,     actual: actual?.therapy    ?? 0 },
                      { label: "Конференции",req: req.conference_hours_required,  actual: actual?.conference ?? 0 },
                    ].filter(r => r.req > 0).map(r => {
                      const pct = Math.min(100, (r.actual / r.req) * 100);
                      const done = pct >= 100;
                      const warn = pct < 50;
                      const barColor = done ? "#16A34A" : warn ? "#EF4444" : "#3a5ff8";
                      return (
                        <div key={r.label}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs" style={{ color: "#6B7280" }}>{r.label}</span>
                            <span className="text-xs font-semibold" style={{ color: done ? "#16A34A" : warn ? "#EF4444" : "#3D3228" }}>
                              {r.actual}/{r.req} ч {done && "✓"}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#DDD4C6" }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <button onClick={() => setReqTarget(a)}
                    className="mt-2 w-full py-2 rounded-xl text-xs font-medium border-dashed border"
                    style={{ borderColor: "#CFC0A9", color: "#9C8E80" }}>
                    + Установить требования на {year}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <AssociationForm initial={editing} onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => { setFormOpen(false); setEditing(null); load(); onToast(editing ? "Обновлено" : "Ассоциация добавлена"); }}
          onToast={onToast} />
      )}
      {reqTarget && (
        <RequirementsForm
          association={reqTarget}
          year={year}
          existing={accMap.get(reqTarget.id)?.requirements ?? null}
          onClose={() => setReqTarget(null)}
          onSaved={() => { setReqTarget(null); load(); onToast("Требования сохранены"); }}
          onToast={onToast} />
      )}
    </div>
  );
}

function AssociationForm({ initial, onClose, onSaved, onToast }: {
  initial?: RawAssociation | null; onClose: () => void;
  onSaved: () => void; onToast: (m: string, t?: "ok"|"err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    name:               initial?.name               ?? "",
    acronym:            initial?.acronym            ?? "",
    website:            initial?.website            ?? "",
    member_since:       initial?.member_since?.slice(0,10)       ?? "",
    membership_expires: initial?.membership_expires?.slice(0,10) ?? "",
    fee_amount:         initial?.fee_amount != null ? String(initial.fee_amount) : "",
    fee_currency:       initial?.fee_currency ?? "EUR",
    fee_period:         initial?.fee_period   ?? "annual",
    status:             initial?.status        ?? "active",
    notes:              initial?.notes         ?? "",
  });

  async function save() {
    if (!f.name.trim()) { onToast("Укажите название", "err"); return; }
    setSaving(true);
    try {
      const body = { ...f, fee_amount: f.fee_amount ? Number(f.fee_amount) : null };
      if (initial) {
        await apiFetch(`/associations/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await apiFetch("/associations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? "Редактировать ассоциацию" : "Добавить ассоциацию"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Название *"><input value={f.name} onChange={e => setF(p=>({...p,name:e.target.value}))} className={INPUT} placeholder="Ассоциация когнитивно-поведенческой психотерапии" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Аббревиатура"><input value={f.acronym} onChange={e => setF(p=>({...p,acronym:e.target.value}))} className={INPUT} placeholder="АКПП" /></Field>
          <Field label="Статус">
            <select value={f.status} onChange={e => setF(p=>({...p,status:e.target.value}))} className={INPUT}>
              <option value="active">Активное</option>
              <option value="pending">Ожидание</option>
              <option value="inactive">Неактивное</option>
              <option value="expired">Истекло</option>
            </select>
          </Field>
        </div>
        <Field label="Сайт"><input value={f.website} onChange={e => setF(p=>({...p,website:e.target.value}))} className={INPUT} placeholder="https://акпп.рф" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Член с"><input type="date" value={f.member_since} onChange={e => setF(p=>({...p,member_since:e.target.value}))} className={INPUT} /></Field>
          <Field label="Членство до"><input type="date" value={f.membership_expires} onChange={e => setF(p=>({...p,membership_expires:e.target.value}))} className={INPUT} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Взнос">
            <input type="number" min={0} step="0.01" value={f.fee_amount} onChange={e => setF(p=>({...p,fee_amount:e.target.value}))} className={INPUT} placeholder="0" />
          </Field>
          <Field label="Валюта">
            <select value={f.fee_currency} onChange={e => setF(p=>({...p,fee_currency:e.target.value}))} className={INPUT}>
              <option value="EUR">EUR</option>
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field label="Период">
            <select value={f.fee_period} onChange={e => setF(p=>({...p,fee_period:e.target.value}))} className={INPUT}>
              <option value="annual">Год</option>
              <option value="biennial">2 года</option>
              <option value="monthly">Мес.</option>
              <option value="one_time">Разово</option>
            </select>
          </Field>
        </div>
        <Field label="Заметки"><textarea value={f.notes} onChange={e => setF(p=>({...p,notes:e.target.value}))} className={`${INPUT} resize-none`} rows={2} /></Field>
        <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "#3a5ff8", color: "#fff" }}>
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

function RequirementsForm({ association, year, existing, onClose, onSaved, onToast }: {
  association: RawAssociation; year: number;
  existing: AccreditationRequirement | null;
  onClose: () => void; onSaved: () => void; onToast: (m: string, t?: "ok"|"err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    supervision_hours_required: existing?.supervision_hours_required != null ? String(existing.supervision_hours_required) : "",
    learning_hours_required:    existing?.learning_hours_required    != null ? String(existing.learning_hours_required)    : "",
    therapy_hours_required:     existing?.therapy_hours_required     != null ? String(existing.therapy_hours_required)     : "",
    conference_hours_required:  existing?.conference_hours_required  != null ? String(existing.conference_hours_required)  : "",
    deadline: existing?.deadline?.slice(0,10) ?? "",
    notes:    existing?.notes ?? "",
  });

  async function save() {
    setSaving(true);
    try {
      await apiFetch("/accreditation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          association_id:             association.id,
          year,
          supervision_hours_required: Number(f.supervision_hours_required || 0),
          learning_hours_required:    Number(f.learning_hours_required    || 0),
          therapy_hours_required:     Number(f.therapy_hours_required     || 0),
          conference_hours_required:  Number(f.conference_hours_required  || 0),
          deadline: f.deadline || null,
          notes:    f.notes    || null,
        }),
      });
      onSaved();
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={`Требования ${association.acronym ?? association.name} · ${year}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs" style={{ color: "#9C8E80" }}>Укажите минимальное количество часов, требуемых ассоциацией за год. Оставьте 0, если требование отсутствует.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Супервизия (ч)"><input type="number" min={0} step="0.5" value={f.supervision_hours_required} onChange={e=>setF(p=>({...p,supervision_hours_required:e.target.value}))} className={INPUT} placeholder="0" /></Field>
          <Field label="Обучение (ч)"><input type="number" min={0} step="0.5" value={f.learning_hours_required} onChange={e=>setF(p=>({...p,learning_hours_required:e.target.value}))} className={INPUT} placeholder="0" /></Field>
          <Field label="Личная терапия (ч)"><input type="number" min={0} step="0.5" value={f.therapy_hours_required} onChange={e=>setF(p=>({...p,therapy_hours_required:e.target.value}))} className={INPUT} placeholder="0" /></Field>
          <Field label="Конференции (ч)"><input type="number" min={0} step="0.5" value={f.conference_hours_required} onChange={e=>setF(p=>({...p,conference_hours_required:e.target.value}))} className={INPUT} placeholder="0" /></Field>
        </div>
        <Field label="Дедлайн аккредитации"><input type="date" value={f.deadline} onChange={e=>setF(p=>({...p,deadline:e.target.value}))} className={INPUT} /></Field>
        <Field label="Заметки"><textarea value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} className={`${INPUT} resize-none`} rows={2} /></Field>
        <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "#3a5ff8", color: "#fff" }}>
          {saving ? "Сохраняю..." : "Сохранить требования"}
        </button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCES TAB
// ═══════════════════════════════════════════════════════════════════════════════

export function FinancesTab({ onToast }: { onToast: (m: string, t?: "ok"|"err") => void }) {
  const [expenses, setExpenses]   = useState<RawExpense[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [editing, setEditing]     = useState<RawExpense | null>(null);
  const [formOpen, setFormOpen]   = useState(false);
  const [year, setYear]           = useState(CURRENT_YEAR);
  const [filterType, setFilterType] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/expenses?year=${year}`)
      .then(setExpenses).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const filtered = expenses.filter(e => !filterType || e.expense_type === filterType);

  const totalPaid      = filtered.filter(e => e.is_paid).reduce((s, e) => s + e.amount, 0);
  const totalPlanned   = filtered.filter(e => !e.is_paid).reduce((s, e) => s + e.amount, 0);
  const taxDeductible  = filtered.filter(e => e.is_tax_deductible).reduce((s, e) => s + e.amount, 0);
  const currency       = filtered[0]?.currency ?? "EUR";

  async function del(id: string) {
    if (!confirm("Удалить расход?")) return;
    try {
      await apiFetch(`/expenses/${id}`, { method: "DELETE" });
      setExpenses(p => p.filter(e => e.id !== id));
      onToast("Удалено");
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
  }

  async function togglePaid(exp: RawExpense) {
    try {
      const updated = await apiFetch(`/expenses/${exp.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_paid: !exp.is_paid }),
      });
      setExpenses(p => p.map(e => e.id === exp.id ? updated : e));
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
  }

  if (loading) return <TabSkeleton />;
  if (error)   return <TabError msg={error} />;

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="rounded-xl border px-2.5 py-1.5 text-sm outline-none"
          style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}>
          {[CURRENT_YEAR+1, CURRENT_YEAR, CURRENT_YEAR-1, CURRENT_YEAR-2].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="rounded-xl border px-2.5 py-1.5 text-sm outline-none"
          style={{ background: "#F3EBDD", borderColor: "#CFC0A9", color: "#3D3228" }}>
          <option value="">Все категории</option>
          {Object.entries(EXPENSE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
        <button onClick={() => { setEditing(null); setFormOpen(true); }}
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> Добавить
        </button>
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Оплачено",        value: totalPaid,     color: "#16A34A" },
            { label: "Запланировано",   value: totalPlanned,  color: "#D97706" },
            { label: "Нал. вычет",      value: taxDeductible, color: "#3a5ff8" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-3 text-center" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
              <div className="text-lg font-bold" style={{ color: s.color }}>{s.value.toFixed(0)} <span className="text-xs">{currency}</span></div>
              <div className="text-xs mt-0.5" style={{ color: "#9C8E80" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={Wallet} title="Расходов нет"
          desc="Фиксируйте расходы на курсы, супервизии, членство в ассоциациях"
          action={{ label: "Добавить расход", onClick: () => { setEditing(null); setFormOpen(true); } }} />
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.id} className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ background: "#F3EBDD", border: "1px solid #CFC0A9", opacity: e.is_paid ? 1 : 0.85 }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: EXPENSE_COLORS[e.expense_type] ?? "#6B7280" }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" style={{ color: "#3D3228" }}>{e.title}</div>
                <div className="text-xs flex items-center gap-2" style={{ color: "#9C8E80" }}>
                  <span>{EXPENSE_LABELS[e.expense_type]}</span>
                  {e.paid_date && <span>{new Date(e.paid_date).toLocaleDateString("ru-RU", { day:"numeric", month:"short" })}</span>}
                  {e.is_tax_deductible && <span style={{ color: "#16A34A" }}>вычет</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-bold" style={{ color: e.is_paid ? "#3D3228" : "#D97706" }}>
                  {e.amount.toFixed(0)} {e.currency}
                </span>
                <button onClick={() => togglePaid(e)}
                  className="w-6 h-6 rounded-lg border flex items-center justify-center transition-colors"
                  style={{ borderColor: e.is_paid ? "#16A34A" : "#CFC0A9", background: e.is_paid ? "#16A34A" : "transparent" }}
                  title={e.is_paid ? "Отметить как неоплачено" : "Отметить как оплачено"}>
                  {e.is_paid && <Check size={12} style={{ color: "#fff" }} />}
                </button>
                <IconBtn icon={Pencil} onClick={() => { setEditing(e); setFormOpen(true); }} title="Редактировать" />
                <IconBtn icon={X} onClick={() => del(e.id)} title="Удалить" />
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <ExpenseForm initial={editing} onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => { setFormOpen(false); setEditing(null); load(); onToast(editing ? "Обновлено" : "Расход добавлен"); }}
          onToast={onToast} />
      )}
    </div>
  );
}

function ExpenseForm({ initial, onClose, onSaved, onToast }: {
  initial?: RawExpense | null; onClose: () => void;
  onSaved: () => void; onToast: (m: string, t?: "ok"|"err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title:            initial?.title        ?? "",
    expense_type:     initial?.expense_type ?? "course",
    amount:           initial?.amount != null ? String(initial.amount) : "",
    currency:         initial?.currency     ?? "EUR",
    paid_date:        initial?.paid_date?.slice(0,10) ?? "",
    is_paid:          initial?.is_paid          ?? false,
    is_tax_deductible: initial?.is_tax_deductible ?? true,
    notes:            initial?.notes ?? "",
  });

  async function save() {
    if (!f.title.trim()) { onToast("Укажите название", "err"); return; }
    if (!f.amount || Number(f.amount) < 0) { onToast("Укажите сумму", "err"); return; }
    setSaving(true);
    try {
      const body = { ...f, amount: Number(f.amount) };
      if (initial) {
        await apiFetch(`/expenses/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await apiFetch("/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? "Редактировать расход" : "Добавить расход"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Название *"><input value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} className={INPUT} placeholder="КПТ-интенсив, Осло" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Категория">
            <select value={f.expense_type} onChange={e=>setF(p=>({...p,expense_type:e.target.value}))} className={INPUT}>
              {Object.entries(EXPENSE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Статус">
            <select value={String(f.is_paid)} onChange={e=>setF(p=>({...p,is_paid:e.target.value==="true"}))} className={INPUT}>
              <option value="false">Запланировано</option>
              <option value="true">Оплачено</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Сумма *"><input type="number" min={0} step="0.01" value={f.amount} onChange={e=>setF(p=>({...p,amount:e.target.value}))} className={INPUT} placeholder="0" /></Field>
          <Field label="Валюта">
            <select value={f.currency} onChange={e=>setF(p=>({...p,currency:e.target.value}))} className={INPUT}>
              <option value="EUR">EUR</option>
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field label="Дата оплаты"><input type="date" value={f.paid_date} onChange={e=>setF(p=>({...p,paid_date:e.target.value}))} className={INPUT} /></Field>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={f.is_tax_deductible} onChange={e=>setF(p=>({...p,is_tax_deductible:e.target.checked}))} className="w-4 h-4 rounded accent-[#3a5ff8]" />
          <span className="text-sm" style={{ color: "#3D3228" }}>Подходит для налогового вычета</span>
        </label>
        <Field label="Заметки"><textarea value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} className={`${INPUT} resize-none`} rows={2} /></Field>
        <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "#3a5ff8", color: "#fff" }}>
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIBRARY TAB
// ═══════════════════════════════════════════════════════════════════════════════

export function LibraryTab({ onToast }: { onToast: (m: string, t?: "ok"|"err") => void }) {
  const [items, setItems]         = useState<RawReading[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [editing, setEditing]     = useState<RawReading | null>(null);
  const [formOpen, setFormOpen]   = useState(false);
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/reading").then(setItems).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => !filterStatus || i.status === filterStatus);

  async function del(id: string) {
    if (!confirm("Удалить?")) return;
    try {
      await apiFetch(`/reading/${id}`, { method: "DELETE" });
      setItems(p => p.filter(i => i.id !== id));
      onToast("Удалено");
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
  }

  async function setStatus(item: RawReading, status: string) {
    try {
      const extra: Record<string, string> = {};
      if (status === "reading" && !item.started_date) extra.started_date = new Date().toISOString().slice(0,10);
      if (status === "completed" && !item.completed_date) extra.completed_date = new Date().toISOString().slice(0,10);
      const updated = await apiFetch(`/reading/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      setItems(p => p.map(i => i.id === item.id ? updated : i));
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
  }

  if (loading) return <TabSkeleton />;
  if (error)   return <TabError msg={error} />;

  const groups = [
    { status: "reading",       label: "Читаю сейчас" },
    { status: "want_to_read",  label: "Хочу прочитать" },
    { status: "completed",     label: "Прочитал" },
    { status: "abandoned",     label: "Брошено" },
  ];

  return (
    <div className="px-4 lg:px-6 py-4 max-w-3xl">
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1">
          {["", "reading", "want_to_read", "completed"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
              style={{
                background: filterStatus === s ? "#3a5ff8" : "#F3EBDD",
                color: filterStatus === s ? "#fff" : "#6B7280",
                border: "1px solid",
                borderColor: filterStatus === s ? "#3a5ff8" : "#CFC0A9",
              }}>
              {s === "" ? "Все" : READ_STATUS[s]}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditing(null); setFormOpen(true); }}
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold"
          style={{ background: "#3a5ff8", color: "#fff" }}>
          <Plus size={14} /> Добавить
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookMarked} title="Библиотека пуста"
          desc="Добавьте книги и статьи для профессионального роста"
          action={{ label: "Добавить", onClick: () => { setEditing(null); setFormOpen(true); } }} />
      ) : (
        <div className="space-y-6">
          {(filterStatus ? [{ status: filterStatus, label: READ_STATUS[filterStatus] }] : groups).map(g => {
            const gItems = filtered.filter(i => i.status === g.status);
            if (gItems.length === 0) return null;
            return (
              <div key={g.status}>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#9C8E80" }}>
                  {g.label} · {gItems.length}
                </h3>
                <div className="space-y-2">
                  {gItems.map(item => (
                    <div key={item.id} className="rounded-2xl p-4" style={{ background: "#F3EBDD", border: "1px solid #CFC0A9" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <BookOpen size={14} style={{ color: "#3a5ff8", flexShrink: 0, marginTop: 2 }} />
                            <div>
                              <div className="text-sm font-semibold" style={{ color: "#3D3228" }}>{item.title}</div>
                              {item.author && <div className="text-xs mt-0.5" style={{ color: "#9C8E80" }}>{item.author}</div>}
                            </div>
                          </div>
                          {item.status === "completed" && item.rating && (
                            <div className="flex gap-0.5 mt-1.5 ml-5">
                              {[1,2,3,4,5].map(n => (
                                <Star key={n} size={12} fill={n <= item.rating! ? "#F59E0B" : "none"} style={{ color: n <= item.rating! ? "#F59E0B" : "#DDD4C6" }} />
                              ))}
                            </div>
                          )}
                          {item.notes && <div className="text-xs mt-1.5 ml-5 line-clamp-2" style={{ color: "#6B7280" }}>{item.notes}</div>}
                          {/* Status quick-change */}
                          {item.status !== "completed" && item.status !== "abandoned" && (
                            <div className="flex gap-1 mt-2 ml-5">
                              {item.status === "want_to_read" && (
                                <button onClick={() => setStatus(item, "reading")}
                                  className="text-xs px-2 py-1 rounded-lg" style={{ background: "#E8EEF9", color: "#3a5ff8" }}>
                                  Начать читать
                                </button>
                              )}
                              {item.status === "reading" && (
                                <button onClick={() => setStatus(item, "completed")}
                                  className="text-xs px-2 py-1 rounded-lg" style={{ background: "#DCFCE7", color: "#16A34A" }}>
                                  Отметить прочитанным
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer"
                              className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "#9C8E80" }}>
                              <ExternalLink size={13} />
                            </a>
                          )}
                          <IconBtn icon={Pencil} onClick={() => { setEditing(item); setFormOpen(true); }} title="Редактировать" />
                          <IconBtn icon={X} onClick={() => del(item.id)} title="Удалить" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <ReadingForm initial={editing} onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={() => { setFormOpen(false); setEditing(null); load(); onToast(editing ? "Обновлено" : "Добавлено в библиотеку"); }}
          onToast={onToast} />
      )}
    </div>
  );
}

function ReadingForm({ initial, onClose, onSaved, onToast }: {
  initial?: RawReading | null; onClose: () => void;
  onSaved: () => void; onToast: (m: string, t?: "ok"|"err") => void;
}) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title:          initial?.title          ?? "",
    author:         initial?.author         ?? "",
    reading_type:   initial?.reading_type   ?? "book",
    status:         initial?.status         ?? "want_to_read",
    started_date:   initial?.started_date?.slice(0,10)   ?? "",
    completed_date: initial?.completed_date?.slice(0,10) ?? "",
    rating:         initial?.rating != null ? String(initial.rating) : "",
    notes:          initial?.notes ?? "",
    url:            initial?.url   ?? "",
  });

  async function save() {
    if (!f.title.trim()) { onToast("Укажите название", "err"); return; }
    setSaving(true);
    try {
      const body = { ...f, rating: f.rating ? Number(f.rating) : null };
      if (initial) {
        await apiFetch(`/reading/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await apiFetch("/reading", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e: unknown) { onToast(e instanceof Error ? e.message : "Ошибка", "err"); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={initial ? "Редактировать" : "Добавить в библиотеку"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Название *"><input value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} className={INPUT} placeholder="Когнитивно-поведенческая терапия" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Автор"><input value={f.author} onChange={e=>setF(p=>({...p,author:e.target.value}))} className={INPUT} placeholder="Аарон Бек" /></Field>
          <Field label="Тип">
            <select value={f.reading_type} onChange={e=>setF(p=>({...p,reading_type:e.target.value}))} className={INPUT}>
              <option value="book">Книга</option>
              <option value="article">Статья</option>
              <option value="paper">Научная статья</option>
              <option value="manual">Руководство</option>
              <option value="other">Другое</option>
            </select>
          </Field>
        </div>
        <Field label="Статус">
          <select value={f.status} onChange={e=>setF(p=>({...p,status:e.target.value}))} className={INPUT}>
            {Object.entries(READ_STATUS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {(f.status === "reading" || f.status === "completed") && (
          <Field label="Начало чтения"><input type="date" value={f.started_date} onChange={e=>setF(p=>({...p,started_date:e.target.value}))} className={INPUT} /></Field>
        )}
        {f.status === "completed" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Дата завершения"><input type="date" value={f.completed_date} onChange={e=>setF(p=>({...p,completed_date:e.target.value}))} className={INPUT} /></Field>
            <Field label="Оценка (1-5)">
              <select value={f.rating} onChange={e=>setF(p=>({...p,rating:e.target.value}))} className={INPUT}>
                <option value="">—</option>
                {[5,4,3,2,1].map(n=><option key={n} value={n}>{"★".repeat(n)}</option>)}
              </select>
            </Field>
          </div>
        )}
        <Field label="Ссылка"><input value={f.url} onChange={e=>setF(p=>({...p,url:e.target.value}))} className={INPUT} placeholder="https://..." /></Field>
        <Field label="Заметки / Ключевые мысли"><textarea value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} className={`${INPUT} resize-none`} rows={3} placeholder="Что понравилось, что взял в практику..." /></Field>
        <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "#3a5ff8", color: "#fff" }}>
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}
