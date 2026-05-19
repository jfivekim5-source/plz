/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import ExamList from './pages/ExamList';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, userData, loading } = useAuth();
  
  if (loading) return <div className="p-12 text-center text-slate-400">로딩 중...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
};

import ExamInput from './pages/ExamInput';

import Results from './pages/Results';



import Admin from './pages/Admin';
import Settings from './pages/Settings';
import Reviews from './pages/Reviews';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/exams" element={<ExamList />} />
            <Route path="/exams/:examId" element={<ExamInput />} />
            <Route path="/results" element={<Results />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/settings" element={<Settings />} />
            
            <Route path="/admin" element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}


