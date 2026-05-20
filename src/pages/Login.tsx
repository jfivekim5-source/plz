import React, { useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, GraduationCap, ShieldCheck, Key, ArrowRight, User } from 'lucide-react';

export default function Login() {
  const { user, userData, loginWithID, loginWithCode, setupPassword, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [mode, setMode] = useState<'id' | 'code'>('id');
  
  // Form fields
  const [fieldId, setFieldId] = useState('');
  const [fieldPassword, setFieldPassword] = useState('');
  const [fieldCode, setFieldCode] = useState('');
  
  // Setup Password fields
  const [newPass1, setNewPass1] = useState('');
  const [newPass2, setNewPass2] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    try {
      if (mode === 'id') {
        await loginWithID(fieldId, fieldPassword);
      } else {
        await loginWithCode(fieldCode);
      }
    } catch (err: any) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass1 !== newPass2) {
      setError('비밀번호가 서로 일치하지 않습니다.');
      return;
    }
    if (newPass1.length < 4) {
      setError('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    setIsLoggingIn(true);
    setError(null);
    try {
      await setupPassword(newPass1);
    } catch (err: any) {
      setError(err.message || '비밀번호 설정 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) return null;

  // STEP: Password Setup (Required for first-time login, but only show EXACTLY ONCE)
  const promptKey = userData ? `password_prompt_seen_${userData.uid}` : '';
  const promptSeen = promptKey ? localStorage.getItem(promptKey) === 'true' : false;

  const handleSkipSetup = () => {
    if (promptKey) {
      localStorage.setItem(promptKey, 'true');
    }
    // Force redirect to Home
    window.location.href = '/';
  };

  if (user && userData && !userData.isProfileComplete && !promptSeen) {
    // Automatically flag as "seen" so next logins bypass this screen even if incomplete.
    if (promptKey) {
      localStorage.setItem(promptKey, 'true');
    }

    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white p-10 rounded-[48px] border border-slate-100 shadow-2xl shadow-indigo-100/50 space-y-10"
        >
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-indigo-600 rounded-[32px] flex items-center justify-center mx-auto shadow-xl shadow-indigo-200">
              <ShieldCheck className="text-white w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">비밀번호 설정</h1>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                안전한 이용을 위해 <span className="text-indigo-600 font-bold">비밀번호를 설정</span>해 주세요.<br/>
                이후 로그인 시 이 비밀번호가 필요합니다.
              </p>
            </div>
          </div>

          <form onSubmit={handleSetupPassword} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 ml-2 uppercase tracking-widest">새 비밀번호 (4자 이상)</label>
                <input
                  type="password"
                  value={newPass1}
                  onChange={(e) => setNewPass1(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-16 px-6 rounded-2xl border border-slate-200 bg-slate-50/30 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-xl font-bold"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 ml-2 uppercase tracking-widest">비밀번호 다시 입력</label>
                <input
                  type="password"
                  value={newPass2}
                  onChange={(e) => setNewPass2(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-16 px-6 rounded-2xl border border-slate-200 bg-slate-50/30 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-xl font-bold"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-18 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isLoggingIn ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="text-lg">설정 완료 및 시작</span>
                  <ArrowRight size={22} />
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={handleSkipSetup}
              className="w-full h-14 border border-slate-200 text-slate-500 rounded-2xl font-bold hover:bg-slate-50 transition-all text-sm"
            >
              다음에 설정하기 (홈으로 이동)
            </button>
          </form>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3"
            >
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <p className="text-xs text-red-600 font-bold">{error}</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  // Final Redirect
  if (user && (userData?.isProfileComplete || promptSeen)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-10 rounded-[48px] border border-slate-100 shadow-2xl shadow-slate-200/50 space-y-10"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <GraduationCap className="text-white w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">서비스 접속</h1>
            <p className="text-slate-500 text-sm font-medium">학번과 비밀번호를 입력하고 접속하세요.</p>
          </div>
        </div>

        <div className="space-y-8">
          <AnimatePresence mode="wait">
            {mode === 'id' ? (
              <motion.form
                key="id-mode"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 ml-2 uppercase tracking-widest flex items-center gap-2">
                      <User size={12} /> 학번 (아이디)
                    </label>
                    <input
                      type="text"
                      value={fieldId}
                      onChange={(e) => setFieldId(e.target.value)}
                      placeholder="26-20XXX"
                      className="w-full h-16 px-6 rounded-2xl border border-slate-200 bg-slate-50/30 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-lg"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 ml-2 uppercase tracking-widest flex items-center gap-2">
                      <Key size={12} /> 비밀번호
                    </label>
                    <input
                      type="password"
                      value={fieldPassword}
                      onChange={(e) => setFieldPassword(e.target.value)}
                      placeholder="처음이라면 공백"
                      className="w-full h-16 px-6 rounded-2xl border border-slate-200 bg-slate-50/30 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-lg"
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full h-18 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      <span className="text-lg">본인 인증 및 계속하기</span>
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="code-mode"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleLogin}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 ml-2 uppercase tracking-widest">
                    할당된 인증 코드
                  </label>
                  <input
                    type="text"
                    value={fieldCode}
                    onChange={(e) => setFieldCode(e.target.value)}
                    placeholder="예: STUDENT-1"
                    className="w-full h-16 px-6 rounded-2xl border border-slate-200 bg-slate-50/30 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-xl tracking-wider text-center"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full h-18 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <ShieldCheck className="w-6 h-6" />
                      <span className="text-xl font-black tracking-tight">코드로 빠른 입장</span>
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest text-slate-300">
              <span className="bg-white px-4">입장 방식 전환</span>
            </div>
          </div>

          <button
            onClick={() => {
              setMode(mode === 'id' ? 'code' : 'id');
              setError(null);
            }}
            className="w-full h-20 border-2 border-slate-100 rounded-3xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-200 transition-all flex items-center justify-between px-8 active:scale-[0.98] group"
          >
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">ALTERNATIVE</span>
              <span className="text-sm font-bold group-hover:text-indigo-600 transition-colors">
                {mode === 'id' ? '인증 코드로 로그인' : '학번(ID)으로 로그인'}
              </span>
            </div>
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
              <ArrowRight size={20} />
            </div>
          </button>
        </div>



        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4"
          >
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
            <p className="text-sm text-red-600 font-bold leading-tight">{error}</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
