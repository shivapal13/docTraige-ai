import React from 'react';
import { X, AlertOctagon, Volume2, VolumeX } from 'lucide-react';
import { StatAlertPayload } from '../types';

interface StatAlertBannerProps {
  alert: StatAlertPayload | null;
  onDismiss: () => void;
  audioMuted: boolean;
  onToggleAudio: () => void;
}

export const StatAlertBanner: React.FC<StatAlertBannerProps> = ({
  alert,
  onDismiss,
  audioMuted,
  onToggleAudio,
}) => {
  if (!alert) return null;

  return (
    <div className="bg-red-700 text-white px-4 py-2.5 flex items-center justify-between gap-4 text-sm sticky top-0 z-40">
      <div className="flex items-center gap-3 min-w-0">
        <AlertOctagon className="w-4 h-4 shrink-0" />
        <span className="font-semibold shrink-0">STAT Alert</span>
        <span className="text-red-200 truncate">
          {alert.document.patientName || 'Unknown patient'} · MRN {alert.document.mrn || 'N/A'} ·{' '}
          {alert.document.filename}
        </span>
        {alert.document.matchedRules && alert.document.matchedRules.length > 0 && (
          <span className="hidden lg:inline text-red-200 shrink-0">
            — {alert.document.matchedRules.map((r) => `${r.testName} ${r.foundValue}`).join(', ')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleAudio}
          className="p-1 rounded hover:bg-red-600 transition"
          title={audioMuted ? 'Unmute' : 'Mute'}
        >
          {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={onDismiss}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition"
        >
          Acknowledge
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
