/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import ExamList from './pages/ExamList';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ExamService, SubmissionService } from './services/dataService';

// Synchronous viewport scroll restoration component on route changes
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Reset instantly
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    const forceScroll = () => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };

    // Execute across next paints to prevent race conditions during DOM transition height adjustments
    const rId1 = requestAnimationFrame(forceScroll);
    const rId2 = requestAnimationFrame(() => requestAnimationFrame(forceScroll));
    const tId = setTimeout(forceScroll, 60);

    return () => {
      cancelAnimationFrame(rId1);
      cancelAnimationFrame(rId2);
      clearTimeout(tId);
    };
  }, [pathname]);
  return null;
}

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
  // Silent high-performance background warming flow
  useEffect(() => {
    try {
      ExamService.getExams().then(() => {
        const warmExams = ['exam-speech-lang', 'exam-algebra', 'exam-english1', 'exam-physics'];
        warmExams.forEach(examId => {
          SubmissionService.getAllSubmissions(examId).catch(() => {});
        });
      }).catch(() => {});
    } catch (e) {}
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
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


