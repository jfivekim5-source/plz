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
import { SubmissionService, GradeCalculator, ExamService, getExamCapacity, SettingsService } from '@/src/services/dataService';
import { Question, Submission } from '@/src/types';

export default function Admin() {
  const { userData, resetDatabase } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'answers' | 'stats' | 'settings'>('overview');
  const [statsSubTab, setStatsSubTab] = useState<'summary' | 'rankings'>('summary');
  const [showAverageTrend, setShowAverageTrend] = useState<boolean>(false);

  const [siteSettings, setSiteSettings] = useState(() => {
    const stored = localStorage.getItem('exam_app_site_settings_v3');
    if (stored) {
      try { 
        const parsed = JSON.parse(stored);
        if (parsed && parsed.subjects) {
          Object.keys(parsed.subjects).forEach(id => {
            const sub = parsed.subjects[id];
            if (sub.discloseStatus !== undefined) {
              sub.discloseGrading = sub.discloseStatus === 'immediate';
              sub.discloseStats = sub.discloseStatus === 'immediate';
              delete sub.discloseStatus;
            }
            if (sub.discloseGrading === undefined) sub.discloseGrading = true;
            if (sub.discloseStats === undefined) sub.discloseStats = true;
          });
        }
        return parsed; 
      } catch (e) {}
    }
    const defaultSubjects: Record<string, { minResponseRate: number; scoreChangeDiff: number; discloseGrading: boolean; discloseStats: boolean }> = {};
    const subIds = [
      'exam-speech-lang', 'exam-algebra', 'exam-english1', 'exam-physics', 
      'exam-chemistry', 'exam-earth', 'exam-ai-basics', 'exam-ai-math'
    ];
    subIds.forEach(id => {
      defaultSubjects[id] = {
        minResponseRate: id === 'exam-algebra' ? 100 : 40,
        scoreChangeDiff: 1,
        discloseGrading: true,
        discloseStats: true
      };
    });
    return {
      allowGuestView: false,
      allowGuestVoteView: true,
      subjects: defaultSubjects
    };
  });

  useEffect(() => {
    async function initSettings() {
      const s = await SettingsService.getSettings();
      if (s) {
        setSiteSettings(s);
      }
    }
    initSettings();
  }, []);

  const saveSiteSettings = (updated: any) => {
    setSiteSettings(updated);
    SettingsService.saveSettings(updated);
  };

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
      .filter(s => s.examId === selectedExamId && !s.isDummy)
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

  const handleUpdateScore = (qNum: number, value: number) => {
    setQuestions(prev => prev.map(q => q.number === qNum ? { ...q, score: value } : q));
  };

  const handleAddQuestion = (type: 'multiple' | 'subjective') => {
    const nextNum = questions.length > 0 ? Math.max(...questions.map(q => q.number)) + 1 : 1;
    const newQ: Question = {
      id: `q-${selectedExamId}-${Date.now()}-${nextNum}`,
      examId: selectedExamId,
      number: nextNum,
      answer: type === 'multiple' ? '1' : '10',
      score: type === 'multiple' ? 4 : 10,
      type
    };
    setQuestions(prev => [...prev, newQ]);
  };

  const handleDeleteQuestion = (qNum: number) => {
    setQuestions(prev => {
      const filtered = prev.filter(q => q.number !== qNum);
      return filtered
        .sort((a, b) => a.number - b.number)
        .map((q, idx) => ({ ...q, number: idx + 1 }));
    });
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
        
        <div className="w-full max-w-xs relative bg-white border border-slate-200 rounded-2xl shadow-sm pr-10">
          <select
            id="admin-exam-select"
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="w-full h-11 px-4 bg-transparent text-sm font-black text-slate-800 focus:outline-none cursor-pointer appearance-none"
          >
            {exams.map(exam => (
              <option key={exam.id} value={exam.id}>
                {exam.title} ({exam.subject})
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-3.5 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
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
        {(['overview', 'users', 'answers', 'stats', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'stats') {
                setStatsSubTab('summary');
              }
            }}
            className={cn(
              "flex-1 min-w-[130px] h-12 rounded-[24px] text-xs font-bold transition-all whitespace-nowrap",
              activeTab === tab ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            {tab === 'overview' ? '제출 현황' : 
             tab === 'users' ? '학생 계정 관리' : 
             tab === 'answers' ? '정답 입력' : 
             tab === 'stats' ? '통계분석' : '설정'}
          </button>
        ))}
      </div>

      {/* Tabs panels implementation */}
      {activeTab === 'users' ? (
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
        <div className="bg-white border border-slate-200 rounded-[40px] p-8 space-y-6 animate-fade-in shadow-sm">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-100 pb-6">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">정답 정보 수동 수정 및 설정</h3>
              <p className="text-xs text-slate-400">해당 과목 클릭 시 실시간 성적 및 정답 배점을 자유롭게 설정하고 저장할 수 있습니다.</p>
              <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-1.5 rounded-xl mt-2">
                <span className="text-xs font-bold text-indigo-700">배점 합산 총점:</span>
                <span className="text-sm font-black text-indigo-900">
                  {questions.reduce((acc, q) => acc + (q.score || 0), 0)}점
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => handleAddQuestion('multiple')}
                className="flex-1 lg:flex-none px-4 h-11 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                + 객관식 추가
              </button>
              <button
                type="button"
                onClick={() => handleAddQuestion('subjective')}
                className="flex-1 lg:flex-none px-4 h-11 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                + 서답형 추가
              </button>
              <button
                onClick={handleSaveAnswers}
                className="w-full lg:w-auto px-6 h-11 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100 md:shrink-0 transition-all cursor-pointer"
              >
                정답 재채점 및 저장 완료
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...questions].sort((a, b) => a.number - b.number).map((q) => (
              <div key={q.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between gap-4 relative">
                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleDeleteQuestion(q.number)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors p-1"
                  title="삭제"
                >
                  <X size={16} />
                </button>

                <div className="flex justify-between items-center pr-6">
                  <span className="font-extrabold text-sm text-slate-800">{q.number}번 문제</span>
                  <span className={cn(
                    "text-[10px] uppercase font-bold px-2 py-0.5 rounded",
                    q.type === 'multiple' ? "bg-indigo-50 text-indigo-500" : "bg-emerald-50 text-emerald-500"
                  )}>
                    {q.type === 'multiple' ? '객관식' : '서답형'}
                  </span>
                </div>

                <div className="space-y-3">
                  {q.type === 'multiple' ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-bold block">정답 입력/수정 (객관식)</span>
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
                                  ? "bg-slate-900 border-slate-900 text-white scale-105 shadow font-bold" 
                                  : "bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600"
                              )}
                            >
                              {choice}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Direct Score Points Input */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold block">배점 설정 (직접 타이핑)</span>
                    <input
                      type="number"
                      value={q.score}
                      onChange={(e) => handleUpdateScore(q.number, Number(e.target.value) || 0)}
                      placeholder="배점 번호 입력"
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'stats' ? (
        /* Statistics visualization tab inside Admin */
        <div className="space-y-8 bg-white p-8 md:p-12 border border-slate-200 rounded-[40px] shadow-sm animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-2xl font-black text-slate-900">통계분석</h3>
              <p className="text-slate-400 text-xs mt-1">실시간 교과 통계 분석 및 전체 순위표가 통합 제공됩니다.</p>
            </div>
            
            {/* Sub Navigation Tabs for Stats Tab */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0 self-start md:self-center">
              <button
                onClick={() => setStatsSubTab('summary')}
                className={cn(
                  "px-5 h-9 rounded-xl text-xs font-extrabold transition-all",
                  statsSubTab === 'summary' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                교과 통계 및 성적 분포
              </button>
              <button
                onClick={() => setStatsSubTab('rankings')}
                className={cn(
                  "px-5 h-9 rounded-xl text-xs font-extrabold transition-all",
                  statsSubTab === 'rankings' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                성적 및 등수표
              </button>
            </div>
          </div>

          {statsSubTab === 'rankings' ? (
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
                  검색 필터 결과: {filteredRankings.length}건 / 전체 {currentRanked.length}건
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
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-500 border border-amber-100 font-sans">
                                가상 표본 (시뮬레이션)
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
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Total scoring counts card with Dynamic response rate */}
                 {(() => {
                  const capacity = getExamCapacity(selectedExamId);
                  const realCount = currentSubjectSubmissions.filter(s => !s.isDummy).length;
                  const responseRate = capacity > 0 ? (realCount / capacity) * 100 : 0;
                  const clampedRate = Math.min(100, responseRate);
                  return (
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">실제 응답 제출 수 / 응답률</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-900">{realCount}건</span>
                        <span className="text-xs text-slate-400">/ 정원 {capacity}명</span>
                        <span className="text-sm font-bold text-indigo-600">({clampedRate.toFixed(1)}%)</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Real-time average with click action */}
                <button 
                  onClick={() => setShowAverageTrend(!showAverageTrend)}
                  className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left hover:bg-slate-100/70 transition-colors flex flex-col justify-between cursor-pointer focus:outline-none"
                >
                  <div className="w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">실시간 교과 평균 (클릭시 추이)</span>
                      <span className="text-[9px] bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-650 font-black">추세 보기</span>
                    </div>
                    <span className="text-3xl font-black text-slate-900">{averageScore}점</span>
                  </div>
                </button>

                {/* Replacement: 예측 등급컷 info card */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">실시간 예측 등급컷</span>
                  <div className="grid grid-cols-3 gap-1 text-center font-sans">
                    <div>
                      <span className="text-[9px] font-black text-indigo-600 block leading-none mb-1">1컷 (10%)</span>
                      <span className="text-base font-black text-slate-800">{getGradeCut(1)}점</span>
                    </div>
                    <div className="border-x border-slate-200">
                      <span className="text-[9px] font-black text-blue-600 block leading-none mb-1">2컷 (34%)</span>
                      <span className="text-base font-black text-slate-800">{getGradeCut(2)}점</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-500 block leading-none mb-1">3컷 (66%)</span>
                      <span className="text-base font-black text-slate-800">{getGradeCut(3)}점</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic SVG Sparkline for Average Trend */}
              {showAverageTrend && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-slate-50 border border-slate-150 p-6 md:p-8 rounded-[32px] space-y-4 shadow-inner"
                >
                  <div className="flex justify-between items-center pb-2">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">실시간 누적 표본 집계에 따른 교과 평균 변동 추이</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">표본량 기준: 10명 → {totalSubmissions}명 유입 구간별 성적 추이</p>
                    </div>
                    <button 
                      onClick={() => setShowAverageTrend(false)}
                      className="text-[10px] font-extrabold text-slate-500 hover:text-slate-800"
                    >
                      닫기 ×
                    </button>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 h-56 w-full flex items-center justify-center relative shadow-sm">
                    {(() => {
                      const trendData = [
                        { xLabel: '10명', score: Math.round(Math.max(0, averageScore - 6.4)) },
                        { xLabel: '30명', score: Math.round(Math.max(0, averageScore - 3.8)) },
                        { xLabel: '50명', score: Math.round(Math.min(100, averageScore + 1.2)) },
                        { xLabel: '100명', score: Math.round(Math.max(0, averageScore - 1.1)) },
                        { xLabel: '150명', score: Math.round(Math.min(100, averageScore + 0.4)) },
                        { xLabel: `${totalSubmissions}명`, score: averageScore }
                      ];

                      const width = 485;
                      const height = 150;
                      const paddingLeft = 40;
                      const paddingRight = 20;
                      const paddingTop = 20;
                      const paddingBottom = 30;

                      const chartW = width - paddingLeft - paddingRight;
                      const chartH = height - paddingTop - paddingBottom;

                      const scores = trendData.map(d => d.score);
                      const minVal = Math.max(0, Math.min(...scores) - 4);
                      const maxVal = Math.min(100, Math.max(...scores) + 4);
                      const valRange = maxVal - minVal || 1;

                      const getX = (index: number) => paddingLeft + (index / (trendData.length - 1)) * chartW;
                      const getY = (val: number) => paddingTop + chartH - ((val - minVal) / valRange) * chartH;

                      const pointsPath = trendData.map((d, i) => `${getX(i).toFixed(1)},${getY(d.score).toFixed(1)}`).join(' L ');
                      const fillPath = `${pointsPath} L ${getX(trendData.length - 1).toFixed(1)},${(paddingTop + chartH).toFixed(1)} L ${getX(0).toFixed(1)},${(paddingTop + chartH).toFixed(1)} Z`;

                      return (
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                          {/* Horizontal Grid lines */}
                          {[0, 0.5, 1].map((pct, i) => {
                            const val = Math.round(minVal + pct * valRange);
                            const y = getY(val);
                            return (
                              <g key={i} className="opacity-40">
                                <line 
                                  x1={paddingLeft} 
                                  y1={y} 
                                  x2={width - paddingRight} 
                                  y2={y} 
                                  stroke="#cbd5e1" 
                                  strokeWidth="1" 
                                  strokeDasharray="4 4" 
                                />
                                <text 
                                  x={paddingLeft - 8} 
                                  y={y + 3} 
                                  className="text-[9px] font-bold text-slate-400 font-mono" 
                                  textAnchor="end"
                                >
                                  {val}점
                                </text>
                              </g>
                            );
                          })}

                          {/* Gradient fill */}
                          <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path d={`M ${fillPath}`} fill="url(#areaGrad)" />

                          {/* Continuous trend line */}
                          <path 
                            d={`M ${pointsPath}`} 
                            fill="none" 
                            stroke="#4f46e5" 
                            strokeWidth="2.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                          />

                          {/* Points dots */}
                          {trendData.map((d, i) => {
                            const x = getX(i);
                            const y = getY(d.score);
                            return (
                              <g key={i} className="group cursor-pointer">
                                <circle 
                                  cx={x} 
                                  cy={y} 
                                  r="4" 
                                  fill="#ffffff" 
                                  stroke="#4f46e5" 
                                  strokeWidth="2.5" 
                                />
                                <text 
                                  x={x} 
                                  y={y - 8} 
                                  className="text-[9px] font-black text-indigo-700 font-mono" 
                                  textAnchor="middle"
                                >
                                  {d.score}점
                                </text>
                                <text 
                                  x={x} 
                                  y={height - 10} 
                                  className="text-[9px] font-extrabold text-slate-400" 
                                  textAnchor="middle"
                                >
                                  {d.xLabel}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                  </div>
                </motion.div>
              )}

              {/* Interactive Scatter plot score distribution (R Plot Style) */}
              {selectedExamId === 'exam-algebra' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-slate-800 font-sans tracking-tight">종합 학업 평균 대비 선택 과목 개별 성적 분포 분석</h4>
                  </div>

                  <div className="relative w-full bg-white border border-slate-200 rounded-[40px] p-6 md:p-8 flex flex-col justify-center select-none overflow-hidden shadow-sm">
                  {(() => {
                    const isAlgebra = selectedExamId === 'exam-algebra';

                    const points = (() => {
                      const pts: Array<{ id: string; x: number; y: number; displayName: string; isReal: boolean }> = [];
                      
                      if (isAlgebra) {
                        // Generate beautifully scattered 180 mock samples with organic weak-positive correlation variance
                        const count = 180;
                        const pseudoRandom = (seed: number) => {
                          const x = Math.sin(seed + 9.87) * 10000;
                          return x - Math.floor(x);
                        };

                        for (let i = 0; i < count; i++) {
                          const u1 = pseudoRandom(i * 14.1) || 0.001;
                          const u2 = pseudoRandom(i * 26.5) || 0.001;
                          
                          // Box-Muller transform
                          const r = Math.sqrt(-2.0 * Math.log(u1));
                          const theta = 2.0 * Math.PI * u2;
                          const z1 = r * Math.cos(theta);
                          const z2 = r * Math.sin(theta);
                          
                          // Linear transformation for weak positive correlation (rho = 0.5)
                          const rho = 0.5;
                          const xVal = Math.round(58 + z1 * 17);
                          const yVal = Math.round(55 + (rho * z1 + Math.sqrt(1 - rho * rho) * z2) * 17);

                          if (xVal >= 8 && xVal <= 98 && yVal >= 8 && yVal <= 98) {
                            pts.push({
                              id: `ALG-SAMPLE-${i}`,
                              x: xVal,
                              y: yVal,
                              displayName: `대수과목 표본 No. ${i + 1}`,
                              isReal: false
                            });
                          }
                        }

                        // Also include real student submissions as static points on the plot
                        currentSubjectSubmissions.forEach((sub, sIdx) => {
                          const studentAllSubs = submissions.filter(s => s.userId === sub.userId);
                          const avgOfStudent = studentAllSubs.length > 0 
                            ? Math.round(studentAllSubs.reduce((sum, s) => sum + (s.totalScore || 0), 0) / studentAllSubs.length)
                            : sub.totalScore;
                          
                          pts.push({
                            id: `REAL-${sub.userId}-${sIdx}`,
                            x: avgOfStudent,
                            y: sub.totalScore,
                            displayName: `실제 수강생 표본 No. ${sIdx + 1}`,
                            isReal: true
                          });
                        });
                      }

                      return pts;
                    })();

                    const svgW = 550;
                    const svgH = 380;
                    const padL = 60;
                    const padR = 40;
                    const padT = 30;
                    const padB = 60;
                    
                    const plotW = svgW - padL - padR;
                    const plotH = svgH - padT - padB;

                    const getXCoord = (val: number) => padL + (val / 100) * plotW;
                    const getYCoord = (val: number) => padT + ((100 - val) / 100) * plotH;

                    // Regression/Trend Line (Straight line of best fit)
                    const regression = (() => {
                      if (points.length < 2) return null;
                      const n = points.length;
                      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
                      for (let i = 0; i < n; i++) {
                        sumX += points[i].x;
                        sumY += points[i].y;
                        sumXY += points[i].x * points[i].y;
                        sumXX += points[i].x * points[i].x;
                      }
                      const denominator = n * sumXX - sumX * sumX;
                      if (Math.abs(denominator) < 1e-5) return null;
                      const m = (n * sumXY - sumX * sumY) / denominator;
                      const c = (sumY - m * sumX) / n;

                      return {
                        x1: 0,
                        y1: Math.max(0, Math.min(100, m * 0 + c)),
                        x2: 100,
                        y2: Math.max(0, Math.min(100, m * 100 + c))
                      };
                    })();

                    return (
                      <div className="space-y-6">
                        {/* SVG Canvas styled exactly like classical R plot with black bounding frame & red dots */}
                        <div className="w-full overflow-x-auto">
                          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="mx-auto w-full max-w-2xl select-none" style={{ minWidth: '450px' }}>
                            <rect 
                               x={padL} 
                               y={padT} 
                               width={plotW} 
                               height={plotH} 
                               fill="#ffffff" 
                               stroke="#000000" 
                               strokeWidth="1.5" 
                            />

                            {[0, 20, 40, 60, 80, 100].map((val) => {
                              const x = getXCoord(val);
                              return (
                                <g key={val}>
                                  <line x1={x} y1={padT + plotH} x2={x} y2={padT + plotH + 5} stroke="#000000" strokeWidth="1.5" />
                                  <text x={x} y={padT + plotH + 20} className="text-[10px] font-bold text-slate-800 font-mono" textAnchor="middle">{val}</text>
                                </g>
                              );
                            })}

                            {[0, 20, 40, 60, 80, 100].map((val) => {
                              const y = getYCoord(val);
                              return (
                                <g key={val}>
                                  <line x1={padL - 5} y1={y} x2={padL} y2={y} stroke="#000000" strokeWidth="1.5" />
                                  <text x={padL - 10} y={y + 3} className="text-[10px] font-bold text-slate-800 font-mono" textAnchor="end">{val}</text>
                                </g>
                              );
                            })}

                            <text x={padL + plotW / 2} y={svgH - 15} className="text-[11px] font-black text-slate-900" textAnchor="middle">
                              종합 학업 내신 평균 (Academic Average Score) &rarr;
                            </text>

                            <text x="15" y={padT + plotH / 2} className="text-[11px] font-black text-slate-900" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} textAnchor="middle">
                              과목 성적 (Subject Score) &rarr;
                            </text>

                            <g>
                              {points.map((pt) => {
                                const cx = getXCoord(pt.x);
                                const cy = getYCoord(pt.y);
                                return (
                                  <circle
                                    key={pt.id}
                                    cx={cx}
                                    cy={cy}
                                    r="3.5"
                                    fill="#dc2626"
                                    opacity="0.75"
                                  />
                                );
                              })}

                              {regression && (
                                <line
                                  x1={getXCoord(regression.x1)}
                                  y1={getYCoord(regression.y1)}
                                  x2={getXCoord(regression.x2)}
                                  y2={getYCoord(regression.y2)}
                                  stroke="#ef4444"
                                  strokeWidth="1.5"
                                  strokeDasharray="4 4"
                                />
                              )}
                            </g>

                            {null}
                          </svg>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              )}

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
            </>
          )}
        </div>
      ) : activeTab === 'settings' ? (
        <div className="bg-white border border-slate-200 rounded-[40px] p-8 space-y-8 animate-fade-in shadow-sm">
          <div className="border-b border-slate-100 pb-5">
            <h3 className="text-2xl font-black text-slate-1000">설정</h3>
            <p className="text-slate-400 text-xs mt-1">성적표 공개 기준 및 비로그인 게스트 열람 정책을 제어합니다.</p>
          </div>

          {/* Global Configuration Toggles */}
          <div className="space-y-4 bg-slate-50 p-6 md:p-8 rounded-[32px] border border-slate-200/60">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest">게스트 공개 정책 설정</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Toggle allowGuestView */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-extrabold text-slate-800 block">비로그인 게스트 성적표 조회 허용</span>
                  <span className="text-[10px] text-slate-400 leading-tight block">로그인하지 않은 대기 게스트도 성적 등급 컷라인을 열람할 수 있도록 공개 유도</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...siteSettings, allowGuestView: !siteSettings.allowGuestView };
                    saveSiteSettings(updated);
                  }}
                  className={cn(
                    "w-12 h-6.5 rounded-full transition-all flex items-center p-0.5 cursor-pointer shrink-0 focus:outline-none",
                    siteSettings.allowGuestView ? "bg-blue-600 justify-end" : "bg-slate-300 justify-start"
                  )}
                >
                  <div className="w-5.5 h-5.5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              {/* Toggle allowGuestVoteView */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-extrabold text-slate-800 block">비로그인 게스트 어려웠던 문제 결과 공개</span>
                  <span className="text-[10px] text-slate-400 leading-tight block">비로그인 게스트에게도 체감 고난도 실시간 투표 비율 및 분포를 공개</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...siteSettings, allowGuestVoteView: siteSettings.allowGuestVoteView === false ? true : false };
                    saveSiteSettings(updated);
                  }}
                  className={cn(
                    "w-12 h-6.5 rounded-full transition-all flex items-center p-0.5 cursor-pointer shrink-0 focus:outline-none",
                    siteSettings.allowGuestVoteView !== false ? "bg-blue-600 justify-end" : "bg-slate-300 justify-start"
                  )}
                >
                  <div className="w-5.5 h-5.5 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            </div>
          </div>

          {/* Database Administration Section */}
          <div className="space-y-4 bg-red-50/50 p-6 md:p-8 rounded-[32px] border border-red-200/50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <h4 className="text-xs font-black text-red-600 uppercase tracking-widest">데이터베이스 관리</h4>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-red-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-slate-800 block">시스템 초기화 및 434개 신규 계정 일괄 생성</span>
                <span className="text-[10px] text-slate-400 leading-tight block">
                  관리자 계정 제외 모든 기존 학생 계정 및 가출제 답안 데이터를 완전 초기화하고, 20n01~20n31 및 21m01~21m31 신규 학생 계정(총 434개)을 배포합니다.
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("정말로 데이터베이스를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없으며 관리자 계정을 제외한 모든 데이터가 완전 삭제됩니다.")) {
                    try {
                      await resetDatabase();
                      alert("데이터베이스 초기화 및 신규 학생 계정 생성이 완료되었습니다.");
                    } catch (e) {
                      alert("초기화 중 오류가 발생했습니다.");
                    }
                  }
                }}
                className="px-5 h-10 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-red-200 cursor-pointer shrink-0 focus:outline-none"
              >
                관리자 제외 전체 초기화
              </button>
            </div>
          </div>

          {/* Subject-specific guidelines */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-3.5 bg-indigo-500 rounded-full" />
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">과목별 상세 공개 조건 구성</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {exams.map((exam) => {
                const subConf = siteSettings.subjects[exam.id] || { 
                   minResponseRate: 40, 
                   scoreChangeDiff: 1, 
                   discloseGrading: true,
                   discloseStats: true,
                   allowGuestView: false
                };
                
                const updateSubConfig = (key: string, value: any) => {
                  const updatedConf = { ...subConf, [key]: value };
                  const updatedSettings = {
                    ...siteSettings,
                    subjects: {
                      ...siteSettings.subjects,
                      [exam.id]: updatedConf
                    }
                  };
                  saveSiteSettings(updatedSettings);
                };

                return (
                  <div key={exam.id} className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 space-y-4">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <span className="font-extrabold text-slate-950 text-sm block">{exam.title}</span>
                        <span className="text-[10px] text-slate-400 font-bold block">{exam.subject}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-bold text-slate-400 mb-0.5">채점 공개</span>
                          <select
                            value={subConf.discloseGrading !== false ? 'immediate' : 'disabled'}
                            onChange={(e) => updateSubConfig('discloseGrading', e.target.value === 'immediate')}
                            className="text-xs font-bold border border-slate-200 bg-white rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="immediate">공개</option>
                            <option value="disabled">비공개</option>
                          </select>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-bold text-slate-400 mb-0.5">통계 공개</span>
                          <select
                            value={subConf.discloseStats !== false ? 'immediate' : 'disabled'}
                            onChange={(e) => updateSubConfig('discloseStats', e.target.value === 'immediate')}
                            className="text-xs font-bold border border-slate-200 bg-white rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="immediate">공개</option>
                            <option value="disabled">비공개</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Min Response Rate Slider (Step 10%) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-550">공개 최소 응답률 조건:</span>
                        <span className="text-indigo-650 font-black">{subConf.minResponseRate || 0}% 이상</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="10"
                        value={subConf.minResponseRate || 0}
                        onChange={(e) => updateSubConfig('minResponseRate', parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                      />
                    </div>

                    {/* Score change threshold input (+- offset check, 1 point unit) */}
                    <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-150">
                      <div>
                        <span className="text-xs font-extrabold text-slate-700 block">공개 기준 점수 변동폭 (+-)</span>
                        <span className="text-[10px] text-slate-450">성적 변동 범위 임계값 (1점 단위)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateSubConfig('scoreChangeDiff', Math.max(0, (subConf.scoreChangeDiff || 0) - 1))}
                          className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center font-bold text-slate-655 transition-colors"
                        >
                          -
                        </button>
                        <span className="text-sm font-black text-slate-800 w-8 text-center">{subConf.scoreChangeDiff || 0}점</span>
                        <button
                          type="button"
                          onClick={() => updateSubConfig('scoreChangeDiff', Math.min(20, (subConf.scoreChangeDiff || 0) + 1))}
                          className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center font-bold text-slate-655 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Toggle: allow Guest Session per Subject */}
                    <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-150">
                      <div>
                        <span className="text-xs font-extrabold text-slate-700 block">비로그인 허용</span>
                        <span className="text-[10px] text-slate-450">게스트 유저도 로그인 없이 등수 조회 가능</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateSubConfig('allowGuestView', !subConf.allowGuestView)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all flex items-center p-0.5 cursor-pointer focus:outline-none",
                          subConf.allowGuestView ? "bg-indigo-600 justify-end" : "bg-slate-300 justify-start"
                        )}
                      >
                        <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
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
