import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, BarChart3, MessageCircle, Flame, Vote, Sparkles, Award, Timer, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { ExamService, SubmissionService, SettingsService, getExamCapacity } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';

const INITIAL_EXAMS = [
  { id: 'exam-speech-lang', title: '화법과 언어', grade: '고2', subject: '국어', isOpen: true, questionCount: 28 },
  { id: 'exam-algebra', title: '대수', grade: '고2', subject: '수학', isOpen: true, questionCount: 22 },
  { id: 'exam-english1', title: '영어 I', grade: '고2', subject: '영어', isOpen: true, questionCount: 30 },
  { id: 'exam-physics', title: '물리학', grade: '고2', subject: '과학', isOpen: true, questionCount: 20 },
  { id: 'exam-earth', title: '지구과학', grade: '고2', subject: '과학', isOpen: true, questionCount: 24 },
  { id: 'exam-chemistry', title: '화학', grade: '고2', subject: '과학', isOpen: true, questionCount: 20 }
];

export default function Home() {
  const { user, userData, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<any[]>(INITIAL_EXAMS);
  const [gradeCuts, setGradeCuts] = useState<Record<string, number>>({});
  const [mySubmissions, setMySubmissions] = useState<Record<string, boolean>>({});
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedGradeExamId, setSelectedGradeExamId] = useState<string>('exam-algebra');

  // Difficult Question Voting states
  const [selectedVoteExamId, setSelectedVoteExamId] = useState<string>('exam-algebra');
  const [userVotes, setUserVotes] = useState<Record<string, number[]>>({}); // userId_examId -> list of qNums
  const [votesStats, setVotesStats] = useState<Record<string, Record<number, number>>>({}); // examId -> { qNum: votesCount }
  const [siteSettings, setSiteSettings] = useState<any>(() => {
    const raw = localStorage.getItem('exam_app_site_settings_v3');
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
    return null;
  });

  useEffect(() => {
    async function fetchSettings() {
      const settings = await SettingsService.getSettings();
      if (settings) {
        setSiteSettings(settings);
      }
    }
    fetchSettings();
  }, []);

  // Clean up all 1st semester grade calculator cache
  useEffect(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('local_semester_grades_') || key.startsWith('calculator_saved_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Load Grade Cuts & User Submissions
  useEffect(() => {
    if (authLoading) return;

    async function load() {
      // Fetch exams dynamically
      const e = await ExamService.getExams();
      if (e && e.length > 0) {
        setExams(e);
      } else {
        setExams(INITIAL_EXAMS);
      }

      // Total submissions (dummy + real ones) - Only fetch for selected subjects
      const selectedIds = userData?.selectedSubjects || [];
      const allSubs = await SubmissionService.getAllSubmissionsAcrossExams(selectedIds);
      setAllSubmissions(allSubs);
      
      const cuts: Record<string, number> = {};
      const userSubmissionMap: Record<string, boolean> = {};

      const currentExams = e && e.length > 0 ? e : INITIAL_EXAMS;

      // Check user completed exams using one efficient pass
      if (user) {
        const reals = await SubmissionService.getRealSubmissions();
        const myRealsForUser = reals.filter(s => s.userId === user.uid);
        currentExams.forEach(exam => {
          if (myRealsForUser.some(s => s.examId === exam.id)) {
            userSubmissionMap[exam.id] = true;
          }
        });
      }
      setMySubmissions(userSubmissionMap);

      currentExams.forEach(exam => {
        const subjectSubs = allSubs
          .filter(s => s.examId === exam.id)
          .sort((a, b) => b.totalScore - a.totalScore);
        
        if (subjectSubs.length > 0) {
          // 1st Grade Cut: Top 10%
          const index = Math.floor(subjectSubs.length * 0.1);
          const rawScore = subjectSubs[Math.min(index, subjectSubs.length - 1)].totalScore;
          cuts[exam.id] = Number(rawScore.toFixed(1));
        } else {
          cuts[exam.id] = 0;
        }
      });
      setGradeCuts(cuts);
    }
    load();
  }, [user?.uid, userData?.selectedSubjects?.join(','), authLoading]);

  // Load and seed difficult question votes
  useEffect(() => {
    // Load user cast votes
    let loadedUserVotes: Record<string, number[]> = {};
    if (user) {
      const storedUserVotes = localStorage.getItem('exam_user_votes_v3');
      if (storedUserVotes) {
        try { loadedUserVotes = JSON.parse(storedUserVotes); } catch (e) {}
      }
    }
    setUserVotes(loadedUserVotes);

    // Load global statistics table of votes
    const storedStats = localStorage.getItem('exam_votes_stats_v3');
    let loadedStats: Record<string, Record<number, number>> = {};
    if (storedStats) {
      try { loadedStats = JSON.parse(storedStats); } catch (e) {}
    }

    let modified = false;
    INITIAL_EXAMS.forEach(e => {
      if (!loadedStats[e.id]) {
        loadedStats[e.id] = {};
        modified = true;
      }
    });

    if (modified) {
      localStorage.setItem('exam_votes_stats_v3', JSON.stringify(loadedStats));
    }
    setVotesStats(loadedStats);
  }, [user]);

  // Auto rotation of selected active grade exam for live predictions
  useEffect(() => {
    if (!exams || exams.length <= 1) return;
    const interval = setInterval(() => {
      setSelectedGradeExamId(prev => {
        const idx = exams.findIndex(e => e.id === prev);
        if (idx === -1) return exams[0].id;
        const nextIdx = (idx + 1) % exams.length;
        return exams[nextIdx].id;
      });
    }, 4000); // Cycle every 4 seconds dynamically
    return () => clearInterval(interval);
  }, [exams]);

  // Filter voting exams by student's designated ones and check if voting is enabled
  const isAdmin = userData?.role === 'admin';
  const mySelectedSubjectsList = userData?.selectedSubjects || [];

  const baseVotingExams = (isAdmin || !user) 
    ? exams.filter(e => {
        if (isAdmin) return true;
        const subConf = siteSettings?.subjects?.[e.id];
        return !(subConf && subConf.discloseGrading === false);
      })
    : exams.filter(e => {
        const isSelected = mySelectedSubjectsList.includes(e.id);
        if (!isSelected) return false;
        const subConf = siteSettings?.subjects?.[e.id];
        return !(subConf && subConf.discloseGrading === false);
      });
  const votingExams = baseVotingExams;

  // If currently selected tab is not in votingExams, auto-select the first available one to prevent mismatch
  useEffect(() => {
    if (votingExams.length > 0 && !votingExams.some(e => e.id === selectedVoteExamId)) {
      setSelectedVoteExamId(votingExams[0].id);
    }
  }, [votingExams, selectedVoteExamId]);

  // Vote handler
  const handleToggleVote = (qNum: number) => {
    if (!user) return;
    
    // Safety check - make sure standard user is indeed registered in this subject to vote
    if (!isAdmin && !mySelectedSubjectsList.includes(selectedVoteExamId)) {
      alert('자신이 응시한(선택한) 시험만 투표할 수 있습니다!');
      return;
    }

    const voteKey = `${user.uid}_${selectedVoteExamId}`;
    const currentList = userVotes[voteKey] || [];
    let nextList = [...currentList];

    const nextStats = { ...votesStats };
    if (!nextStats[selectedVoteExamId]) nextStats[selectedVoteExamId] = {};

    if (currentList.includes(qNum)) {
      // Remove vote
      nextList = currentList.filter(n => n !== qNum);
      nextStats[selectedVoteExamId][qNum] = Math.max(0, (nextStats[selectedVoteExamId][qNum] || 0) - 1);
    } else {
      // Add vote (No limits on vote count as requested)
      nextList.push(qNum);
      nextStats[selectedVoteExamId][qNum] = (nextStats[selectedVoteExamId][qNum] || 0) + 1;
    }

    const nextUserVotes = { ...userVotes, [voteKey]: nextList };
    setUserVotes(nextUserVotes);
    setVotesStats(nextStats);

    localStorage.setItem('exam_user_votes_v3', JSON.stringify(nextUserVotes));
    localStorage.setItem('exam_votes_stats_v3', JSON.stringify(nextStats));
  };

  const activeVoteKey = user ? `${user.uid}_${selectedVoteExamId}` : '';
  const activeUserVotedNums = userVotes[activeVoteKey] || [];

  // Sort and query top 5 voted questions for selected exam
  const currentExamVotes = (votesStats[selectedVoteExamId] || {}) as Record<number, number>;
  const sortedVotedQuestions = Object.entries(currentExamVotes)
    .map(([numStr, count]) => ({ number: Number(numStr), count: Number(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalVotesCount = Object.values(currentExamVotes).reduce((sum: number, c) => sum + Number(c), 0) || 1;

  const selectedExamObj = exams.find(e => e.id === selectedVoteExamId) || INITIAL_EXAMS[1];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      transition={{ duration: 0.5 }}
      className="space-y-20 py-12"
    >
      {/* Hero Section */}
      <section className="text-center space-y-8 max-w-4xl mx-auto px-4">
        <div className="space-y-4">
          <motion.h1 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.1]"
          >
            답만 입력하면 <br />
            <span className="text-indigo-600 underline decoration-indigo-250 underline-offset-8">예상 등급</span>까지 한 번에
          </motion.h1>
          <p className="text-slate-500 max-w-lg mx-auto text-base font-medium">
            실시간 데이터로 정확하게 계산되는 1등급 예측 등급컷 서비스
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to={
              !user || !userData 
                ? "/login" 
                : userData.role === 'admin' 
                  ? "/exams" 
                  : (!userData.password || userData.password === '1234' || !userData.selectedSubjects || userData.selectedSubjects.length === 0)
                    ? "/login"
                    : userData.selectedSubjects.length === 1
                      ? `/exams/${userData.selectedSubjects[0]}`
                      : "/exams"
            }
            className="h-16 px-12 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-2xl shadow-indigo-100/50 hover:bg-slate-900 transition-all active:scale-95 text-lg"
          >
            가채점 시작하기
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Grade Cuts Section - 정돈된 드롭다운 방식 */}
      <section className="max-w-4xl mx-auto px-4">
        {!user ? (
          // Guest Banner
          <div className="bg-slate-50 border border-slate-200 p-12 rounded-[36px] text-center space-y-5 max-w-2xl mx-auto shadow-sm">
            <div className="w-12 h-12 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
              <BarChart3 size={24} />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-800">실시간 과목별 등급컷 조회</h2>
              <p className="text-sm text-slate-400">등급컷 및 가채점 결과를 확인하려면 로그인이 필요합니다.</p>
            </div>
            <Link 
              to="/login" 
              className="inline-flex h-12 px-6 bg-slate-900 hover:bg-black text-white rounded-xl font-bold items-center justify-center gap-2 text-sm transition-all"
            >
              로그인하고 시작하기
            </Link>
          </div>
        ) : (
          <div className="bg-white border-2 border-slate-100 rounded-[38px] p-8 md:p-10 shadow-lg shadow-slate-100/40 space-y-8 max-w-2xl mx-auto text-center">
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">실시간 예측 활성화됨</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">실시간 예측 등급컷</h2>
              <p className="text-xs text-slate-450 font-bold">
                자신이 선택한 과목의 예측된 1등급 컷을 확인하실 수 있습니다.
              </p>
            </div>

            {/* 선택된 과목의 대형 정보 표시 카드 */}
            {(() => {
              const isAdmin = userData?.role === 'admin';
              const mySelectedSubjectsIds = userData?.selectedSubjects || [];
              const rotationExams = !user 
                ? exams.filter(e => {
                    const subConf = siteSettings?.subjects?.[e.id];
                    return !(subConf && subConf.discloseGrading === false);
                  })
                : isAdmin 
                  ? exams 
                  : exams.filter(e => {
                      const isSelected = mySelectedSubjectsIds.includes(e.id);
                      if (!isSelected) return false;
                      const subConf = siteSettings?.subjects?.[e.id];
                      return !(subConf && subConf.discloseGrading === false);
                    });

              if (rotationExams.length === 0) {
                return (
                  <div className="py-6 text-center select-none">
                    <span className="text-sm font-bold text-slate-400">선택한 수강 과목이 없습니다.</span>
                  </div>
                );
              }

              const currentSelectedId = rotationExams.some(e => e.id === selectedGradeExamId)
                ? selectedGradeExamId
                : (rotationExams[0]?.id || '');

              const activeGradeExam = rotationExams.find(e => e.id === currentSelectedId);
              if (!activeGradeExam) return null;
              const hasSubmitted = !!mySubmissions[activeGradeExam.id];
              const scoreCut = gradeCuts[activeGradeExam.id] || 0;

              const subConf = siteSettings?.subjects?.[activeGradeExam.id] || {
                minResponseRate: activeGradeExam.id === 'exam-algebra' ? 100 : 40,
                scoreChangeDiff: 1,
                discloseGrading: true,
                discloseStats: true,
              };

              const isGradingVisible = subConf.discloseGrading !== false || isAdmin;

              const totalCapacity = getExamCapacity(activeGradeExam.id);
              const subjectSubs = allSubmissions.filter(s => s.examId === activeGradeExam.id);
              const realSubmissionsCount = subjectSubs.filter(s => !s.isDummy).length;
              const responseRate = totalCapacity > 0 ? (realSubmissionsCount / totalCapacity) * 100 : 0;
              const isResponseRateMet = responseRate >= (subConf.minResponseRate || 0);

              const statsStatureKey = `exam_stats_stature_${activeGradeExam.id}`;
              const statsStatureRaw = localStorage.getItem(statsStatureKey);
              let isStatsForceStable = false;
              if (statsStatureRaw) {
                try {
                  isStatsForceStable = JSON.parse(statsStatureRaw).forceStable === true;
                } catch (e) {}
              }

              const isStatsVisible = isAdmin || (isGradingVisible && subConf.discloseStats !== false && (isResponseRateMet || isStatsForceStable));

              const handlePrev = () => {
                const idx = rotationExams.findIndex(e => e.id === activeGradeExam.id);
                if (idx === -1) return;
                const prevIdx = (idx - 1 + rotationExams.length) % rotationExams.length;
                setSelectedGradeExamId(rotationExams[prevIdx].id);
              };

              const handleNext = () => {
                const idx = rotationExams.findIndex(e => e.id === activeGradeExam.id);
                if (idx === -1) return;
                const nextIdx = (idx + 1) % rotationExams.length;
                setSelectedGradeExamId(rotationExams[nextIdx].id);
              };

              return (
                <div className="flex items-center justify-center gap-2 sm:gap-6 max-w-lg mx-auto relative select-none pb-4">
                  {/* Left manual rotation button */}
                  <button
                    onClick={handlePrev}
                    type="button"
                    className="w-10 h-10 rounded-full bg-slate-50 border border-slate-150 hover:bg-white active:scale-90 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all shadow-sm shrink-0 hover:border-slate-200 cursor-pointer"
                    title="이전 과목 예측 등급컷"
                  >
                    <ChevronLeft size={18} className="stroke-[2.5]" />
                  </button>

                  <div className="relative w-full max-w-xs h-[220px] [perspective:1000px]">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeGradeExam.id}
                        initial={{ opacity: 0, rotateY: -80, x: 20 }}
                        animate={{ opacity: 1, rotateY: 0, x: 0 }}
                        exit={{ opacity: 0, rotateY: 80, x: -20 }}
                        transition={{ duration: 0.45, ease: "easeInOut" }}
                        className="absolute inset-0 bg-slate-50 border border-slate-100 rounded-[32px] p-6 flex flex-col justify-center items-center shadow-sm backface-hidden"
                      >
                        <div className="space-y-1 w-full text-center flex flex-col items-center justify-center">
                          <span className="text-[10px] font-black text-indigo-600 block bg-indigo-50/70 py-1 px-3 rounded-full w-fit mx-auto mb-2">
                            {activeGradeExam.title}
                          </span>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">예상 1등급 컷 점수</p>
                          <div className="text-5xl font-black text-indigo-950 tracking-tighter mb-2">
                            {isAdmin ? (
                              <span>{typeof scoreCut === 'number' ? scoreCut.toFixed(1) : scoreCut}점</span>
                            ) : !isGradingVisible || !isStatsVisible ? (
                              <span className="text-2xl text-slate-400 font-bold">비공개</span>
                            ) : hasSubmitted ? (
                              <span>{typeof scoreCut === 'number' ? scoreCut.toFixed(1) : scoreCut}점</span>
                            ) : (
                              <span>??점</span>
                            )}
                          </div>
                          {!hasSubmitted && userData?.role !== 'admin' && (
                            <div className="pt-2">
                              <Link
                                to={`/exams/${activeGradeExam.id}`}
                                className="inline-flex h-8 px-4 bg-indigo-600 hover:bg-slate-900 text-white rounded-xl font-bold items-center justify-center text-xs transition-colors shadow-md shadow-indigo-100 animate-pulse"
                              >
                                답안 입력하러 가기
                              </Link>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Right manual rotation button */}
                  <button
                    onClick={handleNext}
                    type="button"
                    className="w-10 h-10 rounded-full bg-slate-50 border border-slate-150 hover:bg-white active:scale-90 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all shadow-sm shrink-0 hover:border-slate-200 cursor-pointer"
                    title="다음 과목 예측 등급컷"
                  >
                    <ChevronRight size={18} className="stroke-[2.5]" />
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* Features Grid */}
      <section className="max-w-4xl mx-auto px-4">
        {/* Feature 1: 실시간 데이터 분석 */}
        <div className="p-8 bg-white border border-slate-200 rounded-[32px] space-y-4 shadow-sm hover:border-indigo-100 transition-colors flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-50">
            <BarChart3 className="text-indigo-600" size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">실시간 데이터 분석</h3>
          <p className="text-slate-500 text-sm leading-relaxed max-w-md">
            사용자들의 응답 데이터를 기반으로 정밀 보정하여 오차를 최소화한 등급컷을 산출합니다.
          </p>
        </div>
      </section>

    </motion.div>
  );
}
