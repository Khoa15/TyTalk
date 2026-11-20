import { Link, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';
import { AuthForm } from './AuthForm';

export function SignInPage() {
  const signin = useAuthStore((s) => s.signin);
  const testerLogin = useAuthStore((s) => s.testerLogin);
  const navigate = useNavigate();
  return (
    <AuthForm
      route="/signin"
      title="Sign In"
      submitLabel="Sign in"
      showName={false}
      onSubmit={(email, password) => signin(email, password)}
      onDone={() => navigate('/talk')}
      onTester={testerLogin}
      footer={<>No account yet? <Link to="/signup">Sign up</Link></>}
    />
  );
}
