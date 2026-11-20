import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { ChatLog } from '../components/ChatLog';
import { OrbSlot } from '../components/OrbSlot';
import { SpaceLayer } from '../components/space/SpaceLayer';
import { TalkInput } from '../components/TalkInput';
import { useAuthStore } from '../stores/authStore';
import { useTalkStore } from '../stores/talkStore';

export function TalkPage() {
  const orbState = useTalkStore((s) => s.orbState);
  const entities = useTalkStore((s) => s.entities);
  const sim = useTalkStore((s) => s.sim);
  const orbForm = useTalkStore((s) => s.orbForm);
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
  const stageRef = useRef<HTMLDivElement>(null);

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
          {speakEnabled ? 'Mute voice' : 'Unmute voice'}
        </button>
        <button className="chip" onClick={onSignout}>Sign out</button>
      </div>

      <div className="stage" ref={stageRef}>
        <SpaceLayer entities={entities} sim={sim} anchorRef={stageRef} />
        <OrbSlot route="/talk" size={300} state={orbState} form={orbForm} expressiveness={expressiveness} />
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
