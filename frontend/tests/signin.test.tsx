import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SignInPage } from '../src/pages/SignInPage';
import { ApiError } from '../src/services/apiClient';
import { useAuthStore } from '../src/stores/authStore';

describe('SignInPage', () => {
  it('shows the server error message when credentials are wrong', async () => {
    useAuthStore.setState({
      signin: vi.fn().mockRejectedValue(new ApiError(401, 'invalid_credentials', 'Wrong email or password')),
    } as never);

    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Wrong email or password'));
  });

  it('shows a retry hint on 429', async () => {
    useAuthStore.setState({
      signin: vi.fn().mockRejectedValue(new ApiError(429, 'rate_limited', 'x', 42)),
    } as never);

    render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many attempts, try again in 42 seconds'));
  });
});
