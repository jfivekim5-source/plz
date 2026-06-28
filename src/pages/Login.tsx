import React, { useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, GraduationCap, ShieldCheck, Key, ArrowRight, User } from 'lucide-react';

export default function Login() {
  const { user, userData, loginWithID, loginWithCode, setupPassword, saveSelectedSubjects, loading } = useAuth();
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

  // Subject Selection States
  const [useAIBasics, setUseAIBasics] = useState<boolean | null>(null);
  const [selectedElectives, setSelectedElectives] = useState<string[]>([]);

  const handleLoginWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithCode(fieldCode);
    } catch (err: any) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLoginWithID = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithID(fieldId, fieldPassword);
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
    if (newPass1 === '1234') {
      setError("임시 비밀번호('1234') 외의 다른 비밀번호를 설정해 주세요.");
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

  // 관리자에게는 아무것도 묻지마 (비번이랑 수강과목)
  if (user && userData && userData.role === 'admin') {
    return <Navigate to="/" replace />;
  }

  // STEP 1: Password Setup (Required for first-time login or if default password is not changed)
  if (user && userData && (!userData.password || userData.password === '1234')) {
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
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">비밀번호 설정 및 변경</h1>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                안전한 이용과 임시 비밀번호 변경을 위해 <span className="text-indigo-600 font-bold">비밀번호를 새로 설정</span>해 주세요.<br/>
                이후 로그인 시 이 비밀번호가 사용됩니다.
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
                  <span className="text-lg">설정 완료 및 다음 단계</span>
                  <ArrowRight size={22} />
                </>
              )}
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

  // STEP 2: Subject Selection (Required for ALL users who have empty selectedSubjects)
  if (user && userData && (!userData.selectedSubjects || userData.selectedSubjects.length === 0)) {
    const electives = [
      { id: 'exam-physics', title: '물리학', subject: '과학' },
      { id: 'exam-earth', title: '지구과학', subject: '과학' },
      { id: 'exam-chemistry', title: '화학', subject: '과학' },
      { id: 'exam-life-sciences', title: '생명과학', subject: '과학' },
      { id: 'exam-ai-math', title: '인공지능 수학', subject: '수학' },
      { id: 'exam-lit-video', title: '문학과 영상', subject: '국어' },
      { id: 'exam-adv-english', title: '심화영어', subject: '영어' },
      { id: 'exam-world-history', title: '세계사', subject: '사회' },
      { id: 'exam-modern-society-ethics', title: '현대사회와 윤리', subject: '사회' },
      { id: 'exam-society-culture', title: '사회와 문화', subject: '사회' },
      { id: 'exam-global-citizenship-geo', title: '세계시민과 지리', subject: '사회' },
    ];

    const toggleElective = (id: string) => {
      setSelectedElectives(prev => {
        if (prev.includes(id)) {
          return prev.filter(v => v !== id);
        }
        if (prev.length >= 4) {
          return prev; // Max 4
        }
        return [...prev, id];
      });
    };

    const handleSaveSubjects = async () => {
      if (useAIBasics === null || selectedElectives.length !== 4) return;
      setIsLoggingIn(true);
      setError(null);
      try {
        const finalSubjects = [
          'exam-speech-lang', // 화법과 언어 (지정)
          'exam-english1',    // 영어 I (지정)
          'exam-algebra',     // 대수 (지정)
        ];
        if (useAIBasics) {
          finalSubjects.push('exam-ai-basics'); // 인공지능 기초
        }
        finalSubjects.push(...selectedElectives); // 4 electives
        
        await saveSelectedSubjects(finalSubjects);
        window.location.href = '/'; // Full reload to guarantee session hydration
      } catch (err: any) {
        setError(err.message || '저장 중 오류가 발생했습니다.');
      } finally {
        setIsLoggingIn(false);
      }
    };

    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl bg-white p-8 md:p-12 rounded-[48px] border border-slate-150 shadow-2xl shadow-indigo-100/50 space-y-10"
        >
          <div className="text-center space-y-3">
            <div className="inline-flex px-4 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-wider">
              과목 지정 설정 선택
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">수강 과목 선택</h1>
            <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
              본인 학적에 해당하는 기말고사 시험 과목을 선택합니다.
            </p>
          </div>

          <div className="space-y-8">
            {/* 1. Designated Subjects */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-indigo-600 rounded-full"></span>
                지정 공통 과목 (3개)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['화법과 언어 (국어)', '영어 I (영어)', '대수 (수학)'].map((sub) => (
                  <div key={sub} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-650 shrink-0"></span>
                    <span className="text-sm font-bold text-slate-705">{sub}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Electives choice */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-indigo-600 rounded-full"></span>
                  선택 과목 구성 (택 4개)
                </h3>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  선택 완료: {selectedElectives.length}개 / 4개
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-2 border border-slate-100 rounded-2xl bg-slate-50/30">
                {electives.map((item) => {
                  const isChecked = selectedElectives.includes(item.id);
                  const canSelect = isChecked || selectedElectives.length < 4;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!canSelect}
                      onClick={() => toggleElective(item.id)}
                      className={`p-4 rounded-xl border text-left transition-all relative ${
                        isChecked 
                          ? 'border-indigo-600 bg-indigo-50/30 text-indigo-700 font-bold' 
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 disabled:opacity-40'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 leading-none">{item.subject}</span>
                        <span className="text-sm font-bold mt-1">{item.title}</span>
                      </div>
                      {isChecked && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. AI Basics course */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-indigo-600 rounded-full"></span>
                인공지능 기초 시험 과목 선택
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setUseAIBasics(true)}
                  className={`p-5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    useAIBasics === true 
                      ? 'border-indigo-600 bg-indigo-50/40 text-indigo-750 font-bold scale-[1.02]' 
                      : 'border-slate-200 hover:border-slate-350 text-slate-600'
                  }`}
                >
                  <span className="text-base font-bold">인공지능 기초 수강함</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUseAIBasics(false)}
                  className={`p-5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    useAIBasics === false 
                      ? 'border-indigo-600 bg-indigo-50/40 text-indigo-750 font-bold scale-[1.02]' 
                      : 'border-slate-200 hover:border-slate-350 text-slate-600'
                  }`}
                >
                  <span className="text-base font-bold">수강하지 않음</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSaveSubjects}
              disabled={useAIBasics === null || selectedElectives.length !== 4}
              className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-lg font-bold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
            >
              완료
              <ArrowRight size={20} />
            </button>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3"
            >
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
              <p className="text-xs text-red-650 font-bold">{error}</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  // Final Redirect
  if (user && userData && userData.password && userData.password !== '1234' && userData.selectedSubjects && userData.selectedSubjects.length > 0) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 gap-6">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 md:p-10 rounded-[48px] border border-slate-100 shadow-2xl shadow-slate-200/50 space-y-8"
      >
        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <GraduationCap className="text-white w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">서비스 접속</h1>
            <p className="text-slate-500 text-xs font-semibold">등급컷.com에 로그인하여 가채점 결과와 분석을 확인해 보세요.</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Top Section: 인증 코드로 로그인 (최초 가입 및 등록) */}
          <div className="p-6 bg-indigo-50/50 border-2 border-indigo-400 rounded-3xl space-y-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wider rounded-bl-xl animate-pulse">
              최초 접속 필수
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                🔑 인증 코드로 입장 (최초 방문자 필수)
              </h3>
              <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                처음 오셨다면 학교에서 전달받은 <span className="text-indigo-600">인증 코드</span>를 입력하여 로그인 후 나만의 비밀번호를 설정해 주세요!
              </p>
            </div>

            <form onSubmit={handleLoginWithCode} className="space-y-3">
              <input
                type="text"
                value={fieldCode}
                onChange={(e) => setFieldCode(e.target.value)}
                placeholder="예: STUDENT-1"
                className="w-full h-12 px-4 rounded-xl border border-indigo-200 bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm tracking-wider text-center"
                required
              />
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full h-12 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isLoggingIn ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>코드로 등록 및 입장</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <div className="relative flex justify-center text-[9px] font-black uppercase tracking-widest text-slate-300">
              <span className="bg-white px-3">또는</span>
            </div>
          </div>

          {/* Bottom Section: 학번 및 비밀번호 로그인 */}
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                🎓 학번 / 비밀번호 로그인
              </h3>
              <p className="text-[11px] text-slate-450 font-bold">
                이미 최초 등록과 비밀번호 변경을 완료한 경우에 사용하세요.
              </p>
            </div>

            <form onSubmit={handleLoginWithID} className="space-y-3.5">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 ml-1.5 uppercase tracking-widest flex items-center gap-1.5">
                    <User size={10} /> 학번 (아이디)
                  </label>
                  <input
                    type="text"
                    value={fieldId}
                    onChange={(e) => setFieldId(e.target.value)}
                    placeholder="26-20XXX"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold text-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 ml-1.5 uppercase tracking-widest flex items-center gap-1.5">
                    <Key size={10} /> 비밀번호
                  </label>
                  <input
                    type="password"
                    value={fieldPassword}
                    onChange={(e) => setFieldPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold shadow-md hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isLoggingIn ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>학번으로 본인인증 로그인</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-red-50 border border-red-150 rounded-2xl flex items-center gap-3"
          >
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
            <p className="text-xs text-red-650 font-bold leading-tight">{error}</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
