import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ChatLog } from '../components/ChatLog';
import { TyTalkOrb } from '../components/orb/TyTalkOrb';
import { TalkInput } from '../components/TalkInput';
import { useAuthStore } from '../stores/authStore';
import { useTalkStore } from '../stores/talkStore';

export function TalkPage() {
  const orbState = useTalkStore((s) => s.orbState);
  const busy = useTalkStore((s) => s.busy);
  const error = useTalkStore((s) => s.error);
  const speakEnabled = useTalkStore((s) => s.speakEnabled);
  const lines = useTalkStore((s) => s.lines);
  const interim = useTalkStore((s) => s.interim);
  const listening = useTalkStore((s) => s.listening);
  const send = useTalkStore((s) => s.send);
  const toggleSpeak = useTalkStore((s) => s.toggleSpeak);
  const startListening = useTalkStore((s) => s.startListening);
  const stopListening = useTalkStore((s) => s.stopListening);
  const signout = useAuthStore((s) => s.signout);
  const traits = useAuthStore((s) => s.user?.traits);
  // Users whose learned traits show humour or a warm tone get a more expressive idle Orb.
  const expressiveness = traits && (traits.humor || traits.tone) ? 0.9 : 0.5;
  const loadMe = useAuthStore((s) => s.loadMe);
  const navigate = useNavigate();

  useEffect(() => {
    loadMe().catch(() => undefined);
  }, [loadMe]);

  const onSignout = async () => {
    await signout();
    navigate('/signin');
  };

  const onToggleMic = () => {
    if (listening) stopListening();
    else startListening();
  };

  return (
    <main className="talk-page">
      <div className="talk-top">
        <button className="chip" onClick={toggleSpeak} aria-pressed={speakEnabled}>
          {speakEnabled ? 'Tắt giọng' : 'Bật giọng'}
        </button>
        <button className="chip" onClick={onSignout}>Đăng xuất</button>
      </div>

      <div className="stage">
        <TyTalkOrb state={orbState} size={300} expressiveness={expressiveness} aria-label="Nhân vật Orb" />
      </div>

      <div className="talk-dock">
        <ChatLog lines={lines} busy={busy} listening={listening} interim={interim} />
        {error && <p role="alert" className="error">{error}</p>}
        <TalkInput
          disabled={busy}
          listening={listening}
          onSend={(text) => void send(text)}
          onToggleMic={onToggleMic}
        />
      </div>
    </main>
  );
}
