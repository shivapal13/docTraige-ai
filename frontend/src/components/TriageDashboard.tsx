import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  User as UserIcon,
  KeyRound,
  Check,
  Copy,
} from 'lucide-react';
import { DocumentItem, UrgencyTier, DocumentStatus, User } from '../types';

interface TriageDashboardProps {
  user: User | null;
  documents: DocumentItem[];
  loading: boolean;
  onRefresh: () => void;
  onOpenUpload: () => void;
  onLogout: () => void;
  wsConnected: boolean;
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
}

export const TriageDashboard: React.FC<TriageDashboardProps> = ({
  user,
  documents,
  loading,
  onRefresh,
  onOpenUpload,
  onLogout,
  wsConnected,
  selectedDocId,
  onSelectDoc,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'PANIC_RULES' | 'LABS' | 'RED_FLAGS' | 'RAW_TEXT'>('PANIC_RULES');
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyJoinCode = () => {
    const code = user?.hospital?.joinCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        doc.filename.toLowerCase().includes(q) ||
        doc.extractionResult?.patientName?.toLowerCase().includes(q) ||
        doc.extractionResult?.mrn?.toLowerCase().includes(q);
      const matchUrgency = urgencyFilter === 'ALL' || doc.urgency === urgencyFilter;
      return matchSearch && matchUrgency;
    });
  }, [documents, searchQuery, urgencyFilter]);

  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === selectedDocId) ?? null,
    [documents, selectedDocId],
  );

  const stats = useMemo(() => ({
    stat: documents.filter((d) => d.urgency === 'STAT').length,
    urgent: documents.filter((d) => d.urgency === 'URGENT').length,
    routine: documents.filter((d) => d.urgency === 'ROUTINE').length,
  }), [documents]);

  const urgencyBadge = (urgency: UrgencyTier) => {
    if (urgency === 'STAT') return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 stat-dot" />
        STAT
      </span>
    );
    if (urgency === 'URGENT') return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Urgent
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
        Routine
      </span>
    );
  };

  const statusBadge = (status: DocumentStatus) => {
    const styles: Record<DocumentStatus, { label: string; cls: string; icon: React.ReactNode }> = {
      PROCESSED: { label: 'Processed', cls: 'text-emerald-400', icon: <CheckCircle2 className="w-3 h-3" /> },
      PROCESSING: { label: 'Processing', cls: 'text-sky-400', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
      QUEUED: { label: 'Queued', cls: 'text-slate-400', icon: <Clock className="w-3 h-3" /> },
      FAILED: { label: 'Failed', cls: 'text-red-400', icon: <AlertTriangle className="w-3 h-3" /> },
    };
    const s = styles[status];
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${s.cls}`}>
        {s.icon}{s.label}
      </span>
    );
  };

  const TABS: Array<{ key: 'PANIC_RULES' | 'LABS' | 'RED_FLAGS' | 'RAW_TEXT'; label: string }> = [
    { key: 'PANIC_RULES', label: `Panic Rules (${selectedDoc?.ruleMatches?.length ?? 0})` },
    { key: 'LABS', label: `Lab Values (${selectedDoc?.extractionResult?.extractedLabValues?.length ?? 0})` },
    { key: 'RED_FLAGS', label: `Red Flags (${selectedDoc?.extractionResult?.flaggedPhrases?.length ?? 0})` },
    { key: 'RAW_TEXT', label: 'OCR Text' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#0f1117] text-slate-200 overflow-hidden">
      {/* ── Top Nav ── */}
      <header className="shrink-0 flex items-center justify-between px-5 h-12 border-b border-slate-800 bg-[#13161f]">
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="w-6 h-6 rounded bg-red-600 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-white">DocTriage AI</span>
          <span className="text-slate-600">/</span>
          <span className="text-xs text-slate-300 font-medium bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-red-400" />
            {user?.hospitalName || user?.hospital?.name || 'General Hospital'}
          </span>

          {user?.hospital?.joinCode && (
            <button
              type="button"
              onClick={handleCopyJoinCode}
              title="Click to copy Facility Join Code for staff registration"
              className="text-[11px] font-mono text-slate-300 bg-slate-900/90 hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-700/70 flex items-center gap-1.5 transition group"
            >
              <KeyRound className="w-3 h-3 text-amber-400" />
              <span>{user.hospital.joinCode}</span>
              {copiedCode ? (
                <Check className="w-3 h-3 text-emerald-400 ml-0.5" />
              ) : (
                <Copy className="w-2.5 h-2.5 text-slate-500 group-hover:text-slate-300 ml-0.5" />
              )}
            </button>
          )}

          {/* Stats pills */}
          <div className="hidden md:flex items-center gap-1.5 ml-4 text-xs">
            <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">{stats.stat} STAT</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">{stats.urgent} Urgent</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">{stats.routine} Routine</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* WS beacon */}
          <span
            title={wsConnected ? 'Live stream active' : 'Live stream offline'}
            className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-slate-600'}`}
          />

          <button
            onClick={onRefresh}
            className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-400' : ''}`} />
          </button>

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Upload
          </button>

          <div className="w-px h-5 bg-slate-800 mx-1" />

          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
            <span className="hidden sm:block text-slate-300 text-xs">{user?.name ?? user?.email ?? 'Clinician'}</span>
            <button
              onClick={onLogout}
              className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Split Pane ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Queue */}
        <aside className="w-80 xl:w-96 shrink-0 border-r border-slate-800 bg-[#13161f] flex flex-col overflow-hidden">
          {/* Search + filter */}
          <div className="p-3 border-b border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search patient, MRN, file…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0f1117] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition"
              />
            </div>
            <div className="flex items-center gap-1">
              {(['ALL', 'STAT', 'URGENT', 'ROUTINE'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setUrgencyFilter(f)}
                  className={`flex-1 py-1 rounded text-xs font-medium transition ${
                    urgencyFilter === f
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {f === 'ALL' ? 'All' : f === 'ROUTINE' ? 'Routine' : f}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {filteredDocuments.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 text-center">
                {loading ? 'Loading…' : 'No records found.'}
              </p>
            ) : (
              filteredDocuments.map((doc) => {
                const isSelected = doc.id === selectedDocId;
                const patient = doc.extractionResult?.patientName ?? 'Unknown patient';
                const mrn = doc.extractionResult?.mrn ?? '—';
                const ruleCount = doc.ruleMatches?.length ?? 0;

                return (
                  <button
                    key={doc.id}
                    onClick={() => onSelectDoc(doc.id)}
                    className={`w-full text-left px-4 py-3 transition flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-[#1e2335] border-l-2 border-l-red-500'
                        : 'hover:bg-[#1a1e2d] border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-200 truncate">{patient}</div>
                        <div className="text-xs text-slate-500 truncate">MRN {mrn} · {doc.filename}</div>
                      </div>
                      {urgencyBadge(doc.urgency)}
                    </div>
                    <div className="flex items-center gap-3">
                      {statusBadge(doc.status)}
                      {ruleCount > 0 && (
                        <span className="text-xs text-red-400 font-medium">
                          {ruleCount} rule{ruleCount > 1 ? 's' : ''} triggered
                        </span>
                      )}
                      <span className="text-xs text-slate-600 ml-auto">
                        {new Date(doc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT: Detail view */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {selectedDoc ? (
            <>
              {/* Patient header */}
              <div className="shrink-0 px-6 py-5 border-b border-slate-800 bg-[#13161f]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-semibold text-white">
                        {selectedDoc.extractionResult?.patientName ?? 'Unknown patient'}
                      </h2>
                      {urgencyBadge(selectedDoc.urgency)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>MRN: <strong className="text-slate-300">{selectedDoc.extractionResult?.mrn ?? '—'}</strong></span>
                      <span>DOB: <strong className="text-slate-300">{selectedDoc.extractionResult?.dob ?? '—'}</strong></span>
                      <span>Type: <strong className="text-slate-300">{selectedDoc.extractionResult?.documentType ?? '—'}</strong></span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 text-right">
                    <div>{selectedDoc.filename}</div>
                    <div>{new Date(selectedDoc.createdAt).toLocaleString()}</div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 mt-5">
                  {TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-3 py-1.5 rounded text-sm transition ${
                        activeTab === tab.key
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 p-6">
                {/* PANIC RULES */}
                {activeTab === 'PANIC_RULES' && (
                  <div className="space-y-3">
                    {!selectedDoc.ruleMatches || selectedDoc.ruleMatches.length === 0 ? (
                      <div className="rounded-lg border border-slate-800 p-8 text-center text-sm text-slate-500">
                        No panic threshold violations on this record.
                      </div>
                    ) : (
                      selectedDoc.ruleMatches.map((rule) => (
                        <div key={rule.id} className="rounded-lg border border-slate-800 bg-[#171b26] p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <ShieldAlert className="w-4 h-4 text-red-400" />
                                <span className="text-sm font-semibold text-white">{rule.ruleName}</span>
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                  rule.severity === 'STAT' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
                                }`}>
                                  {rule.severity}
                                </span>
                              </div>
                              <p className="text-sm text-slate-400">{rule.description}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-lg font-bold text-amber-400 font-mono">{rule.foundValue}</div>
                              <div className="text-xs text-slate-500">threshold: {rule.threshold}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* LABS */}
                {activeTab === 'LABS' && (
                  <div>
                    {!selectedDoc.extractionResult?.extractedLabValues?.length ? (
                      <div className="rounded-lg border border-slate-800 p-8 text-center text-sm text-slate-500">
                        No lab values extracted from this document.
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-800 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-[#1e2335] text-xs text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="text-left px-4 py-2.5">Test</th>
                              <th className="text-left px-4 py-2.5">Value</th>
                              <th className="text-left px-4 py-2.5">Unit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {selectedDoc.extractionResult.extractedLabValues.map((lab, i) => (
                              <tr key={i} className="hover:bg-[#1a1e2d] transition">
                                <td className="px-4 py-2.5 font-medium text-slate-200">{lab.test}</td>
                                <td className="px-4 py-2.5 font-mono text-amber-400 font-semibold">{lab.value}</td>
                                <td className="px-4 py-2.5 text-slate-500">{lab.unit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* RED FLAGS */}
                {activeTab === 'RED_FLAGS' && (
                  <div>
                    {!selectedDoc.extractionResult?.flaggedPhrases?.length ? (
                      <div className="rounded-lg border border-slate-800 p-8 text-center text-sm text-slate-500">
                        No clinical red-flag phrases identified.
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {selectedDoc.extractionResult.flaggedPhrases.map((item, i) => {
                          const text = typeof item === 'string' ? item : item.phrase;
                          const uncertain = typeof item === 'object' && item.status === 'uncertain';
                          return (
                            <div
                              key={i}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                                uncertain
                                  ? 'border-amber-800/40 bg-amber-900/10 text-amber-300'
                                  : 'border-red-800/40 bg-red-900/10 text-red-300'
                              }`}
                            >
                              <span>{text}</span>
                              <span className="text-xs opacity-60">{uncertain ? 'possible' : 'present'}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* RAW TEXT */}
                {activeTab === 'RAW_TEXT' && (
                  <pre className="rounded-lg border border-slate-800 bg-[#0f1117] p-4 text-xs text-slate-400 overflow-auto max-h-[500px] whitespace-pre-wrap leading-relaxed">
                    {selectedDoc.extractionResult?.rawText ?? 'No text extracted.'}
                  </pre>
                )}
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <Stethoscope className="w-8 h-8 mb-3 text-slate-700" />
              <p className="text-sm font-medium text-slate-400">No record selected</p>
              <p className="text-xs mt-1">Select a document from the queue to view clinical details.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
