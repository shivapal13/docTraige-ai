import React, { useState, useRef } from 'react';
import { authApi } from '../services/api';
import {
  Lock,
  Mail,
  User as UserIcon,
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  Stethoscope,
  Activity,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Sparkles,
  Clock,
  FileText,
  AlertTriangle,
  AlertOctagon,
  HeartPulse,
  Database,
  Cpu,
  Layers,
  KeyRound,
} from 'lucide-react';
import { User } from '../types';

interface AuthViewProps {
  onSuccess: (token: string, user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [hasJoinCode, setHasJoinCode] = useState(false);
  const [facilityValue, setFacilityValue] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const authCardRef = useRef<HTMLDivElement>(null);

  const scrollToAuth = (signupMode: boolean = false) => {
    setIsSignUp(signupMode);
    authCardRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        const trimmed = facilityValue.trim();
        const isCode = hasJoinCode || trimmed.toUpperCase().startsWith('FAC-');
        const res = await authApi.signUp(
          email,
          password,
          name,
          'DOCTOR',
          !isCode ? trimmed || undefined : undefined,
          isCode ? trimmed.toUpperCase() || undefined : undefined,
        );
        onSuccess(res.accessToken, res.user);
      } else {
        const res = await authApi.login(email, password);
        onSuccess(res.accessToken, res.user);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Authentication failed';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setIsSignUp(false);
    setEmail('doctor@metrohealth.org');
    setPassword('Clinician123!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#090c15] text-slate-100 flex flex-col selection:bg-red-500 selection:text-white font-sans relative">
      {/* Background Subtle Gradient & Grid Accents */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-red-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="fixed top-1/2 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* ── Sticky Top Header & Navigation ── */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0b0e19]/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/20">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-white">DocTriage AI</span>
            <span className="text-slate-600">/</span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Autonomous Clinical Triage</span>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <a href="#the-need" className="hover:text-slate-200 transition">The Need</a>
          <a href="#how-it-works" className="hover:text-slate-200 transition">How It Works</a>
          <a href="#features" className="hover:text-slate-200 transition">Features</a>
          <a href="#panic-matrix" className="hover:text-slate-200 transition">Clinical Protocols</a>
        </nav>

        {/* Right Nav Actions */}
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={fillDemoCredentials}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 font-medium transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Fill Demo</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToAuth(false)}
            className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold shadow-sm transition"
          >
            Access Workstation
          </button>
        </div>
      </header>

      {/* ── Section 1: Hero & Split Auth Card ── */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-10 py-10 lg:py-14 border-b border-slate-800/50">
        <div className="max-w-6xl w-full mx-auto grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Focused Hero & Live Signal */}
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>Real-Time Clinical Decision Support</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.15]">
                Critical clinical decisions in <span className="text-red-500">seconds</span>, not hours.
              </h1>
              <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
                DocTriage AI ingests inbound clinical reports, normalizes lab metrics, and intercepts life-threatening panic ranges for immediate attending review.
              </p>
            </div>

            {/* Sleek Live Intercept Signal */}
            <div className="p-4 rounded-xl bg-[#101420]/80 border border-slate-800/80 shadow-lg space-y-2.5 max-w-lg">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 stat-dot" />
                  <span className="font-semibold text-red-400 tracking-wide text-[11px] uppercase">STAT Emergency Intercepted</span>
                </div>
                <span className="text-slate-500 font-mono text-[10px]">Latency: 140ms</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                  <div className="text-[10px] text-slate-500 font-medium">PATIENT / MRN</div>
                  <div className="font-semibold text-slate-200 truncate mt-0.5">J. Doe, 58M</div>
                  <div className="text-[10px] text-slate-400 font-mono">MRN: 8942-01</div>
                </div>

                <div className="p-2 rounded-lg bg-red-950/20 border border-red-900/40">
                  <div className="text-[10px] text-red-400 font-medium">PANIC TRIGGER</div>
                  <div className="font-bold text-red-300 mt-0.5">Troponin I</div>
                  <div className="text-[10px] text-amber-300 font-mono">2.84 ng/mL (&gt;0.04)</div>
                </div>

                <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                  <div className="text-[10px] text-slate-500 font-medium">PROTOCOL ACTION</div>
                  <div className="font-semibold text-slate-200 mt-0.5">AHA Code Alert</div>
                  <div className="text-[10px] text-emerald-400">Attending Dispatched</div>
                </div>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Multi-Tenant Hospital Isolation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Automated Intake</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>AHA / ACC Rule Engine</span>
              </div>
            </div>
          </div>

          {/* Right Column: Clean, Elegant Auth Card */}
          <div ref={authCardRef} className="lg:col-span-5 w-full max-w-md mx-auto scroll-mt-20">
            <div className="bg-[#111522]/90 rounded-2xl border border-slate-800/80 p-6 sm:p-7 shadow-2xl shadow-black/60 backdrop-blur-xl">
              {/* Sleek Segmented Switcher */}
              <div className="grid grid-cols-2 p-1 bg-[#090c15] rounded-xl border border-slate-800/80 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition ${
                    !isSignUp
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Clinician Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition ${
                    isSignUp
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Register Facility
                </button>
              </div>

              {/* Title & Subtitle */}
              <div className="mb-4">
                <h2 className="text-base font-semibold text-white tracking-tight">
                  {isSignUp ? 'Create facility & staff account' : 'Welcome to your workstation'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {isSignUp
                    ? 'Enter your facility details to initialize an isolated triage workspace.'
                    : 'Enter your credentials to access the live triage queue.'}
                </p>
              </div>

              {/* Error Alert Box */}
              {error && (
                <div className="mb-4 flex items-start gap-2.5 text-xs text-red-300 bg-red-950/40 border border-red-800/60 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form Inputs */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {isSignUp && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Staff Full Name</label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Dr. Elena Vance"
                        className="w-full bg-[#0a0d16] border border-slate-700/80 rounded-xl px-3 py-2 pl-9 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40 transition"
                      />
                    </div>
                  </div>
                )}

                {isSignUp && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-medium text-slate-300">
                        {hasJoinCode ? 'Facility Join Code' : 'Hospital / Clinic Name'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setHasJoinCode(!hasJoinCode);
                          setFacilityValue('');
                          setError(null);
                        }}
                        className="text-[11px] text-red-400 hover:text-red-300 font-medium transition"
                      >
                        {hasJoinCode ? 'Register new hospital?' : 'Have a join code?'}
                      </button>
                    </div>
                    <div className="relative">
                      {hasJoinCode ? (
                        <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
                      ) : (
                        <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      )}
                      <input
                        type="text"
                        required
                        value={facilityValue}
                        onChange={(e) => setFacilityValue(hasJoinCode ? e.target.value.toUpperCase() : e.target.value)}
                        placeholder={hasJoinCode ? 'FAC-XXXXXX' : 'e.g. Metro Health Hospital'}
                        className={`w-full bg-[#0a0d16] border border-slate-700/80 rounded-xl px-3 py-2 pl-9 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40 transition ${
                          hasJoinCode ? 'font-mono uppercase tracking-wider' : ''
                        }`}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Hospital Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="doctor@hospital.org"
                      className="w-full bg-[#0a0d16] border border-slate-700/80 rounded-xl px-3 py-2 pl-9 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40 transition"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#0a0d16] border border-slate-700/80 rounded-xl px-3 py-2 pl-9 pr-9 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{isSignUp ? 'Creating Account…' : 'Accessing…'}</span>
                    </>
                  ) : (
                    <>
                      <span>{isSignUp ? 'Register Facility & Account' : 'Access Workstation'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Quick Switch Note */}
              <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {isSignUp ? 'Already registered?' : 'Need to register facility?'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                  }}
                  className="text-red-400 hover:text-red-300 font-medium transition"
                >
                  {isSignUp ? 'Sign In' : 'Register'}
                </button>
              </div>

              {!isSignUp && (
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={fillDemoCredentials}
                    className="text-[11px] text-slate-500 hover:text-slate-300 transition inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400/80" />
                    <span>Autofill test clinician credentials</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: The Need (Why DocTriage AI Exists) ── */}
      <section id="the-need" className="relative z-10 px-4 sm:px-6 lg:px-10 py-16 lg:py-20 border-b border-slate-800/50 bg-[#0c101c]/60">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-3">
              <Clock className="w-3.5 h-3.5" />
              <span>The Clinical Urgency Crisis</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Why critical emergency lab results are delayed in modern hospitals.
            </h2>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              In high-volume emergency departments and inpatient wards, critical findings often sit unreviewed inside unread PDF attachments, scanned faxes, or crowded EHR inboxes for 45 to 120 minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-[#111624] border border-slate-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">Unstructured Inbound Flood</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                External clinics and laboratories transmit results as scanned image PDFs, paper faxes, and free-text notes that standard EHR alert engines cannot parse without manual human data entry.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#111624] border border-slate-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <HeartPulse className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">Alert Fatigue & Missed STATs</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Clinicians are flooded with hundreds of routine inbox notifications every shift. When a life-threatening Troponin elevation or severe potassium crash arrives, it blends into routine noise.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#111624] border border-slate-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">DocTriage AI Autonomous Action</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                DocTriage AI automatically parses the document within milliseconds, normalizes values against AHA/ACC panic ranges, and triggers an immediate audio-visual STAT alert to the attending physician.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: How It Works (The 4-Step Pipeline) ── */}
      <section id="how-it-works" className="relative z-10 px-4 sm:px-6 lg:px-10 py-16 lg:py-20 border-b border-slate-800/50">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              <Cpu className="w-3.5 h-3.5" />
              <span>The Autonomous Architecture</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              From document intake to attending dispatch in four steps.
            </h2>
            <p className="text-sm text-slate-400">
              A high-reliability asynchronous pipeline orchestrating PyMuPDF, Tesseract OCR, clinical NLP, and BullMQ queue processing.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Step 1 */}
            <div className="p-5 rounded-2xl bg-[#121622] border border-slate-800/80 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span className="font-mono font-bold text-red-400">STEP 01</span>
                  <span>INGESTION</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-red-400 mb-3">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-white">Universal Document Intake</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Accepts PDF, DOCX, scanned TIFF, TXT, or images up to 20MB. Scoped immediately to your hospital tenant.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-500">
                BullMQ Redis Queue
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-2xl bg-[#121622] border border-slate-800/80 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span className="font-mono font-bold text-red-400">STEP 02</span>
                  <span>OPTICAL & NLP</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 mb-3">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-white">Dual-Pass Hybrid Parsing</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Extracts native digital text first; selectively falls back to optical OCR. Boundary-aware regex parses lab panels and decimal values.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-500">
                PyMuPDF + Tesseract
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-2xl bg-[#121622] border border-slate-800/80 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span className="font-mono font-bold text-red-400">STEP 03</span>
                  <span>DECISION ENGINE</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 mb-3">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-white">Panic Rule Evaluation</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Evaluates normalized values against AHA/ACC clinical thresholds. Distinguishes confirmed findings from &quot;rule out&quot; notation.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-500">
                AHA / ACC / SBR Rules
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-5 rounded-2xl bg-[#121622] border border-slate-800/80 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <span className="font-mono font-bold text-red-400">STEP 04</span>
                  <span>DISPATCH</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-red-500 mb-3">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-white">Real-Time STAT Siren</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Pushes an instant audio-visual siren banner to connected clinicians with patient MRN, violated thresholds, and telemetry.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-500">
                Web Audio &amp; Real-Time Push
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Features Grid ── */}
      <section id="features" className="relative z-10 px-4 sm:px-6 lg:px-10 py-16 lg:py-20 border-b border-slate-800/50 bg-[#0c101c]/60">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Built for High-Stress Emergency Workflows</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Clinical capabilities designed specifically for attending doctors and triage nurses.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#111624] border border-slate-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center">
                <AlertOctagon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Real-Time Emergency STAT Siren</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                When a critical troponin elevation or severe electrolyte crash is detected, connected clinicians receive an audible Web Audio dual-tone alarm with instant patient telemetry.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#111624] border border-slate-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Dedicated Hospital Workspace Isolation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every hospital or healthcare facility has its own private partition. Patient queues, reports, and real-time alerts are strictly isolated between institutions.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#111624] border border-slate-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Stethoscope className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Linguistic Negation &amp; Uncertainty</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Distinguishes between actual acute diagnoses (&quot;confirmed intracranial hemorrhage&quot;) and negations (&quot;no evidence of intracranial hemorrhage&quot; or &quot;rule out hemorrhage&quot;).
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#111624] border border-slate-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Universal Format Ingestion</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Supports clinical lab PDFs, multi-frame scanned TIFF faxes, DOCX referral letters with embedded tables, and high-resolution JPEG/PNG intake up to 20MB.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#111624] border border-slate-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">Unit Normalization &amp; Decimal Safety</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automatically converts differing lab unit reporting (ng/mL vs pg/mL for cardiac markers) and safely parses comma and period decimals without breaking sentence boundaries.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#111624] border border-slate-800 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-slate-700/40 text-slate-300 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">High-Density Clinical Workstation UI</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Split-pane workstation layout pairing a live queue on the left with detailed clinical dossier views (demographics, panic rules, lab grids, raw OCR text) on the right.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: Clinical Panic Ranges Matrix ── */}
      <section id="panic-matrix" className="relative z-10 px-4 sm:px-6 lg:px-10 py-16 lg:py-20 border-b border-slate-800/50">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium mb-3">
              <HeartPulse className="w-3.5 h-3.5" />
              <span>AHA / ACC / SBR Clinical Rules Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Critical emergency panic thresholds evaluated in real time.
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Standardized hospital panic-range thresholds programmed directly into the automated decision engine:
            </p>
          </div>

          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-[#121622]/90 shadow-xl">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#0b0e18] border-b border-slate-800 text-[11px] text-slate-400 uppercase font-mono">
                <tr>
                  <th className="py-3 px-5">Clinical Panel</th>
                  <th className="py-3 px-5">Target Biomarker</th>
                  <th className="py-3 px-5">Emergency Panic Range</th>
                  <th className="py-3 px-5">Urgency Tier</th>
                  <th className="py-3 px-5">Clinical Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono text-xs">
                <tr className="hover:bg-[#151a29] transition">
                  <td className="py-3 px-5 font-sans font-semibold text-slate-200">Cardiology</td>
                  <td className="py-3 px-5 text-red-400 font-bold">Troponin I / T</td>
                  <td className="py-3 px-5 text-amber-300 font-semibold">&gt; 0.04 ng/mL (&gt;40 pg/mL)</td>
                  <td className="py-3 px-5">
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold">
                      STAT
                    </span>
                  </td>
                  <td className="py-3 px-5 font-sans text-slate-400 text-[11px]">Acute Myocardial Infarction / STEMI Alert</td>
                </tr>

                <tr className="hover:bg-[#151a29] transition">
                  <td className="py-3 px-5 font-sans font-semibold text-slate-200">Electrolytes</td>
                  <td className="py-3 px-5 text-red-400 font-bold">Potassium (K+)</td>
                  <td className="py-3 px-5 text-amber-300 font-semibold">&lt; 2.8 or &gt; 6.2 mmol/L</td>
                  <td className="py-3 px-5">
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold">
                      STAT
                    </span>
                  </td>
                  <td className="py-3 px-5 font-sans text-slate-400 text-[11px]">Lethal Cardiac Dysrhythmia / Asystole Risk</td>
                </tr>

                <tr className="hover:bg-[#151a29] transition">
                  <td className="py-3 px-5 font-sans font-semibold text-slate-200">Hematology</td>
                  <td className="py-3 px-5 text-red-400 font-bold">Platelet Count</td>
                  <td className="py-3 px-5 text-amber-300 font-semibold">&lt; 20,000 / &mu;L</td>
                  <td className="py-3 px-5">
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold">
                      STAT
                    </span>
                  </td>
                  <td className="py-3 px-5 font-sans text-slate-400 text-[11px]">Spontaneous Intracranial Bleed Risk</td>
                </tr>

                <tr className="hover:bg-[#151a29] transition">
                  <td className="py-3 px-5 font-sans font-semibold text-slate-200">Metabolic</td>
                  <td className="py-3 px-5 text-amber-400 font-bold">Blood Glucose</td>
                  <td className="py-3 px-5 text-amber-300 font-semibold">&lt; 40 or &gt; 450 mg/dL</td>
                  <td className="py-3 px-5">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                      URGENT
                    </span>
                  </td>
                  <td className="py-3 px-5 font-sans text-slate-400 text-[11px]">Severe Neuroglycopenia / DKA Coma Risk</td>
                </tr>

                <tr className="hover:bg-[#151a29] transition">
                  <td className="py-3 px-5 font-sans font-semibold text-slate-200">Renal</td>
                  <td className="py-3 px-5 text-amber-400 font-bold">Creatinine</td>
                  <td className="py-3 px-5 text-amber-300 font-semibold">&gt; 3.0 mg/dL (or &gt;2x baseline)</td>
                  <td className="py-3 px-5">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                      URGENT
                    </span>
                  </td>
                  <td className="py-3 px-5 font-sans text-slate-400 text-[11px]">Acute Kidney Injury (Stage 3 AKI)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Section 6: Hospital Call to Action ── */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-10 py-16 bg-[#090d18] border-b border-slate-800/50">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Equip your emergency department with autonomous red-flag triage.
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Eliminate triage blindspots. Ingest medical records instantly and receive automatic panic-range dispatch directly on clinician workstations.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => scrollToAuth(true)}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-lg shadow-red-600/20 transition flex items-center gap-2"
            >
              <span>Register Your Hospital Facility</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollToAuth(false)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition"
            >
              Clinician Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ── Section 7: Institutional Clinical Footer ── */}
      <footer className="relative z-10 border-t border-slate-800 px-6 lg:px-12 py-10 bg-[#070a12] text-xs text-slate-500 space-y-8">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-red-600 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-sm text-white">DocTriage AI</span>
            </div>
            <p className="text-slate-400 text-xs max-w-sm leading-relaxed">
              Autonomous clinical triage and emergency panic-range interceptor. Designed for emergency medicine teams, clinical laboratories, and acute care facilities.
            </p>
            <div className="text-[11px] text-slate-500">
              Clinical Decision Support Platform · AHA/ACC Aligned
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-slate-300 text-xs">Platform Architecture</div>
            <ul className="space-y-1.5 text-slate-400">
              <li><a href="#how-it-works" className="hover:text-slate-200">Universal Ingestion</a></li>
              <li><a href="#how-it-works" className="hover:text-slate-200">OCR &amp; NLP Parsing</a></li>
              <li><a href="#panic-matrix" className="hover:text-slate-200">Panic Range Matrix</a></li>
              <li><a href="#features" className="hover:text-slate-200">Dedicated Workspaces</a></li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-slate-300 text-xs">Clinical Protocols</div>
            <ul className="space-y-1.5 text-slate-400">
              <li>Cardiac (Troponin I/T)</li>
              <li>Electrolytes (K+, Na+)</li>
              <li>Hematology (Platelets)</li>
              <li>Metabolic (Glucose / DKA)</li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} DocTriage AI. All rights reserved. For clinical decision support under licensed healthcare supervision.
          </div>
          <div className="flex items-center gap-4">
            <span>Hospital Data Isolation</span>
            <span>•</span>
            <span>AHA/ACC Aligned</span>
            <span>•</span>
            <span>HIPAA Compliance Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
