import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { getRuntimeProfile } from "@/lib/runtimeProfile";
import { Capacitor } from '@capacitor/core';
import Index from "./pages/Index";
import Login from "./pages/Login";
import ProjectSettings from "./pages/ProjectSettings";
import Reports from "./pages/Reports";
import PeopleManagement from "./pages/PeopleManagement";
import Admin from "./pages/Admin";
import CompanyPortal from "./pages/CompanyPortal";
import UserRegistration from "./pages/UserRegistration";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Visitors from "./pages/Visitors";
import { ProtectedRoute } from "./components/ProtectedRoute";

const AccessControl = React.lazy(() => import('./pages/AccessControl'));
const AccessControlLogin = React.lazy(() => import('./pages/access-control/AccessControlLogin'));
const AccessControlConfig = React.lazy(() => import('./pages/access-control/AccessControlConfig'));

import { MainLayout } from "./components/layouts/MainLayout";
import { AuthProvider } from "@/contexts/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedPage = ({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string | string[] }) => (
  <ProtectedRoute requiredRole={requiredRole}>
    <MainLayout>{children}</MainLayout>
  </ProtectedRoute>
);

const SuspenseFallback = () => (
  <div className="flex items-center justify-center min-h-screen">Carregando...</div>
);

const isNative = Capacitor.isNativePlatform();

const NativeRoutes = () => (
  <Routes>
    <Route path="/access-control/login" element={<React.Suspense fallback={<SuspenseFallback />}><AccessControlLogin /></React.Suspense>} />
    <Route path="/access-control/config" element={
      <ProtectedRoute requiredRole={['admin', 'operator']}>
        <React.Suspense fallback={<SuspenseFallback />}><AccessControlConfig /></React.Suspense>
      </ProtectedRoute>
    } />
    <Route path="/access-control" element={
      <ProtectedRoute requiredRole={['admin', 'operator']}>
        <React.Suspense fallback={<SuspenseFallback />}><AccessControl /></React.Suspense>
      </ProtectedRoute>
    } />
    <Route path="*" element={<Navigate to="/access-control/login" replace />} />
  </Routes>
);

const WebRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/cadastro" element={<UserRegistration />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/" element={<ProtectedPage><Index /></ProtectedPage>} />
    <Route path="/reports" element={<ProtectedPage><Reports /></ProtectedPage>} />
    <Route path="/people/*" element={<ProtectedPage><PeopleManagement /></ProtectedPage>} />
    <Route path="/admin/*" element={<ProtectedPage requiredRole="admin"><Admin /></ProtectedPage>} />
    <Route path="/company-portal/*" element={<ProtectedPage><CompanyPortal /></ProtectedPage>} />
    <Route path="/settings" element={<ProtectedPage requiredRole="admin"><ProjectSettings /></ProtectedPage>} />
    <Route path="/visitors" element={<ProtectedPage><Visitors /></ProtectedPage>} />
    {/* Access control standalone routes (no MainLayout) */}
    <Route path="/access-control/login" element={<React.Suspense fallback={<SuspenseFallback />}><AccessControlLogin /></React.Suspense>} />
    <Route path="/access-control/config" element={
      <ProtectedRoute requiredRole={['admin', 'operator']}>
        <React.Suspense fallback={<SuspenseFallback />}><AccessControlConfig /></React.Suspense>
      </ProtectedRoute>
    } />
    <Route path="/access-control" element={
      <ProtectedRoute requiredRole={['admin', 'operator']}>
        <React.Suspense fallback={<SuspenseFallback />}><AccessControl /></React.Suspense>
      </ProtectedRoute>
    } />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => {
  const isDesktop = getRuntimeProfile().isDesktop || window.location.protocol === 'file:';
  const Router = isDesktop ? HashRouter : BrowserRouter;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Router>
            <AuthProvider>
              {isNative ? <NativeRoutes /> : <WebRoutes />}
            </AuthProvider>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
