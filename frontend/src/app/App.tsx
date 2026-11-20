import { BrowserRouter, Route } from 'react-router-dom';

import { ProtectedRoute } from '../components/ProtectedRoute';
import { RouteStage } from '../components/RouteStage';
import { LandingPage } from '../pages/LandingPage';
import { SignInPage } from '../pages/SignInPage';
import { SignUpPage } from '../pages/SignUpPage';
import { TalkPage } from '../pages/TalkPage';

export function App() {
  return (
    <BrowserRouter>
      <RouteStage>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route
          path="/talk"
          element={
            <ProtectedRoute>
              <TalkPage />
            </ProtectedRoute>
          }
        />
      </RouteStage>
    </BrowserRouter>
  );
}
