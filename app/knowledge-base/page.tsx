"use client";

import { useState, useEffect, useRef } from "react";
import { BookOpen, Upload, Trash2, Download, FileText, ExternalLink, RefreshCw, ArrowLeft, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { getFileStatus } from "@/lib/knowledgeBaseConfig";

interface KBFile {
  name:       string;
  size:       number;
  modifiedAt: string;
}

const PROTECTED_FILES = new Set([
  "000_CORE_INSTRUCTIONS.md",
  "00_КАРТА_БАЗЫ_ЗНАНИЙ.md",
]);

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

interface DeleteConfirmProps {
  filename: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}
function DeleteConfirm({ filename, onCancel, onConfirm, loading }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-2">Удалить файл?</h2>
        <p className="text-sm text-slate-500 mb-1 font-mono">{filename}</p>
        <p className="text-sm text-slate-400 mb-6">Файл будет удалён из базы знаний. Это действие нельзя отменить.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Отмена
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-slate-200 text-white text-sm font-medium transition-colors">
            {loading ? "Удаляю..." : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [files, setFiles]           = useState<KBFile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [externalLink, setExternalLink]   = useState("");
  const [internalOpen, setInternalOpen]   = useState(false);
  const [externalOpen, setExternalOpen]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadFiles() {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge-base");
      setFiles(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFiles(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/knowledge-base", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadMsg(`✓ Файл ${file.name} добавлен. Пока не используется в анализе — подключите его к нужному режиму.`);
      await loadFiles();
    } catch (err) {
      setUploadMsg(`Ошибка: ${err}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await fetch(`/api/knowledge-base/${encodeURIComponent(deleteTarget)}`, { method: "DELETE" });
      await loadFiles();
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "inherit" }}>
      <div className="p-8 max-w-4xl mx-auto">

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: "#A8997F" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#4A3C2E"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#A8997F"; }}
            >
              <ArrowLeft size={16} />
              Назад
            </button>
            <div className="w-px h-5" style={{ background: "#DDD4C6" }} />
            <h1 className="text-xl font-bold" style={{ color: "#3D3228" }}>База знаний</h1>
          </div>
          <p className="text-sm" style={{ color: "#A8997F" }}>Файлы, которые используются в AI-анализе консультаций</p>
        </div>

        {/* Block 1: Internal KB */}
        <section className="mb-4">
          <button
            onClick={() => setInternalOpen((v) => !v)}
            aria-expanded={internalOpen}
            aria-controls="internal-kb-content"
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            style={{ background: internalOpen ? "#EDE7DA" : "#F0EBE1", border: "1px solid #DDD4C6" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#EDE7DA"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = internalOpen ? "#EDE7DA" : "#F0EBE1"; }}
          >
            <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider" style={{ color: "#6B5D4F" }}>
              <BookOpen size={15} style={{ color: "#C9BBAA" }} />
              Внутренняя база знаний
            </span>
            <ChevronDown
              size={16}
              style={{ color: "#A8997F", transition: "transform 0.2s", transform: internalOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
            />
          </button>

          {internalOpen && (
            <div id="internal-kb-content" className="mt-3">
              <div className="flex items-center justify-end gap-2 mb-4">
                <button
                  onClick={loadFiles}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: "#A8997F" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#E8E0D0"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  title="Обновить"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium transition-colors disabled:opacity-60"
                >
                  <Upload size={13} />
                  {uploading ? "Загружаю..." : "Добавить документ"}
                </button>
                <input ref={fileRef} type="file" accept=".md,.txt" className="hidden" onChange={handleUpload} />
              </div>

              {uploadMsg && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${uploadMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                  {uploadMsg}
                </div>
              )}

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "#E8E0D0" }} />)}
                </div>
              ) : (
                <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: "#F0EBE1", borderColor: "#DDD4C6" }}>
                  {files.length === 0 ? (
                    <div className="py-10 text-center text-sm" style={{ color: "#A8997F" }}>Файлы не найдены</div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b" style={{ background: "#E8E0D0", borderColor: "#DDD4C6" }}>
                          <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#A8997F" }}>Файл</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "#A8997F" }}>Размер</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "#A8997F" }}>Изменён</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#A8997F" }}>Статус</th>
                          <th className="px-4 py-3 w-24"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {files.map((file, i) => (
                          <tr
                            key={file.name}
                            className="transition-colors"
                            style={{ borderTop: i > 0 ? "1px solid #E8E0D0" : undefined }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#EDE7DA"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <FileText size={14} className="flex-shrink-0" style={{ color: "#C9BBAA" }} />
                                <span className="text-sm font-mono truncate max-w-[180px]" style={{ color: "#4A3C2E" }}>{file.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-xs hidden sm:table-cell" style={{ color: "#A8997F" }}>{formatSize(file.size)}</td>
                            <td className="px-4 py-3.5 text-xs hidden md:table-cell" style={{ color: "#A8997F" }}>{formatDate(file.modifiedAt)}</td>
                            <td className="px-4 py-3.5">
                              {(() => {
                                const s = getFileStatus(file.name);
                                if (s === "always") return <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium">всегда</span>;
                                if (s === "used")   return <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">используется</span>;
                                return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#E4DDD0", color: "#A8997F" }}>не подключён</span>;
                              })()}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1 justify-end">
                                <a
                                  href={`/api/knowledge-base/${encodeURIComponent(file.name)}`}
                                  download={file.name}
                                  className="p-1.5 rounded-lg transition-colors"
                                  style={{ color: "#C9BBAA" }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = "#4A3C2E"; e.currentTarget.style.background = "#E4DDD0"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = "#C9BBAA"; e.currentTarget.style.background = "transparent"; }}
                                  title="Скачать"
                                >
                                  <Download size={13} />
                                </a>
                                {!PROTECTED_FILES.has(file.name) && (
                                  <button
                                    onClick={() => setDeleteTarget(file.name)}
                                    className="p-1.5 rounded-lg text-stone-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                    title="Удалить"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <p className="text-xs mt-3" style={{ color: "#C9BBAA" }}>
                Форматы: .md, .txt · Основные файлы (000_, 00_) защищены от удаления
              </p>
            </div>
          )}
        </section>

        {/* Block 2: External KB */}
        <section className="mb-4">
          <button
            onClick={() => setExternalOpen((v) => !v)}
            aria-expanded={externalOpen}
            aria-controls="external-kb-content"
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            style={{ background: externalOpen ? "#EDE7DA" : "#F0EBE1", border: "1px solid #DDD4C6" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#EDE7DA"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = externalOpen ? "#EDE7DA" : "#F0EBE1"; }}
          >
            <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider" style={{ color: "#6B5D4F" }}>
              <ExternalLink size={15} style={{ color: "#C9BBAA" }} />
              Внешняя база знаний
            </span>
            <ChevronDown
              size={16}
              style={{ color: "#A8997F", transition: "transform 0.2s", transform: externalOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
            />
          </button>

          {externalOpen && (
            <div id="external-kb-content" className="mt-3">
              <div className="rounded-2xl border shadow-sm p-6" style={{ background: "#F0EBE1", borderColor: "#DDD4C6" }}>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: "#6B5D4F" }}>
                  Отдельная локальная база знаний с файлами психолога — личные протоколы, теоретические материалы, конспекты.
                  Интеграция планируется в следующих версиях.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    value={externalLink}
                    onChange={(e) => setExternalLink(e.target.value)}
                    placeholder="https://github.com/... или локальный путь"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 placeholder:text-stone-300"
                    style={{ background: "#FAF7F1", borderColor: "#D4C9B5", color: "#3D3228" }}
                  />
                  <button
                    onClick={() => externalLink && window.open(externalLink, "_blank")}
                    className="px-4 py-2.5 rounded-xl border text-sm transition-colors flex-shrink-0"
                    style={{ borderColor: "#D4C9B5", color: "#6B5D4F", background: "#EDE7DA" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#E4DDD0"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#EDE7DA"; }}
                  >
                    Открыть
                  </button>
                </div>
                <p className="text-xs mt-3" style={{ color: "#C9BBAA" }}>
                  Интеграция с локальной папкой и автоматическая синхронизация — скоро
                </p>
              </div>
            </div>
          )}
        </section>

      </div>

      {deleteTarget && (
        <DeleteConfirm
          filename={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
