import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, BarChart3, MessageCircle, Flame, Vote, Sparkles, Award, Timer, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { ExamService, SubmissionService } from '@/src/services/dataService';
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
  const [slideIndex, setSlideIndex] = useState(0);
  const [selectedGradeExamId, setSelectedGradeExamId] = useState<string>('exam-algebra');

  // Difficult Question Voting states
  const [selectedVoteExamId, setSelectedVoteExamId] = useState<string>('exam-algebra');
  const [userVotes, setUserVotes] = useState<Record<string, number[]>>({}); // userId_examId -> list of qNums
  const [votesStats, setVotesStats] = useState<Record<string, Record<number, number>>>({}); // examId -> { qNum: votesCount }

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
          cuts[exam.id] = subjectSubs[Math.min(index, subjectSubs.length - 1)].totalScore;
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
        // High fidelity seeding of initial votes
        if (e.id === 'exam-algebra') {
          loadedStats[e.id][15] = 142;
          loadedStats[e.id][20] = 110;
          loadedStats[e.id][21] = 95;
          loadedStats[e.id][14] = 48;
          loadedStats[e.id][5] = 22;
        } else if (e.id === 'exam-speech-lang') {
          loadedStats[e.id][12] = 45;
          loadedStats[e.id][18] = 38;
          loadedStats[e.id][25] = 29;
          loadedStats[e.id][5] = 12;
        } else if (e.id === 'exam-physics') {
          loadedStats[e.id][15] = 86;
          loadedStats[e.id][20] = 75;
          loadedStats[e.id][12] = 42;
          loadedStats[e.id][11] = 19;
        } else {
          // General logical question seeding for other subjects
          loadedStats[e.id][10] = Math.floor(Math.random() * 40 + 20);
          loadedStats[e.id][15] = Math.floor(Math.random() * 50 + 30);
          loadedStats[e.id][e.questionCount] = Math.floor(Math.random() * 30 + 15);
        }
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
  
  const siteSettings = (() => {
    const raw = localStorage.getItem('exam_app_site_settings_v3');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })();

  const baseVotingExams = (isAdmin || !user) ? exams : exams.filter(e => mySelectedSubjectsList.includes(e.id));
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
                ? exams 
                : isAdmin 
                  ? exams 
                  : exams.filter(e => mySelectedSubjectsIds.includes(e.id));

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
                            {hasSubmitted || userData?.role === 'admin' ? (
                              <span>{scoreCut}점</span>
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
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto px-4">
        {/* Feature 1: 실시간 데이터 분석 */}
        <div className="p-8 bg-white border border-slate-200 rounded-[32px] space-y-5 shadow-sm hover:border-indigo-100 transition-colors flex flex-col justify-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-50">
            <BarChart3 className="text-indigo-600" size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">실시간 데이터 분석</h3>
          <p className="text-slate-500 text-sm leading-relaxed">
            사용자들의 데이터를 기반으로 보정하여 정확도 높은 등급컷을 산출합니다.
          </p>
        </div>

        {/* Feature 2: 시험 후기 게시판 */}
        <Link 
          to="/reviews"
          className="p-8 bg-white border border-slate-200 hover:border-indigo-300 rounded-[32px] space-y-5 shadow-sm transition-all flex flex-col justify-between group text-left"
        >
          <div className="space-y-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-50 group-hover:bg-amber-100 transition-colors">
              <MessageCircle className="text-amber-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">시험 후기 게시판</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              시험을 치르고 느꼈던 생생한 난이도와 후기를 공유하며 소통해 보세요.
            </p>
          </div>
          <div className="pt-2 text-indigo-600 font-bold text-xs flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
            시험 후기 쓰기 <ArrowRight size={14} />
          </div>
        </Link>
      </section>

      {/* Interactive Difficult Question Voting Block */}
      {votingExams.length > 0 && (() => {
        const isGuestVoteAllowed = siteSettings?.allowGuestVoteView !== false;
        if (!user && !isGuestVoteAllowed) {
          return (
            <section className="max-w-5xl mx-auto px-4 pt-4">
              <div className="bg-slate-50 border border-dashed border-slate-200 py-12 px-6 rounded-[36px] text-center max-w-5xl mx-auto">
                <Lock size={28} className="mx-auto text-slate-350 mb-3" />
                <h3 className="text-sm font-extrabold text-slate-700">어려웠던 문제 실시간 투표 비공개</h3>
                <p className="text-[11px] text-slate-400 mt-1">이 가채점 통계는 비로그인 게스트에게 비공개 상태입니다. 로그인 후 결과를 열람하고 본인의 난이도 투표에 참여해 보세요.</p>
              </div>
            </section>
          );
        }

        return (
          <section className="max-w-5xl mx-auto px-4 space-y-8 pt-4">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
                시험별 어려웠던 문제 실시간 투표
              </h2>
            </div>

            <div className="bg-white border border-slate-200 rounded-[36px] overflow-hidden shadow-xl shadow-slate-100/30 p-8 md:p-10 space-y-8">
              
              {/* Subject selector Dropdown Select */}
              <div className="flex flex-col items-center justify-center border-b border-slate-100 pb-6">
                <div className="w-full max-w-xs relative">
                  <label htmlFor="vote-exam-select" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 text-center">투표 대상 과목 선택</label>
                  <select
                    id="vote-exam-select"
                    value={selectedVoteExamId}
                    onChange={(e) => setSelectedVoteExamId(e.target.value)}
                    className="w-full h-11 px-4 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none text-center shadow-sm"
                  >
                    {votingExams.map((item) => (
                      <option key={`vote-opt-${item.id}`} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 bottom-3.5 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Voting Grid Side */}
                <div className="lg:col-span-7 space-y-5">
                  <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                    <span className="text-xs font-black text-slate-700">
                      📍 {selectedExamObj.title} 문항 선택 (1~{selectedExamObj.questionCount}번)
                    </span>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2.5 py-1 rounded">
                      {!user ? "비로그인 (조회 전용)" : `투표 완료: ${activeUserVotedNums.length}개 선택됨`}
                    </span>
                  </div>

                  {!user && (
                    <div className="text-xs font-bold text-amber-600 bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex items-center gap-2">
                      <Info size={16} className="text-amber-500 shrink-0" />
                      <span>게스트 유저는 실시간 오답률 통계를 열람할 수만 있으며, 투표 체크는 로그인 시 활성화됩니다.</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2.5">
                    {Array.from({ length: selectedExamObj.questionCount }, (_, idx) => idx + 1).map((qNum) => {
                      const isVotedByMe = activeUserVotedNums.includes(qNum);
                      return (
                        <button
                          key={`vote-item-${selectedVoteExamId}-${qNum}`}
                          type="button"
                          disabled={!user}
                          onClick={() => handleToggleVote(qNum)}
                          className={cn(
                            "w-12 h-12 rounded-2xl text-xs font-black transition-all border flex items-center justify-center cursor-pointer",
                            isVotedByMe 
                              ? "bg-indigo-600 border-indigo-600 text-white scale-110 shadow-lg shadow-indigo-150" 
                              : "bg-slate-50 border-slate-150 text-slate-600 hover:border-indigo-300 hover:text-indigo-600",
                            !user && "opacity-75 cursor-not-allowed hover:border-slate-150 hover:text-slate-600"
                          )}
                        >
                          {qNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Real-time Votes Chart Side */}
                <div className="lg:col-span-5 bg-slate-50 border border-slate-150 rounded-[32px] p-6 md:p-8 space-y-6">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                      <Vote size={16} className="text-indigo-600" />
                      {selectedExamObj.title} 정밀 오답 투표 현황
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold leading-none">
                      가장 많이 체크한 고난도 불문항 Top 5 실시간 통계
                    </p>
                  </div>

                  <div className="space-y-4">
                    {sortedVotedQuestions.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs font-bold space-y-2">
                        <p>아직 등록된 오답 문항이 없습니다.</p>
                        <p className="text-[10px] text-slate-300 font-medium">수강생 유저가 투표 시 문항 비율이 실시간 차트화됩니다.</p>
                      </div>
                    ) : (
                      sortedVotedQuestions.map((row, index) => {
                        const percentage = Math.min(100, Math.round((row.count / totalVotesCount) * 100)) || 0;
                        const hasUserVotedThis = activeUserVotedNums.includes(row.number);
                        
                        return (
                          <div key={`voted-row-${row.number}`} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-extrabold text-slate-700 flex items-center gap-1">
                                <span className={cn(
                                  "w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center text-white",
                                  index === 0 ? "bg-red-500" :
                                  index === 1 ? "bg-orange-500" : "bg-slate-400"
                                )}>
                                  {index + 1}
                                </span>
                                {row.number}번 문항 {hasUserVotedThis && <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded ml-1">MY</span>}
                              </span>
                              <span className="font-semibold text-slate-500 font-mono text-[11px]">{row.count}표 ({percentage}%)</span>
                            </div>
                            
                            {/* Progress bar representing votes density */}
                            <div className="w-full h-3 bg-slate-200/50 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className={cn(
                                  "h-full rounded-full",
                                  index === 0 ? "bg-gradient-to-r from-red-500 to-orange-500" :
                                  index === 1 ? "bg-gradient-to-r from-orange-400 to-amber-500" :
                                  "bg-gradient-to-r from-slate-400 to-indigo-500"
                                )}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="text-[10px] text-slate-400 leading-relaxed font-semibold bg-white/70 border border-slate-100 p-3.5 rounded-2xl flex gap-2">
                    <Info size={14} className="text-slate-400 shrink-0 select-none mt-0.5" />
                    <span>실시간 가채점 및 오답률 투표 결과이므로 공식 성적표 발표 시 오답 문항 분포가 달라질 수 있습니다.</span>
                  </div>
                </div>
              </div>

            </div>
          </section>
        );
      })()}
    </motion.div>
  );
}
