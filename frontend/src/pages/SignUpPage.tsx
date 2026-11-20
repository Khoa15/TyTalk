import { Link, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';
import { AuthForm } from './AuthForm';

export function SignUpPage() {
  const signup = useAuthStore((s) => s.signup);
  const navigate = useNavigate();
  return (
    <AuthForm
      title="Tạo tài khoản"
      submitLabel="Đăng ký"
      showName
      onSubmit={(email, password, name) => signup(email, password, name)}
      onDone={() => navigate('/talk')}
      footer={<>Đã có tài khoản? <Link to="/signin">Đăng nhập</Link></>}
    />
  );
}
