import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthView } from './components/AuthView';
import { TriageDashboard } from './components/TriageDashboard';
import { UploadModal } from './components/UploadModal';
import { StatAlertBanner } from './components/StatAlertBanner';
import { authApi, documentsApi } from './services/api';
import { initWebSocket, disconnectWebSocket, updateWebSocketToken } from './services/socket';
import { playEmergencyTone } from './utils/audio';
import { DocumentItem, User, StatAlertPayload } from './types';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('accessToken') || localStorage.getItem('token')
  );
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [statAlert, setStatAlert] = useState<StatAlertPayload | null>(null);
  const [audioMuted, setAudioMuted] = useState<boolean>(() => {
    return localStorage.getItem('doctriage_audio_muted') === 'true';
  });
  const audioMutedRef = useRef(audioMuted);
  useEffect(() => {
    audioMutedRef.current = audioMuted;
  }, [audioMuted]);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // Fetch documents list
  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const docs = await documentsApi.getAll();
      setDocuments(docs);
      // Automatically select top STAT or first document if none selected
      setSelectedDocId((prev) => {
        if (prev && docs.some((d) => d.id === prev)) return prev;
        const topStat = docs.find((d) => d.urgency === 'STAT');
        return topStat ? topStat.id : docs[0]?.id || null;
      });
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Auth success handler
  const handleAuthSuccess = (accessToken: string, authenticatedUser: User) => {
    setToken(accessToken);
    setUser(authenticatedUser);
    fetchDocuments();
  };

  // Logout handler
  const handleLogout = async () => {
    await authApi.logout();
    disconnectWebSocket();
    setToken(null);
    setUser(null);
    setDocuments([]);
    setSelectedDocId(null);
    setStatAlert(null);
  };

  // Toggle emergency buzzer
  const handleToggleAudio = () => {
    setAudioMuted((prev) => {
      const next = !prev;
      localStorage.setItem('doctriage_audio_muted', String(next));
      return next;
    });
  };

  // Initialize user profile & WebSocket
  useEffect(() => {
    if (!token) return;

    // Fetch profile
    authApi
      .getProfile()
      .then((profile) => setUser(profile))
      .catch((err) => {
        console.warn('Could not fetch user profile:', err);
      });

    // Initial documents load
    fetchDocuments();

    // Init WebSocket connection
    const socket = initWebSocket(
      token,
      (_queueData) => {
        // queue_updated broadcast received
        fetchDocuments();
      },
      (alertData: StatAlertPayload) => {
        // stat_alert_received broadcast
        setStatAlert(alertData);
        if (!audioMutedRef.current) {
          playEmergencyTone();
        }
        if (alertData.document?.id) {
          setSelectedDocId(alertData.document.id);
        }
        fetchDocuments();
      }
    );

    socket.on('connect', () => setWsConnected(true));
    socket.on('disconnect', () => setWsConnected(false));
    socket.on('connect_error', () => setWsConnected(false));

    // Handle token expiration/revocation events
    const onSessionExpired = () => {
      handleLogout();
    };

    const onTokenRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent<{ token: string }>;
      if (customEvent.detail?.token) {
        setToken(customEvent.detail.token);
        updateWebSocketToken(customEvent.detail.token);
      }
    };

    window.addEventListener('auth:session_expired', onSessionExpired);
    window.addEventListener('auth:logout', onSessionExpired);
    window.addEventListener('auth:token_refreshed', onTokenRefreshed);

    return () => {
      window.removeEventListener('auth:session_expired', onSessionExpired);
      window.removeEventListener('auth:logout', onSessionExpired);
      window.removeEventListener('auth:token_refreshed', onTokenRefreshed);
      disconnectWebSocket();
    };
  }, [token, fetchDocuments]);

  // If unauthenticated, show Auth workstation
  if (!token) {
    return <AuthView onSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col">
      {/* Real-time STAT Alert Siren Banner */}
      <StatAlertBanner
        alert={statAlert}
        onDismiss={() => setStatAlert(null)}
        audioMuted={audioMuted}
        onToggleAudio={handleToggleAudio}
      />

      {/* Main Clinical Triage Workstation */}
      <TriageDashboard
        user={user}
        documents={documents}
        loading={loading}
        onRefresh={fetchDocuments}
        onOpenUpload={() => setIsUploadOpen(true)}
        onLogout={handleLogout}
        wsConnected={wsConnected}
        selectedDocId={selectedDocId}
        onSelectDoc={(id) => setSelectedDocId(id)}
      />

      {/* Document Ingestion Gateway Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => {
          fetchDocuments();
        }}
      />
    </div>
  );
};

export default App;
