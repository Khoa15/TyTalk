import { Link } from 'react-router-dom';

import { TyTalkOrb } from '../components/orb/TyTalkOrb';

export function LandingPage() {
  return (
    <main className="landing">
      <div className="landing-hero">
        <TyTalkOrb state="cute" size={260} aria-label="Orb" />
        <h1>TyTalk</h1>
        <p>Trò chuyện với Orb, một người bạn ghi nhớ tính cách của bạn. Không lưu hội thoại.</p>
        <div className="cta">
          <Link className="button-primary" to="/signup">Bắt đầu</Link>
          <Link className="button-ghost" to="/signin">Đăng nhập</Link>
        </div>
      </div>
    </main>
  );
}
