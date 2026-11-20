import { Link, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';
import { AuthForm } from './AuthForm';

export function SignInPage() {
  const signin = useAuthStore((s) => s.signin);
  const navigate = useNavigate();
  return (
    <AuthForm
      title="Đăng nhập"
      submitLabel="Đăng nhập"
      showName={false}
      onSubmit={(email, password) => signin(email, password)}
      onDone={() => navigate('/talk')}
      footer={<>Chưa có tài khoản? <Link to="/signup">Đăng ký</Link></>}
    />
  );
}
