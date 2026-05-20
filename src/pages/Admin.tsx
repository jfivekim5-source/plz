import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, BookOpen, FileText, Plus, CheckCircle, Search, Key, ShieldCheck, User, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import { SubmissionService, GradeCalculator, ExamService } from '@/src/services/dataService';

export default function Admin() {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'rankings'>('overview');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('exam-speech-lang');
  const [exams, setExams] = useState<any[]>([]);

  // Add Subject states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('국어');
  const [newGrade, setNewGrade] = useState('고2');
  const [newQuestionCount, setNewQuestionCount] = useState(20);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    const list = await ExamService.getExams();
    setExams(list);
    if (list.length > 0 && !list.some(e => e.id === selectedExamId)) {
      setSelectedExamId(list[0].id);
    }

    const subs = await SubmissionService.getAllSubmissionsRaw();
    setSubmissions(subs.sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));

    const usersDb = localStorage.getItem('exam_app_users_db');
    if (usersDb) {
      const parsed = JSON.parse(usersDb);
      setAllUsers(Object.values(parsed));
    }
  };

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const cleanId = `exam-${Date.now()}`;
    const newExam = {
      id: cleanId,
      title: newTitle,
      grade: newGrade,
      subject: newSubject,
      isOpen: true,
      questionCount: Number(newQuestionCount) || 20
    };
    await ExamService.addExam(newExam);
    setNewTitle('');
    setShowAddModal(false);
    await loadData();
    setSelectedExamId(cleanId);
  };

  const getRankedSubmissions = () => {
    const filtered = submissions
      .filter(s => s.examId === selectedExamId)
      .sort((a, b) => b.totalScore - a.totalScore);
    
    const total = filtered.length;
    
    return filtered.map((s, index) => {
      const rank = index + 1;
      const percentileValue = Math.round(((total - rank + 1) / total) * 100);
      const rankingPercentage = (rank / total) * 100;
      
      const grade = GradeCalculator.calculateGrade(rankingPercentage);
      
      const userProfile = allUsers.find(u => u.uid === s.userId);
      const displayName = userProfile?.isPrivate ? s.userId : (userProfile?.name || s.userId);

      return { ...s, rank, percentile: percentileValue, grade, displayName };
    });
  };

  const currentRanked = getRankedSubmissions();

  const getGradeCut = (grade: number) => {
    if (currentRanked.length === 0) return 0;
    // target cumulative percentages: 10, 34, 66, 90
    const targetPercentage = grade === 1 ? 0.1 : grade === 2 ? 0.34 : grade === 3 ? 0.66 : 0.9;
    const index = Math.floor(currentRanked.length * targetPercentage);
    return currentRanked[Math.min(index, currentRanked.length - 1)]?.totalScore || 0;
  };

  const currentSubjectSubmissions = submissions.filter(s => s.examId === selectedExamId);
  const currentSubjectUsers = new Set(currentSubjectSubmissions.map(s => s.userId)).size;
  const currentSubjectAvg = currentSubjectSubmissions.length 
    ? Math.round(currentSubjectSubmissions.reduce((acc, s) => acc + (s.totalScore || 0), 0) / currentSubjectSubmissions.length) 
    : 0;

  const stats = [
    { label: '과목별 제출', value: `${currentSubjectSubmissions.length}건`, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '학생 수 (과목)', value: `${currentSubjectUsers}명`, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '과목 평균', value: `${currentSubjectAvg}점`, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  if (userData?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <ShieldCheck size={64} className="text-slate-200" />
        <h1 className="text-xl font-bold text-slate-400 text-center">관리자 전용 페이지입니다.</h1>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">사이트 관리</h1>
          <p className="text-slate-500">전체 학생 명단 및 채점 데이터를 확인합니다.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {exams.map(exam => (
            <button
               key={exam.id}
               onClick={() => setSelectedExamId(exam.id)}
               className={cn(
                 "px-4 h-10 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                 selectedExamId === exam.id 
                   ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                   : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
               )}
            >
               {exam.title}
            </button>
          ))}
          <button onClick={() => setShowAddModal(true)} className="w-10 h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center justify-center transition-all shadow-lg shadow-slate-200 cursor-pointer">
             <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6">
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0", stat.bg)}>
              <stat.icon className={stat.color} size={32} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-2 flex overflow-x-auto no-scrollbar">
        {(['overview', 'users', 'rankings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 min-w-[120px] h-12 rounded-[24px] text-sm font-bold transition-all whitespace-nowrap",
              activeTab === tab ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            {tab === 'overview' ? '전체 제출 현황' : tab === 'users' ? '학생 계정 관리' : '성적 및 등수표'}
          </button>
        ))}
      </div>

      {activeTab === 'rankings' ? (
        <div className="space-y-8">
          {/* Grade Cuts Info Bar */}
          <div className="bg-slate-900 p-8 rounded-[40px] text-white flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-1">
              <h4 className="text-lg font-bold">확정 등급컷</h4>
              <p className="text-slate-400 text-xs">상위 120명 표본 기반 자동 산출</p>
            </div>
            <div className="flex gap-4 md:gap-8 overflow-x-auto no-scrollbar max-w-full">
              {[1, 2, 3, 4].map(g => (
                <div key={g} className="text-center space-y-1 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{g}등급</span>
                  <p className="text-2xl font-black text-indigo-400">{getGradeCut(g)}<span className="text-xs ml-0.5">점</span></p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">등수</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">학번</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">점수</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">백분위</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">등급</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentRanked.map((sub) => (
                  <tr key={sub.id} className={cn(
                    "hover:bg-slate-50/50 transition-colors",
                    sub.grade === 1 && "bg-indigo-50/20"
                  )}>
                    <td className="px-8 py-6">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs",
                        sub.rank === 1 ? "bg-amber-400 text-white shadow-lg shadow-amber-200" : 
                        sub.rank === 2 ? "bg-slate-300 text-white shadow-lg shadow-slate-100" :
                        sub.rank === 3 ? "bg-orange-300 text-white shadow-lg shadow-orange-100" : "text-slate-400 bg-slate-50"
                      )}>
                        {sub.rank}
                      </div>
                    </td>
                    <td className="px-8 py-6 font-bold text-slate-900">
                      {sub.displayName}
                      <span className="text-[10px] text-slate-400 font-medium ml-2">{sub.userId}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xl font-black text-slate-900">{sub.totalScore}</span>
                      <span className="text-xs text-slate-400 ml-1">점</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-sm font-black text-indigo-600">{sub.percentile}</span>
                        <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500" 
                            style={{ width: `${sub.percentile}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className={cn(
                        "inline-flex h-8 px-4 items-center justify-center rounded-xl text-xs font-black",
                        sub.grade === 1 ? "bg-indigo-600 text-white" :
                        sub.grade === 2 ? "bg-indigo-100 text-indigo-600" :
                        sub.grade === 3 ? "bg-slate-100 text-slate-600" :
                        "bg-slate-50 text-slate-400"
                      )}>
                        {sub.grade}등급
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'users' ? (
        <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">학생 성명</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">학번 (ID)</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">비밀번호</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">사용 코드</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">구분</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6 font-bold text-slate-900">{user.name}</td>
                  <td className="px-8 py-6 font-mono font-medium text-slate-600">{user.studentId}</td>
                  <td className="px-8 py-6 font-mono text-sm text-slate-400 tracking-widest">
                    {user.password || '미설정'}
                  </td>
                  <td className="px-8 py-6 font-mono text-indigo-600 font-bold">{user.code || '-'}</td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "inline-flex h-7 px-3 items-center justify-center rounded-lg text-[10px] font-black uppercase tracking-tighter",
                      user.role === 'admin' ? "bg-red-50 text-red-600 ring-1 ring-red-100" : "bg-blue-50 text-blue-600 ring-1 ring-blue-100"
                    )}>
                      {user.role === 'admin' ? 'ADMIN' : 'STUDENT'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">실시간 채점 결과</h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">학번</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">시험명</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">득점</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">제출 일시</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submissions.filter(s => s.examId === selectedExamId).map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                        {sub.userId.substring(0, 2)}
                      </div>
                      <span className="font-bold text-slate-900">{sub.userId}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm font-medium text-slate-500">{sub.examId}</td>
                  <td className="px-8 py-5">
                    <span className="text-lg font-black text-indigo-600">{sub.totalScore}점</span>
                  </td>
                  <td className="px-8 py-5 text-xs font-medium text-slate-400">
                    {new Date(sub.submittedAt).toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="text-[10px] font-bold text-slate-400 border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50">상세보기</button>
                  </td>
                </tr>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-24 text-center">
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                        <FileText size={24} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-400">제출된 데이터가 없습니다.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* Dynamic Animated Modal for adding Exam */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white border border-slate-250 p-8 rounded-[36px] shadow-2xl space-y-6 z-10"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900">새 과목/시험 개설</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Add New Exam Subject</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddExam} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">과목명 (예: 경제, 기하)</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="과목명을 입력하세요 (예: 심화 수학)"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">학년</label>
                    <select
                      value={newGrade}
                      onChange={(e) => setNewGrade(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none bg-white font-semibold text-slate-700"
                    >
                      <option value="고1">고1</option>
                      <option value="고2">고2</option>
                      <option value="고3">고3</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">대분류 계열</label>
                    <select
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none bg-white font-semibold text-slate-700"
                    >
                      <option value="국어">국어</option>
                      <option value="수학">수학</option>
                      <option value="영어">영어</option>
                      <option value="과학">과학</option>
                      <option value="사회">사회</option>
                      <option value="예체능">예체능</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">총 문항 수</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={newQuestionCount}
                    onChange={(e) => setNewQuestionCount(Number(e.target.value) || 20)}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none font-semibold text-slate-700"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 h-12 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl font-bold transition-all text-sm cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all text-sm shadow-lg shadow-indigo-150-all cursor-pointer"
                  >
                    등록 및 개설
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
