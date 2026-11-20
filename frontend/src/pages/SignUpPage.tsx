import { Link, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';
import { AuthForm } from './AuthForm';

export function SignUpPage() {
  const signup = useAuthStore((s) => s.signup);
  const testerLogin = useAuthStore((s) => s.testerLogin);
  const navigate = useNavigate();
  return (
    <AuthForm
      route="/signup"
      title="Sign Up"
      submitLabel="Sign up"
      showName
      onSubmit={(email, password, name) => signup(email, password, name)}
      onDone={() => navigate('/talk')}
      onTester={testerLogin}
      footer={<>Already have an account? <Link to="/signin">Sign in</Link></>}
    />
  );
}
