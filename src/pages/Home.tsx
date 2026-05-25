import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, BarChart3, MessageCircle, Flame, Vote, Sparkles, Award, Timer, Info } from 'lucide-react';
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
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<any[]>(INITIAL_EXAMS);
  const [gradeCuts, setGradeCuts] = useState<Record<string, number>>({});
  const [mySubmissions, setMySubmissions] = useState<Record<string, boolean>>({});
  const [slideIndex, setSlideIndex] = useState(0);

  // Difficult Question Voting states
  const [selectedVoteExamId, setSelectedVoteExamId] = useState<string>('exam-algebra');
  const [userVotes, setUserVotes] = useState<Record<string, number[]>>({}); // userId_examId -> list of qNums
  const [votesStats, setVotesStats] = useState<Record<string, Record<number, number>>>({}); // examId -> { qNum: votesCount }

  // 1st Semester Grade Calculator states
  const [gradeCalcSubjectId, setGradeCalcSubjectId] = useState<string>('exam-algebra');
  const [midtermScore, setMidtermScore] = useState<number>(80);
  const [perfScore, setPerfScore] = useState<number>(90);
  const [deductScore, setDeductScore] = useState<any>(0);
  const [finalScore, setFinalScore] = useState<number>(75);
  const [myFinalScores, setMyFinalScores] = useState<Record<string, number>>({});

  // Load Grade Cuts & User Submissions
  useEffect(() => {
    async function load() {
      // Fetch exams dynamically
      const e = await ExamService.getExams();
      if (e && e.length > 0) {
        setExams(e);
      } else {
        setExams(INITIAL_EXAMS);
      }

      // Total submissions (dummy + real ones)
      const allSubs = await SubmissionService.getAllSubmissionsAcrossExams();
      
      const cuts: Record<string, number> = {};
      const userSubmissionMap: Record<string, boolean> = {};
      const finalScoresMap: Record<string, number> = {};

      const currentExams = e && e.length > 0 ? e : INITIAL_EXAMS;

      // Check user completed exams
      if (user) {
        for (const exam of currentExams) {
          const mySub = await SubmissionService.getMySubmission(exam.id, user.uid);
          if (mySub) {
            userSubmissionMap[exam.id] = true;
            finalScoresMap[exam.id] = mySub.totalScore || 0;
          }
        }
      }
      setMySubmissions(userSubmissionMap);
      setMyFinalScores(finalScoresMap);

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
  }, [user, userData]);

  // Load and seed difficult question votes
  useEffect(() => {
    if (!user) return;

    // Load user cast votes
    const storedUserVotes = localStorage.getItem('exam_user_votes_v3');
    let loadedUserVotes: Record<string, number[]> = {};
    if (storedUserVotes) {
      try { loadedUserVotes = JSON.parse(storedUserVotes); } catch (e) {}
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

  // Synced loading of saved inputs for selected subject
  useEffect(() => {
    if (!user) return;
    const key = `local_semester_grades_${user.uid}_${gradeCalcSubjectId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMidtermScore(parsed.midterm ?? 80);
        setPerfScore(parsed.performance ?? 90);
        setDeductScore(parsed.deduction ?? 0);
        setFinalScore(parsed.final ?? (myFinalScores[gradeCalcSubjectId] || 75));
      } catch (e) {
        setMidtermScore(80);
        setPerfScore(90);
        setDeductScore(0);
        setFinalScore(myFinalScores[gradeCalcSubjectId] || 75);
      }
    } else {
      setMidtermScore(80);
      setPerfScore(90);
      setDeductScore(0);
      setFinalScore(myFinalScores[gradeCalcSubjectId] || 75);
    }
  }, [gradeCalcSubjectId, myFinalScores, user]);

  // Auto horizontal scrolling loop of predicted grade cuts
  useEffect(() => {
    if (exams.length <= 3) return;
    const maxIndex = Math.ceil(exams.length / 3) - 1;
    const interval = setInterval(() => {
      setSlideIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
    }, 4500); // Autoplay cyclic batch horizontally
    return () => clearInterval(interval);
  }, [exams.length]);

  // Filter voting exams by student's designated ones (unless admin)
  const isAdmin = userData?.role === 'admin';
  const mySelectedSubjectsList = userData?.selectedSubjects || [];
  const votingExams = isAdmin ? exams : exams.filter(e => mySelectedSubjectsList.includes(e.id));

  // If currently selected tab is not in votingExams, auto-select the first available one to prevent mismatch
  useEffect(() => {
    if (user && votingExams.length > 0 && !votingExams.some(e => e.id === selectedVoteExamId)) {
      setSelectedVoteExamId(votingExams[0].id);
    }
  }, [user, votingExams, selectedVoteExamId]);

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
                    : "/exams"
            }
            className="h-16 px-12 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-2xl shadow-indigo-100/50 hover:bg-slate-900 transition-all active:scale-95 text-lg"
          >
            가채점 시작하기
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Grade Cuts Section - Continuous Sliding Slider for Logged-In Users */}
      <section className="max-w-6xl mx-auto px-4">
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
          <div className="space-y-6">
            <div className="flex items-center justify-between max-w-5xl mx-auto px-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">실시간 예측 등급컷</h2>
              </div>
              <span className="text-[10px] font-black tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full uppercase">
                ⚙️ 실시간 순환 활성화 중
              </span>
            </div>

            {/* Slider with indicators */}
            <div className="relative max-w-5xl mx-auto flex items-center gap-4">
              <button
                onClick={() => setSlideIndex(prev => Math.max(0, prev - 1))}
                disabled={slideIndex === 0}
                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:pointer-events-none shadow-sm cursor-pointer shrink-0"
              >
                <span className="text-lg font-bold">←</span>
              </button>

              <div className="flex-1 overflow-hidden py-4">
                <div 
                  className="flex gap-6 transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${slideIndex * 100}%)` }}
                >
                  {Array.from({ length: Math.ceil(exams.length / 3) }).map((_, slideBatchIdx) => {
                    const batchExams = exams.slice(slideBatchIdx * 3, slideBatchIdx * 3 + 3);
                    return (
                      <div key={slideBatchIdx} className="w-full shrink-0 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {batchExams.map((exam) => {
                          const hasSubmitted = !!mySubmissions[exam.id];
                          return (
                            <div
                              key={exam.id}
                              className="p-8 bg-white border-2 border-slate-100 rounded-[36px] shadow-lg shadow-slate-100/60 flex flex-col justify-center items-center text-center space-y-5 hover:border-indigo-300 hover:shadow-xl transition-all"
                            >
                              <p className="text-xs font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-4 py-1.5 rounded-full">
                                {exam.title}
                              </p>
                              <div className="space-y-1.5 font-sans">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">1st Grade Cut</p>
                                <p className="text-5xl font-black text-slate-900 tracking-tighter">
                                  {hasSubmitted || userData?.role === 'admin' ? `${gradeCuts[exam.id] || 0}점` : '??점'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setSlideIndex(prev => Math.min(Math.ceil(exams.length / 3) - 1, prev + 1))}
                disabled={slideIndex >= Math.ceil(exams.length / 3) - 1}
                className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:pointer-events-none shadow-sm cursor-pointer shrink-0"
              >
                <span className="text-lg font-bold">→</span>
              </button>
            </div>

            {/* Slider Indicator Bullets */}
            <div className="flex justify-center gap-2 pt-2">
              {Array.from({ length: Math.ceil(exams.length / 3) }).map((_, idx) => (
                <button
                  key={`slide-indicator-${idx}`}
                  onClick={() => setSlideIndex(idx)}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all duration-300",
                    slideIndex === idx ? "w-8 bg-indigo-600" : "bg-slate-200 hover:bg-slate-350"
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Features Grid */}
      <section className="flex flex-col md:flex-row justify-center items-stretch gap-8 max-w-5xl mx-auto px-4">
        {/* Feature 1: 빠른 답안 입력 */}
        <div className="w-full md:w-1/3 p-8 bg-white border border-slate-200 rounded-[32px] space-y-5 shadow-sm hover:border-indigo-100 transition-colors">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-emerald-50">
            <CheckCircle2 className="text-emerald-600" size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">빠른 답안 입력</h3>
          <p className="text-slate-500 text-sm leading-relaxed">
            간편한 인터페이스로 답안을 1분 만에 입력할 수 있습니다.
          </p>
        </div>

        {/* Feature 2: 실시간 데이터 분석 */}
        <div className="w-full md:w-1/3 p-8 bg-white border border-slate-200 rounded-[32px] space-y-5 shadow-sm hover:border-indigo-100 transition-colors">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-50">
            <BarChart3 className="text-indigo-600" size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">실시간 데이터 분석</h3>
          <p className="text-slate-500 text-sm leading-relaxed">
            사용자들의 데이터를 기반으로 보정하여 정확도 높은 등급컷을 산출합니다.
          </p>
        </div>

        {/* Feature 3: 시험 후기 게시판 */}
        <Link 
          to="/reviews"
          className="w-full md:w-1/3 p-8 bg-white border border-slate-200 hover:border-indigo-300 rounded-[32px] space-y-5 shadow-sm transition-all flex flex-col justify-between group text-left"
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

      {/* My 1st Semester Grade Category (1학기 성적 산정기-가채점 동기화) */}
      {user && (
        <section className="max-w-5xl mx-auto px-4 space-y-8 pt-4">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full text-xs font-black shadow-sm">
              <Sparkles size={14} className="text-rose-500" />
              1학기 최종 변환 내신 예측 및 감점 관리
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
              나의 1학기 성적 계산기
            </h2>
            <p className="text-sm text-slate-400 font-semibold max-w-xl mx-auto leading-relaxed">
              중간고사, 수행평가, 본 가채점 기말점수와 감점을 종합 계산하여 1학기 최종 종합 등급과 백분위 등 동일한 결과 정밀 성적표를 즉시 산출하고 가상 시뮬레이션하십시오!
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-[36px] overflow-hidden shadow-xl shadow-slate-150/30 p-8 md:p-10 space-y-8">
            {/* Subject Selector Tabs for Calculator */}
            <div className="flex flex-wrap gap-2 justify-center border-b border-slate-100 pb-6">
              {votingExams.map((item) => (
                <button
                  key={`calc-sub-tab-${item.id}`}
                  onClick={() => setGradeCalcSubjectId(item.id)}
                  className={cn(
                    "px-5 h-11 rounded-2xl gap-2 text-xs font-black transition-all flex items-center shadow-sm border",
                    gradeCalcSubjectId === item.id 
                      ? "bg-rose-500 border-rose-500 text-white scale-105" 
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-150"
                  )}
                >
                  <Award size={14} />
                  {item.title}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Calculator Input Fields Form */}
              <div className="lg:col-span-6 bg-slate-50/50 rounded-[28px] border border-slate-200/60 p-6 md:p-8 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <span className="text-xs font-black text-slate-400 block uppercase tracking-wider">
                    📌 1학기 예측 원점수 입력란 ({exams.find(e => e.id === gradeCalcSubjectId)?.title || '과목'})
                  </span>

                  {/* Midterm score field */}
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-700 flex justify-between">
                      <span>중간고사 원점수 (반영비율: 35%)</span>
                      <span className="text-slate-400 font-mono font-bold">{midtermScore}점</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={midtermScore}
                      onChange={(e) => setMidtermScore(Math.max(0, Math.min(100, Number(e.target.value || 0))))}
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white shadow-sm font-mono text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    />
                  </div>

                  {/* Expected Performance Assessment Score field */}
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-700 flex justify-between">
                      <span>수행평가 예상 점수 (반영비율: 30%)</span>
                      <span className="text-slate-400 font-mono font-bold">{perfScore}점</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={perfScore}
                      onChange={(e) => setPerfScore(Math.max(0, Math.min(100, Number(e.target.value || 0))))}
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white shadow-sm font-mono text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    />
                  </div>

                  {/* Final Exam score field (Pre-filled from Ga-chaejum automatically, but editable) */}
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-700 flex justify-between">
                      <span>
                        기말고사 성적 (반영비율: 35%)
                        {myFinalScores[gradeCalcSubjectId] !== undefined && (
                          <span className="ml-1.5 text-[10px] text-indigo-650 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full font-sans">가채점 반영</span>
                        )}
                      </span>
                      <span className="text-slate-400 font-mono font-bold">{finalScore}점</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={finalScore}
                      onChange={(e) => setFinalScore(Math.max(0, Math.min(100, Number(e.target.value || 0))))}
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white shadow-sm font-mono text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    />
                  </div>

                  {/* Deductions field (Limited strictly 0 to 200 points) */}
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-700 flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-rose-600">
                        평가 감점 점수 (감산요소)
                        <span className="text-[9px] bg-rose-50 border border-rose-100 text-rose-500 font-bold px-1.5 py-0.5 rounded">0~200점 범위 제한</span>
                      </span>
                      <span className="text-rose-500 font-mono font-black">-{deductScore || 0}점</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      placeholder="감점 점수를 직접 작성해 주세요."
                      value={deductScore}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setDeductScore('');
                          return;
                        }
                        const num = Number(val);
                        if (!isNaN(num)) {
                          setDeductScore(Math.max(0, Math.min(200, num)));
                        }
                      }}
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white shadow-sm font-mono text-sm font-black text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    />
                  </div>
                </div>

                {/* Simulated grades saving trigger with feedback animation */}
                <button
                  type="button"
                  onClick={() => {
                    const key = `local_semester_grades_${user.uid}_${gradeCalcSubjectId}`;
                    localStorage.setItem(
                      key,
                      JSON.stringify({
                        midterm: midtermScore,
                        performance: perfScore,
                        deduction: Number(deductScore || 0),
                        final: finalScore
                      })
                    );
                    const audio = new Audio(); // silent fallback trigger
                    // Trigger dynamic localized notification state
                    const alertKey = `calculator_saved_${gradeCalcSubjectId}`;
                    localStorage.setItem(alertKey, 'true');
                    window.dispatchEvent(new Event('storage'));
                  }}
                  className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all text-xs shadow shadow-slate-300 flex items-center justify-center gap-2 cursor-pointer mt-4"
                >
                  <Sparkles size={14} className="text-rose-400" />
                  현재 1학기 입력 데이터 파일 영구 저장
                </button>
              </div>

              {/* Calculator Output Report card mirroring Ga-Chaejum formatting guidelines */}
              <div className="lg:col-span-6 flex flex-col justify-between bg-gradient-to-br from-rose-50/10 to-rose-500/5 border border-rose-150/60 rounded-[32px] p-6 md:p-8 space-y-6">
                {(() => {
                  const calculatedRaw = (midtermScore * 0.35) + (finalScore * 0.35) + (perfScore * 0.30) - Number(deductScore || 0);
                  const convertedTotal = Math.max(0, Math.min(100, Math.round(calculatedRaw * 10) / 10));
                  
                  // Grade tiers matching relative curve rules
                  const getSimulatedReport = (score: number) => {
                    if (score >= 95) {
                      return {
                        grade: 1,
                        percentile: "상위 2% 이내 (최상위)",
                        color: "text-rose-600 bg-rose-100/50 border-rose-200",
                        comment: "경이로운 학업 성취도입니다! 기말고사와 수행평가에서 감점을 완전히 방어하여 1등급 영예를 격차수립할 예정입니다."
                      };
                    } else if (score >= 88) {
                      return {
                        grade: 2,
                        percentile: "상위 8% 수준 (우수)",
                        color: "text-indigo-650 bg-indigo-50 border-indigo-100",
                        comment: "상위 내신 경쟁구도에서 대단히 유리한 2등급 중심선물입니다. 정교한 취약 유실 보강만 보정하면 1등급 도약도 가능합니다."
                      };
                    } else if (score >= 78) {
                      return {
                        grade: 3,
                        percentile: "상위 18% 수준 (수련)",
                        color: "text-emerald-700 bg-emerald-50 border-emerald-100",
                        comment: "안정적인 3등급 교두보에 도달하였습니다. 기말고사의 오오답 세부 피드백을 통해 2등급으로 확실하게 점프해내십시오."
                      };
                    } else if (score >= 65) {
                      return {
                        grade: 4,
                        percentile: "상위 33% 수준 (보통)",
                        color: "text-amber-700 bg-amber-50 border-amber-150",
                        comment: "상향 보강이 집중 요구되는 4등급 관문입니다. 기말고사 실전 모의와 주요 취약 문항의 집중 풀이를 조언합니다."
                      };
                    } else if (score >= 50) {
                      return {
                        grade: 5,
                        percentile: "상위 52% 수준 (중위)",
                        color: "text-blue-700 bg-blue-50 border-blue-100",
                        comment: "기본과 응용의 혼선을 복정해야 하는 5등급 평형선입니다. 빈출 오답 노트를 꼼꼼히 정리하여 누수 점리를 밀착 차단하세요."
                      };
                    } else if (score >= 35) {
                      return {
                        grade: 6,
                        percentile: "상위 71% 수준 (노력)",
                        color: "text-slate-700 bg-slate-100 border-slate-200",
                        comment: "기반 이론 학습의 보정이 시급한 6등급 노선입니다. 실전에서 자주 쓰는 공식과 어휘 위주의 복습으로 실점 정리를 기해보세요."
                      };
                    } else {
                      return {
                        grade: 7, // 7~9등급
                        percentile: "상위 90% 수준 (밀착 수련)",
                        color: "text-red-600 bg-red-50 border-red-150",
                        comment: "개념 복정이 극도로 시급한 등급입니다. 가채점 약점 부분을 일차별로 점검하여 보충 트레이닝을 권장하고 실전 누수를 막으세요."
                      };
                    }
                  };

                  const rep = getSimulatedReport(convertedTotal);

                  return (
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-rose-500 font-extrabold uppercase tracking-widest block">
                            📰 1학기 최종 융합 가내신 성적표
                          </span>
                          <span className="text-[10px] bg-rose-100 text-rose-600 px-2.5 py-0.5 rounded font-black">
                            실시간 업데이트
                          </span>
                        </div>

                        {/* Visual Stats display rows */}
                        <div className="grid grid-cols-3 gap-3">
                          {/* Col 1: Integrated Raw Score */}
                          <div className="bg-white border border-slate-150/60 p-4 rounded-2xl text-center space-y-1">
                            <span className="text-[10px] font-black text-slate-400">학기 총합 점수</span>
                            <span className="text-xl font-black text-slate-900 block font-mono">{convertedTotal}점</span>
                          </div>
                          
                          {/* Col 2: Converted Relative Grade level */}
                          <div className="bg-white border border-slate-150/60 p-4 rounded-2xl text-center space-y-1">
                            <span className="text-[10px] font-black text-slate-400 font-sans">예상 종합 등급</span>
                            <span className="text-xl font-black text-rose-600 block">{rep.grade}등급</span>
                          </div>

                          {/* Col 3: Converted Percentile Estimation */}
                          <div className="bg-white border border-slate-150/60 p-4 rounded-2xl text-center space-y-1">
                            <span className="text-[10px] font-black text-slate-400 font-sans">예상 백분위</span>
                            <span className="text-[10px] font-black text-slate-700 block truncate mt-2">{rep.percentile}</span>
                          </div>
                        </div>

                        {/* Status Comment area */}
                        <div className={cn("p-5 rounded-2xl border text-xs leading-relaxed font-semibold font-sans mt-2 shadow-sm animate-fade-in", rep.color)}>
                          <div className="flex items-center gap-1.5 font-bold mb-1.5">
                            <Info size={13} />
                            내신 성장 종합 클리닉 레포트
                          </div>
                          {rep.comment}
                        </div>
                      </div>

                      {/* Formulas metadata panel */}
                      <div className="bg-rose-900/5 border border-rose-150/40 p-4 rounded-2xl text-[11px] text-slate-400 space-y-1 bg-white font-medium">
                        <div className="font-bold text-slate-500 flex items-center gap-1">
                          <Flame size={12} className="text-rose-500" />
                          가정 비례 정산 산식 공식 안내
                        </div>
                        <p className="leading-relaxed">
                          • 본 평가 산식은 <strong>[중간고사 35% + 기말고사 35% + 수행평가 30%]</strong>로 합산되어 감점을 직접 제하여 가채점 성적표와 정밀 동일화 분석됩니다.
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Interactive Difficult Question Voting Block (Only shown continuously to logged-in users) */}
      {user && (
        <section className="max-w-5xl mx-auto px-4 space-y-8 pt-4">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-650 px-4 py-1.5 rounded-full text-xs font-black">
              <Flame size={14} className="animate-bounce" />
              오답률 및 변별력 극대화 문항 집계
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
              시험별 어려웠던 문제 실시간 투표
            </h2>
            <p className="text-sm text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">
              친구들과 생각한 가장 오답률이 높고 까다로웠던 고난도 변별력 문항을 선정하고 실시간 가채점 오답 분포를 즉시 시각화하세요!
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-[36px] overflow-hidden shadow-xl shadow-slate-100/30 p-8 md:p-10 space-y-8">
            
            {/* Subject selector Tabs */}
            <div className="flex flex-wrap gap-2 justify-center border-b border-slate-100 pb-6">
              {votingExams.map((item) => (
                <button
                  key={`vote-tab-${item.id}`}
                  onClick={() => setSelectedVoteExamId(item.id)}
                  className={cn(
                    "px-5 h-11 rounded-2xl gap-2 text-xs font-black transition-all flex items-center shadow-sm border",
                    selectedVoteExamId === item.id 
                      ? "bg-slate-900 border-slate-900 text-white scale-105" 
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-150"
                  )}
                >
                  <Award size={14} />
                  {item.title}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Voting Grid Side */}
              <div className="lg:col-span-7 space-y-5">
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                  <span className="text-xs font-black text-slate-700">
                    📍 {selectedExamObj.title} 문항 선택 (1~{selectedExamObj.questionCount}번)
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2.5 py-1 rounded">
                    투표 완료: {activeUserVotedNums.length}개 선택됨
                  </span>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {Array.from({ length: selectedExamObj.questionCount }, (_, idx) => idx + 1).map((qNum) => {
                    const isVotedByMe = activeUserVotedNums.includes(qNum);
                    return (
                      <button
                        key={`vote-item-${selectedVoteExamId}-${qNum}`}
                        type="button"
                        onClick={() => handleToggleVote(qNum)}
                        className={cn(
                          "w-12 h-12 rounded-2xl text-xs font-black transition-all border flex items-center justify-center cursor-pointer",
                          isVotedByMe 
                            ? "bg-indigo-600 border-indigo-600 text-white scale-110 shadow-lg shadow-indigo-150" 
                            : "bg-slate-50 border-slate-150 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
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
                      <p className="text-[10px] text-slate-300 font-medium">위 버튼을 눌러 먼저 직접 투표해 보세요!</p>
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

                <div className="text-[10px] text-slate-400 leading-relaxed font-medium bg-white/70 border border-slate-100 p-3.5 rounded-2xl flex gap-2">
                  <Info size={14} className="text-slate-400 shrink-0 select-none mt-0.5" />
                  <span>실시간 가채점 및 오답률 투표 결과이므로 공식 성적표 발표 시 오답 문항 분포가 달라질 수 있습니다.</span>
                </div>
              </div>
            </div>

          </div>
        </section>
      )}
    </motion.div>
  );
}
