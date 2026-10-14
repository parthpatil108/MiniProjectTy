import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './design-system/Toast';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DrivesPage } from './pages/DrivesPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { RankingsPage } from './pages/RankingsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AdminPage } from './pages/AdminPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Skeleton } from './design-system/Skeleton';

// Export legacy types for backward compatibility
export type Role = 'Student' | 'Faculty_TPO' | 'Placement_Admin';
export type View = 'Dashboard' | 'Applications' | 'Drives' | 'Rankings' | 'Analytics' | 'Reports' | 'Profile' | 'AdminActions';
export type Application = {
  id: string;
  name: string;
  role: string;
  status: string;
  cgpa: string;
  branch: string;
  score: string;
  queuePosition: number;
  rank: number;
  update: string;
};
export type PlacementDrive = {
  id: string;
  company: string;
  role: string;
  package: string;
  branches: string[];
  deadline: string;
  slots: number;
  minimumCgpa: number;
  status: string;
  backlogs: string;
  skills: string[];
  applied: boolean;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-app)' }}>
        <Skeleton width="180px" height="24px" />
      </div>
    );
  }


  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function RoleRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="drives" element={<DrivesPage />} />
                  <Route path="applications" element={<ApplicationsPage />} />
                  <Route path="rankings" element={<RankingsPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route
                    path="admin"
                    element={
                      <RoleRoute allowedRoles={['Placement_Admin']}>
                        <AdminPage />
                      </RoleRoute>
                    }
                  />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
