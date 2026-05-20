import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, LogIn, LayoutDashboard, User, AlertCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, userData, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
              <GraduationCap size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              등급컷<span className="text-indigo-600">.com</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {/* Desktop navigation can be added here */}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-4">
                <Link 
                  to="/settings"
                  className="hidden sm:flex flex-col items-end group hover:opacity-80 transition-opacity"
                >
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    {userData?.studentId || '사용자'} 
                    <User size={12} className="text-indigo-600" />
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">{userData?.name || '정보 없음'}</span>
                </Link>
                <button
                  onClick={() => logout()}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-slate-100 px-6 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-200"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex h-10 items-center justify-center rounded-full bg-indigo-600 px-6 text-sm font-medium text-white shadow transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-700"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-900">
              등급컷<span className="text-indigo-600">.com</span>
            </span>
          </div>
          <p className="text-sm text-slate-500 text-center md:text-left">
            © 2026 등급컷.com. 모든 예상 데이터는 표본 기반 추정치입니다.
          </p>
          <div className="flex gap-6 items-center">
            <Link to="/admin" className="text-sm text-slate-600 font-medium hover:text-indigo-600">사이트 관리</Link>
            <a href="#" className="text-sm text-slate-400 hover:text-slate-600">이용약관</a>
            <a href="#" className="text-sm text-slate-400 hover:text-slate-600">개인정보</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
