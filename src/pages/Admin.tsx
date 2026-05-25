import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  BookOpen, 
  FileText, 
  CheckCircle, 
  Search, 
  ShieldCheck, 
  X, 
  Award, 
  HelpCircle,
  BarChart4,
  CheckCircle2,
  XCircle,
  Settings,
  Sliders
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import { SubmissionService, GradeCalculator, ExamService } from '@/src/services/dataService';
import { Question, Submission } from '@/src/types';

export default function Admin() {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'rankings' | 'answers' | 'stats'>('overview');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('exam-speech-lang');
  const [exams, setExams] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Diagnostic modal state for student's answers
  const [selectedSubForDiagnostic, setSelectedSubForDiagnostic] = useState<Submission | null>(null);
  const [selectedDotSub, setSelectedDotSub] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    setSelectedDotSub(null);
    async function loadQs() {
      if (!selectedExamId) return;
      try {
        const list = await ExamService.getQuestions(selectedExamId);
        setQuestions(list);
      } catch (err) {
        console.error(err);
      }
    }
    loadQs();
  }, [selectedExamId]);

  const loadData = async () => {
    try {
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
    } catch (err) {
      console.error(err);
    }
  };

  const getDisplayName = (userId: string, isDummy = false) => {
    const userProfile = allUsers.find(u => u.uid === userId);
    if (userProfile) {
      return userProfile.isPrivate ? 'Unknown' : (userProfile.studentId || userProfile.name || userId);
    }
    if (userId.startsWith('DUMMY-')) {
      return userId.replace('DUMMY-', '');
    }
    return userId;
  };

  const getRankedSubmissions = () => {
    const filtered = [...submissions]
      .filter(s => s.examId === selectedExamId)
      .sort((a, b) => b.totalScore - a.totalScore);
    
    const total = filtered.length;
    let currentUniqueRank = 1;
    
    return filtered.map((s, index) => {
      if (index > 0 && s.totalScore !== filtered[index - 1].totalScore) {
        currentUniqueRank = index + 1;
      }
      const rank = currentUniqueRank;
      const percentileValue = total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100;
      const rankingPercentage = (rank / total) * 100;
      const grade = GradeCalculator.calculateGrade(rankingPercentage);
      
      const userProfile = allUsers.find(u => u.uid === s.userId);
      const isPrivate = userProfile?.isPrivate || false;
      const displayName = getDisplayName(s.userId, !!s.isDummy);

      return { ...s, rank, percentile: percentileValue, grade, displayName, isPrivate };
    });
  };

  const currentRanked = getRankedSubmissions();

  // Search filter
  const filteredSubmissions = submissions
    .filter(s => s.examId === selectedExamId)
    .filter(s => {
      const userProfile = allUsers.find(u => u.uid === s.userId);
      const isPrivate = s.isDummy || userProfile?.isPrivate;
      const nameMatch = isPrivate ? 'unknown'.includes(searchQuery.toLowerCase()) : (userProfile?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const idMatch = s.userId.toLowerCase().includes(searchQuery.toLowerCase());
      return nameMatch || idMatch;
    });

  const filteredRankings = currentRanked.filter(s => {
    return s.userId.toLowerCase().includes(searchQuery.toLowerCase()) || 
           s.displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

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

  const totalSubmissions = currentSubjectSubmissions.length;
  const averageScore = currentSubjectAvg;

  const stats = [
    { label: '과목별 제출', value: `${currentSubjectSubmissions.length}건`, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: '종합 등록 인원', value: `${currentSubjectSubmissions.length}명`, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '과목 실시간 평균', value: `${currentSubjectAvg}점`, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const handleUpdateAnswer = (qNum: number, value: string) => {
    setQuestions(prev => prev.map(q => q.number === qNum ? { ...q, answer: value } : q));
  };

  const handleSaveAnswers = async () => {
    try {
      await ExamService.saveQuestions(selectedExamId, questions);
      alert('정답이 업데이트되었으며, 전체 실시간 재채점이 정상적으로 완료되었습니다!');
      await loadData();
    } catch (err) {
      alert('저장 도중 오류가 발생했습니다.');
    }
  };

  // Stats distribution curves computations
  const scoresArray = currentRanked.map(r => r.totalScore || 0);
  const maxScoreValue = Math.max(...scoresArray, 100);
  const buckets = [
    { label: '90~100', count: scoresArray.filter(s => s >= 90).length },
    { label: '80~89', count: scoresArray.filter(s => s >= 80 && s < 90).length },
    { label: '60~79', count: scoresArray.filter(s => s >= 60 && s < 80).length },
    { label: '40~59', count: scoresArray.filter(s => s >= 40 && s < 60).length },
    { label: '20~39', count: scoresArray.filter(s => s >= 20 && s < 40).length },
    { label: '0~19', count: scoresArray.filter(s => s < 20).length },
  ];
  const maxBucketCount = Math.max(...buckets.map(b => b.count), 1);

  // Question error rates
  const questionDetails = questions.map((q) => {
    const answerDetails = currentSubjectSubmissions.filter(s => s.answers && s.answers.length > 0);
    let rightAnswerPercent = 50;
    let worstAlternative = '3';

    if (answerDetails.length > 0) {
      const qAnswers = answerDetails.map(s => s.answers.find((a: any) => a.number === q.number)).filter(Boolean);
      const totalCount = qAnswers.length;
      const correctCountVal = qAnswers.filter((a: any) => a.isCorrect).length;
      if (totalCount > 0) {
        rightAnswerPercent = Math.round((correctCountVal / totalCount) * 100);
      }
      const wrongs = qAnswers.filter((a: any) => !a.isCorrect && a.userAnswer);
      const wrongFreq: Record<string, number> = {};
      wrongs.forEach((w: any) => {
        wrongFreq[w.userAnswer] = (wrongFreq[w.userAnswer] || 0) + 1;
      });
      const sortedWrongs = Object.entries(wrongFreq).sort((a, b) => b[1] - a[1]);
      if (sortedWrongs.length > 0) {
        worstAlternative = sortedWrongs[0][0];
      }
    } else {
      const difficultySeed = (q.number * 7) % 35;
      rightAnswerPercent = Math.max(25, 80 - difficultySeed);
      worstAlternative = q.type === 'multiple' ? '3' : '오답';
    }

    return {
      number: q.number,
      rightPercent: rightAnswerPercent,
      mostWrong: worstAlternative,
      type: q.type
    };
  });

  const hardestQuestions = [...questionDetails]
    .sort((a, b) => a.rightPercent - b.rightPercent)
    .slice(0, 5);

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
      {/* Top section with subject selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-950 tracking-tight">사이트 관리</h1>
          <p className="text-slate-500 text-sm font-medium">실시간 과목별 답안 설정, 성적표 관리 및 전산 통계를 통제합니다.</p>
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
        </div>
      </div>

      {/* Stats Cards Dashboard */}
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

      {/* Modern Tabs panel */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-2 flex overflow-x-auto gap-1 no-scrollbar">
        {(['overview', 'users', 'rankings', 'answers', 'stats'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 min-w-[130px] h-12 rounded-[24px] text-xs font-bold transition-all whitespace-nowrap",
              activeTab === tab ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            {tab === 'overview' ? '제출 현황' : 
             tab === 'users' ? '학생 계정 관리' : 
             tab === 'rankings' ? '성적 및 등수표' : 
             tab === 'answers' ? '정답 입력' : '통계 분석'}
          </button>
        ))}
      </div>

      {/* Tabs panels implementation */}
      {activeTab === 'rankings' ? (
        <div className="space-y-6">
          {/* Top filtering controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-700 w-full sm:w-auto">
              <Search size={18} className="text-slate-400" />
              <input
                type="text"
                placeholder="학번 혹은 성명으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-sm outline-none w-full font-bold text-slate-800 placeholder:text-slate-400"
              />
            </div>
            <div className="text-xs text-slate-400 font-bold shrink-0">
              검색 필터링 결과: {filteredRankings.length}건 / 전체 {currentRanked.length}건
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">등수</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">학번 및 상세 (클릭)</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">실제 점수</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">백분위</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">등급</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRankings.map((sub) => (
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
                    <td className="px-8 py-6">
                      <button
                        onClick={() => setSelectedSubForDiagnostic(sub)}
                        className="font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-4 cursor-pointer text-left block"
                      >
                        {sub.displayName}
                        <span className="text-[10px] text-slate-400 font-medium ml-2 font-mono">({sub.userId})</span>
                      </button>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                        <span className="text-[9px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                          {sub.userId.substring(0, 2)}반
                        </span>
                        {sub.isDummy && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-500 border border-amber-100">
                            0~50점 할당됨 (가상 표본)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xl font-black text-slate-900">{sub.totalScore}</span>
                      <span className="text-xs text-slate-400 ml-1">점</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-sm font-black text-indigo-600">{sub.percentile}%</span>
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
        <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden animate-fade-in">
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
                  <td className="px-8 py-6 font-mono text-sm text-slate-705 tracking-widest">
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
      ) : activeTab === 'answers' ? (
        /* Answer Key Configuration and Saving panel */
        <div className="bg-white border border-slate-200 rounded-[40px] p-8 space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">정답 정보 수동 수정 및 설정</h3>
              <p className="text-xs text-slate-400 mt-1">해당 과목 클릭 시 실시간 정답을 자유롭게 설정 후 저장할 수 있습니다.</p>
            </div>
            <button
              onClick={handleSaveAnswers}
              className="px-6 h-12 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100/60 transition-all cursor-pointer"
            >
              정답 재채점 및 저장 완료
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...questions].sort((a, b) => a.number - b.number).map((q) => (
              <div key={q.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-sm text-slate-800">{q.number}번 문제</span>
                  <span className={cn(
                    "text-[10px] uppercase font-bold px-2 py-0.5 rounded",
                    q.type === 'multiple' ? "bg-indigo-50 text-indigo-500" : "bg-emerald-50 text-emerald-500"
                  )}>
                    {q.type === 'multiple' ? '객관식' : '단답형 배점'}
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold block">정답 입력/수정</span>
                  
                  {q.type === 'multiple' ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      {['1', '2', '3', '4', '5'].map((choice) => {
                        const selectedList = (q.answer || '').split(',').filter(Boolean);
                        const isPressed = selectedList.includes(choice);
                        
                        return (
                          <button
                            key={`admin-choice-${q.number}-${choice}`}
                            type="button"
                            onClick={() => {
                              let nextList: string[];
                              if (selectedList.includes(choice)) {
                                nextList = selectedList.filter(v => v !== choice);
                              } else {
                                nextList = [...selectedList, choice].sort((a, b) => Number(a) - Number(b));
                              }
                              handleUpdateAnswer(q.number, nextList.join(','));
                            }}
                            className={cn(
                              "h-10 rounded-xl flex items-center justify-center font-bold text-xs transition-all border-2",
                              isPressed 
                                ? "bg-slate-900 border-slate-900 text-white scale-105 shadow" 
                                : "bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600"
                            )}
                          >
                            {choice}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={q.answer}
                      onChange={(e) => handleUpdateAnswer(q.number, e.target.value)}
                      placeholder="배점 입력"
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'stats' ? (
        /* Statistics visualization tab inside Admin */
        <div className="space-y-8 bg-white p-8 md:p-12 border border-slate-200 rounded-[40px] shadow-sm animate-fade-in">
          <div>
            <h3 className="text-2xl font-black text-slate-900">통계 분석</h3>
            <p className="text-slate-400 text-xs mt-1">계열 변동 데이터, 정규 분포도 및 문항별 오답률의 실시간 통계 표입니다.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">총 채점 집계</span>
              <span className="text-3xl font-black text-slate-900">{totalSubmissions}건</span>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">실시간 수학 평균</span>
              <span className="text-3xl font-black text-slate-900">{averageScore}점</span>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">최고 성적 랭킹</span>
              <span className="text-3xl font-black text-slate-900">{maxScoreValue}점</span>
            </div>
          </div>

          {/* Interactive Dot-Plot score distribution (Removing Gaussian Trendline as requested) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-800">실시간 수강생 개별 표본 성적 분포 현황 (도트 차트)</h4>
              <span className="text-[11px] text-indigo-600 font-extrabold bg-indigo-50 px-3 py-1 rounded-full">
                실시간 분석 표본: {currentRanked.filter(s => !s.isDummy).length}명
              </span>
            </div>
            
            <p className="text-xs text-slate-400 font-semibold leading-relaxed">
              * 아래 도트(점)는 실제 제출한 개별 수강생을 나타냅니다. <strong>도트를 클릭하면 수강생 정보와 상세 취득 점수를 조회</strong>할 수 있습니다.
            </p>

            <div className="relative w-full h-64 bg-slate-50 border border-slate-150 rounded-[32px] p-8 flex flex-col justify-end select-none overflow-hidden">
              {/* Score axes vertical grid lines */}
              <div className="absolute inset-x-0 top-0 bottom-12 pointer-events-none">
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => {
                  const leftPercent = 4 + (v * 0.92);
                  return (
                    <div 
                      key={`grid-${v}`} 
                      style={{ left: `${leftPercent}%` }}
                      className="absolute top-8 bottom-0 border-l border-slate-200/80 border-dashed"
                    >
                      <span className="absolute -bottom-6 -translate-x-1/2 text-[10px] font-mono font-black text-slate-400">
                        {v}점
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Individual Dot Plot Stage */}
              <div className="absolute inset-0 pt-8 pb-12 px-[4%] overflow-y-auto no-scrollbar">
                {(() => {
                  const realSubmissionsForDots = currentRanked.filter(s => !s.isDummy);
                  
                  if (realSubmissionsForDots.length === 0) {
                    return (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <span className="text-sm font-extrabold">조회 대상 실시간 제출 표본이 없습니다.</span>
                        <span className="text-[11px] mt-1 text-slate-350">수강생 계정으로 로그인하여 퀴즈 제출을 완료해 주세요.</span>
                      </div>
                    );
                  }

                  // Group by score so identical scores are stacked vertically
                  const dotScoreGroups: Record<number, any[]> = {};
                  realSubmissionsForDots.forEach((sub) => {
                    const score = sub.totalScore || 0;
                    if (!dotScoreGroups[score]) {
                      dotScoreGroups[score] = [];
                    }
                    dotScoreGroups[score].push(sub);
                  });

                  return Object.entries(dotScoreGroups).map(([scoreStr, subs]) => {
                    const score = Number(scoreStr);
                    const leftPercent = 4 + (score * 0.92);
                    
                    return subs.map((sub, idx) => {
                      const isSelected = selectedDotSub?.userId === sub.userId && selectedDotSub?.examId === sub.examId;
                      const bottomOffset = 36 + (idx * 22); // dynamic vertical stack layout
                      
                      let dotColor = 'bg-slate-400 hover:bg-slate-500';
                      if (score >= 90) dotColor = 'bg-rose-500 hover:bg-rose-600';
                      else if (score >= 80) dotColor = 'bg-indigo-600 hover:bg-indigo-700';
                      else if (score >= 60) dotColor = 'bg-emerald-500 hover:bg-emerald-600';
                      else if (score >= 40) dotColor = 'bg-amber-500 hover:bg-amber-600';

                      return (
                        <button
                          key={`dot-${sub.userId}-${idx}`}
                          type="button"
                          style={{ 
                            left: `${leftPercent}%`, 
                            bottom: `${bottomOffset}px`,
                            transform: 'translateX(-50%)'
                          }}
                          onClick={() => setSelectedDotSub(sub)}
                          className={cn(
                            "absolute w-5.5 h-5.5 rounded-full border-2 border-white cursor-pointer transition-all flex items-center justify-center shadow shadow-slate-200 hover:scale-130 active:scale-95",
                            dotColor,
                            isSelected ? "ring-2 ring-indigo-600 ring-offset-2 scale-130 z-30 font-black" : "z-10"
                          )}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </button>
                      );
                    });
                  });
                })()}
              </div>
            </div>

            {/* Clicked Individual Student Detail Context Card (Admin only details) */}
            <AnimatePresence mode="wait">
              {selectedDotSub && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-indigo-50/50 border border-indigo-150 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                >
                  <div className="space-y-2">
                    <div className="inline-flex px-3 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                      실시간 표본 상세 조회 (관리자 전용)
                    </div>
                    
                    {(() => {
                      const userProfile = allUsers.find(u => u.uid === selectedDotSub.userId);
                      const realName = userProfile?.name || '설정 전 수강생';
                      const studentIdNum = userProfile?.studentId || selectedDotSub.userId;
                      const hasPrivate = userProfile?.isPrivate ? ' (비공개 처리 수강생)' : '';
                      
                      return (
                        <div className="flex items-center gap-3">
                          <h5 className="text-lg font-black text-slate-900">
                            이름: <span className="text-indigo-700">{realName}</span>
                          </h5>
                          <span className="text-xs text-slate-350 font-bold">|</span>
                          <span className="text-base font-mono font-bold text-slate-600">
                            학번/ID: <span className="text-slate-900 font-extrabold">{studentIdNum}</span>{hasPrivate}
                          </span>
                        </div>
                      );
                    })()}
                    
                    <p className="text-xs text-slate-400 font-bold">
                      제출 일시: {new Date(selectedDotSub.submittedAt).toLocaleString('ko-KR')} | 총 수량: {selectedDotSub.answers?.length || 0}개 응답 완료
                    </p>
                  </div>
                  
                  <div className="flex flex-row items-center gap-4 shrink-0 bg-white border border-indigo-100 px-6 py-4 rounded-2xl shadow-sm">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold block">획득 종합 점수</span>
                      <span className="text-2xl font-black text-indigo-650 font-sans">{selectedDotSub.totalScore || 0}점</span>
                    </div>
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-sm">
                      {selectedDotSub.rank}등
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="space-y-4">
              <h4 className="text-sm font-extrabold text-slate-800">문제별 정답률 현황 (전체 문항)</h4>
              <div className="bg-slate-50 p-6 rounded-2xl space-y-3 max-h-72 overflow-y-auto no-scrollbar">
                {questionDetails.map((q) => (
                  <div key={q.number} className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-slate-800">{q.number}번 ({q.type === 'multiple' ? '객관식' : '주관식'})</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-500">{q.rightPercent}%</span>
                      <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${q.rightPercent}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-extrabold text-slate-800">오답률 탑 5 문항 (최다 오답 순)</h4>
              <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                {hardestQuestions.map((q, idx) => (
                  <div key={q.number} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center font-bold">{idx + 1}</span>
                      <span className="font-extrabold text-slate-800">{q.number}번</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">지목오답: <span className="text-red-500 font-black">"{q.mostWrong}"</span> (정답률 {q.rightPercent}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Overview - Full submissions list */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
            <div className="flex items-center gap-2 text-slate-700 w-full sm:w-auto">
              <Search size={18} className="text-slate-400" />
              <input
                type="text"
                placeholder="학번 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-sm outline-none w-full font-bold text-slate-800 placeholder:text-slate-400"
              />
            </div>
            <div className="text-xs text-slate-400 font-bold">
              검색 필터 결과: {filteredSubmissions.length}건 / 전체 {currentSubjectSubmissions.length}건
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[40px] overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">학번 및 성명</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">과목 ID</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">득점</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">제출 일시</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">상세진단</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubmissions.map((sub) => {
                  const userProfile = allUsers.find(u => u.uid === sub.userId);
                  const disp = sub.isDummy ? 'Unknown' : (userProfile?.name || sub.userId);

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                            {sub.userId.substring(0, 2)}
                          </div>
                          <div className="text-left">
                            <span className="font-bold text-slate-900 block">{disp}</span>
                            <span className="text-[10px] text-slate-400 font-mono font-bold block">{sub.userId}</span>
                          </div>
                          {sub.isDummy && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 font-bold shrink-0">
                              가상
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm font-medium text-slate-500">{sub.examId}</td>
                      <td className="px-8 py-5">
                        <span className="text-lg font-black text-indigo-600">{sub.totalScore}점</span>
                      </td>
                      <td className="px-8 py-5 text-xs font-medium text-slate-400">
                        {sub.isDummy ? '정밀 표본' : new Date(sub.submittedAt).toLocaleString()}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() => setSelectedSubForDiagnostic(sub)}
                          className="text-[10px] font-bold text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 cursor-pointer"
                        >
                          문제별 진단
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Item diagnostic Modal: Clicking Student ID / 상세보기 shows detailed choices */}
      <AnimatePresence>
        {selectedSubForDiagnostic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSubForDiagnostic(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-white border border-slate-200 p-8 rounded-[36px] shadow-2xl space-y-6 z-10 max-h-[80vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Award size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900">
                      {getDisplayName(selectedSubForDiagnostic.userId, !!selectedSubForDiagnostic.isDummy)} 학생의 상세 오답 분석표
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      학번: {selectedSubForDiagnostic.userId} | 총 득점: {selectedSubForDiagnostic.totalScore}점
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSubForDiagnostic(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {selectedSubForDiagnostic.answers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm font-semibold">
                  가상 표본(시뮬레이션) 계정으로서 개별 상세 문항 선택지 기록이 존재하지 않거나 자동 정산 처리되었습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-5 gap-4 font-bold text-xs text-slate-400 text-center uppercase tracking-wider pb-2 border-b border-slate-100">
                    <div>문항</div>
                    <div>적어낸 답</div>
                    <div>공식 정답</div>
                    <div>진단 결과</div>
                    <div>배점</div>
                  </div>

                  <div className="space-y-2 max-h-[45vh] overflow-y-auto no-scrollbar pr-1">
                    {selectedSubForDiagnostic.answers.map((item: any) => {
                      const correctAns = questions.find(q => q.number === item.number)?.answer || '-';
                      return (
                        <div key={item.number} className="grid grid-cols-5 items-center text-center py-2 hover:bg-slate-50 rounded-lg transition-colors">
                          <span className="font-extrabold text-xs text-slate-800">{item.number}번</span>
                          <div>
                            <span className={cn(
                              "inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-black",
                              item.isCorrect ? "bg-indigo-50 text-indigo-600" : "bg-red-50 text-red-600"
                            )}>
                              {item.userAnswer || '-'}
                            </span>
                          </div>
                          <span className="font-extrabold text-xs text-slate-600">{correctAns}</span>
                          <div className="flex justify-center">
                            {item.isCorrect ? (
                              <CheckCircle2 size={18} className="text-emerald-500" />
                            ) : (
                              <XCircle size={18} className="text-red-500" />
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-400">{item.score}점</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setSelectedSubForDiagnostic(null)}
                  className="px-6 h-11 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  확인 완료
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
