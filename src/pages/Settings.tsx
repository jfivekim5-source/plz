import React, { useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { motion } from 'motion/react';
import { User, Shield, Key, Eye, EyeOff, Check, ArrowRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function Settings() {
  const { userData, updateProfileName, setupPassword, togglePrivacy } = useAuth();
  const [newName, setNewName] = useState(userData?.name || '');
  const [newPass, setNewPass] = useState('');
  const [showValues, setShowValues] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [savedPass, setSavedPass] = useState(false);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await updateProfileName(newName);
      setSavedName(true);
      setTimeout(() => setSavedName(false), 2000);
    } catch (err) {
      alert('이름 변경에 실패했습니다.');
    }
  };

  const handleUpdatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 4) {
      alert('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }
    try {
      await setupPassword(newPass);
      setSavedPass(true);
      setNewPass('');
      setTimeout(() => setSavedPass(false), 2000);
    } catch (err) {
      alert('비밀번호 변경에 실패했습니다.');
    }
  };

  if (!userData) return null;

  return (
    <div className="max-w-xl mx-auto py-12 px-4 space-y-12">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">계정 설정</h1>
        
        {/* Top Section: Profile Picture + Name Setting */}
        <div className="flex items-center gap-6 p-4 bg-white rounded-[32px] border border-slate-100 shadow-sm">
          <div className="w-24 h-24 bg-slate-900 rounded-[30px] flex items-center justify-center text-white shrink-0 shadow-xl shadow-slate-200 ring-4 ring-white">
            <User size={48} />
          </div>
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">성명 설정</span>
              <form onSubmit={handleUpdateName} className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 h-12 px-4 rounded-xl border border-slate-100 bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold"
                  placeholder="이름 입력"
                />
                <button
                  type="submit"
                  className="h-12 px-5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95"
                >
                  {savedName ? <Check size={16} /> : '변경'}
                </button>
              </form>
            </div>
            <div className="flex items-center gap-2 pl-1">
              <span className={cn(
                "px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight",
                userData.role === 'admin' ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"
              )}>
                {userData.role === 'admin' ? '운영 관리자' : '학생 회원'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2 text-slate-400">
          <Shield size={16} />
          <h3 className="text-xs font-bold uppercase tracking-widest">계정 관리 디테일</h3>
        </div>

        <div className="space-y-3">
          {/* 1. ID (Read-only) */}
          <div className="p-6 bg-slate-50 rounded-[28px] border border-slate-100 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">로그인 아이디 (학번)</span>
              <p className="font-mono font-bold text-slate-900 text-xl">{userData.studentId}</p>
            </div>
            <div className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-[10px] font-bold text-slate-400">변경 불가</div>
          </div>

          {/* 2. Password (Editable) */}
          <div className="p-6 bg-white rounded-[28px] border border-slate-200 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">로그인 비밀번호</span>
                <p className="font-mono font-bold text-slate-900 text-xl">
                  {showValues ? (userData.password || '미설정') : '••••••••'}
                </p>
              </div>
              <button 
                onClick={() => setShowValues(!showValues)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                {showValues ? '비밀번호 숨기기' : '비밀번호 보기'}
              </button>
            </div>
            
            <form onSubmit={handleUpdatePass} className="flex gap-2 p-2 bg-slate-50 rounded-2xl">
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="flex-1 h-11 px-4 bg-transparent focus:outline-none font-semibold text-sm"
                placeholder="새 비밀번호 설정 (4자 이상)"
              />
              <button
                type="submit"
                className="h-11 px-6 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg shadow-slate-100 hover:bg-black transition-all active:scale-95"
              >
                {savedPass ? '변경 완료' : '비밀번호 수정'}
              </button>
            </form>
          </div>

          {/* 3. Authentication Code (Reference) */}
          <div className="p-6 bg-white rounded-[28px] border border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">할당된 인증 코드</span>
              <p className="font-mono font-bold text-indigo-600 text-2xl tracking-tight">
                {userData.code || '학번으로 가입됨'}
              </p>
            </div>
          </div>

          {/* 4. Privacy Setting (Hide Name) */}
          <div className="p-6 bg-white rounded-[28px] border border-slate-200 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">개인정보 보호</span>
              <p className="font-bold text-slate-900">성적표 이름 비공개</p>
              <p className="text-[10px] text-slate-400">활성화 시 관리자 페이지 등에서 실명 대신 학번으로 표시됩니다.</p>
            </div>
            <button
              onClick={togglePrivacy}
              className={cn(
                "w-14 h-8 rounded-full transition-all relative p-1",
                userData.isPrivate ? "bg-indigo-600" : "bg-slate-200"
              )}
            >
              <motion.div
                animate={{ x: userData.isPrivate ? 24 : 0 }}
                className="w-6 h-6 bg-white rounded-full shadow-sm"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
