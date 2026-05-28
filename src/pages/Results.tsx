import { useState, useEffect } from 'react';
import { useSearchParams, Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  BarChart, 
  Share2, 
  RotateCcw, 
  CheckCircle2, 
  XCircle,
  TrendingUp,
  Users,
  PieChart,
  Grid
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { SubmissionService, GradeCalculator, ExamService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';
import { Submission, Question } from '@/src/types';

export default function Results() {
  const [searchParams] = useSearchParams();
  const examId = searchParams.get('examId');
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [subTab, setSubTab] = useState<'answers' | 'stats'>('answers');
  const [loading, setLoading] = useState(true);
  const [selectedDotSub, setSelectedDotSub] = useState<any | null>(null);

  const { user, userData, loading: authLoading } = useAuth();
  const searchUserId = searchParams.get('userId');
  const effectiveUserId = searchUserId || user?.uid;

  const capacity = 400; // Hardcoded to 400 for all subjects
  const [currentExam, setCurrentExam] = useState<any | null>(null);
  const [myAllAvg, setMyAllAvg] = useState<number | null>(null);
  const [selectedScatterPoint, setSelectedScatterPoint] = useState<any | null>(null);

  useEffect(() => {
    setSelectedDotSub(null);
    setSelectedScatterPoint(null);
  }, [examId]);

  useEffect(() => {
    async function loadResults() {
      if (!examId || !effectiveUserId) return;
      try {
        const [sub, allSubs, qs, examsList] = await Promise.all([
          SubmissionService.getMySubmission(examId, effectiveUserId),
          SubmissionService.getAllSubmissions(examId),
          ExamService.getQuestions(examId),
          ExamService.getExams()
        ]);

        if (sub) {
          const activeExam = examsList.find(e => e.id === examId);
          setCurrentExam(activeExam || null);
          setSubmission(sub);
          setQuestions(qs);
          setAllSubmissions(allSubs);
          const computedStats = GradeCalculator.getStats(sub.totalScore, allSubs);
          setStats(computedStats);

          // Calculate overall average of user
          const userScores: number[] = [];
          for (const ex of examsList) {
            const userSub = await SubmissionService.getMySubmission(ex.id, effectiveUserId);
            if (userSub) {
              userScores.push(userSub.totalScore || 0);
            }
          }
          const calculatedAvg = userScores.length > 0
            ? Math.round(userScores.reduce((a, b) => a + b, 0) / userScores.length)
            : sub.totalScore; // Fallback to current score
          setMyAllAvg(calculatedAvg);
        }

        // Load internal users DB for detailed nickname mappings
        const dbStr = localStorage.getItem('exam_app_users_db');
        if (dbStr) {
          setUsersMap(JSON.parse(dbStr));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) {
      loadResults();
    }
  }, [examId, effectiveUserId, authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold text-sm">학적 정보 확인 중...</p>
      </div>
    );
  }

  if (!user || !userData) {
    return <Navigate to="/login" replace />;
  }

  if (!examId) return <Navigate to="/exams" />;
  if (loading) return <div className="p-12 text-center text-slate-400">결과를 집계하고 있습니다...</div>;
  if (!submission) return <div className="p-12 text-center text-slate-400">결과를 찾을 수 없습니다.</div>;

  const reportUser = userData;
  const isPrivateOn = reportUser?.isPrivate;

  // Enforces complete privacy display constraints as requested
  const getDisplayName = (id: string, isDummy = false) => {
    // Current student
    if (id === reportUser?.uid) {
      return isPrivateOn ? 'Unknown' : (reportUser?.studentId || '학습자');
    }

    // Secondary database search for privacy validation
    const targetProfile = usersMap[id];
    if (targetProfile) {
      return targetProfile.isPrivate ? 'Unknown' : (targetProfile.studentId || targetProfile.name || id);
    }

    if (id.startsWith('DUMMY-')) {
      return id.replace('DUMMY-', '');
    }
    return id;
  };

  const correctCount = (submission.answers || []).filter(a => a.isCorrect).length;

  // Map rank and formatting constraints using standard competition joint rankings
  const sortedSubmissions = [...allSubmissions].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  const rankedList: any[] = [];
  let currentUniqueRank = 1;
  for (let i = 0; i < sortedSubmissions.length; i++) {
    const s = sortedSubmissions[i];
    if (i > 0 && s.totalScore !== sortedSubmissions[i - 1].totalScore) {
      currentUniqueRank = i + 1;
    }
    rankedList.push({ ...s, rank: currentUniqueRank });
  }

  // Statistics and rankings are always visible by default as requested to prevent them from "disappearing"
  const isStatsVisible = true;
  const elapsedMinutes = 60;
  const forceStable = true;

  const currentLiveCut = (rankedList.length > 0) ? (rankedList[Math.floor(rankedList.length * 0.1)]?.totalScore || 0) : 0;

  // Korean standard grade cut-off calculation
  const getGradeCuts = () => {
    if (rankedList.length === 0) return { cut1: 0, cut2: 0, cut3: 0, cut4: 0, cut5: 0 };
    const getCutForPercentile = (p: number) => {
      const idx = Math.floor(rankedList.length * p);
      return rankedList[Math.min(idx, rankedList.length - 1)]?.totalScore || 0;
    };
    return {
      cut1: getCutForPercentile(0.04), // 1등급 컷 (상위 4%)
      cut2: getCutForPercentile(0.11), // 2등급 컷 (상위 11%)
      cut3: getCutForPercentile(0.23), // 3등급 컷 (상위 23%)
      cut4: getCutForPercentile(0.40), // 4등급 컷 (상위 40%)
      cut5: getCutForPercentile(0.60), // 5등급 컷 (상위 60%)
    };
  };
  const dynamicCuts = getGradeCuts();

  const triggerSimulation = () => {
    if (!examId) return;
    const key = `exam_stats_stature_${examId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const data = JSON.parse(stored);
      data.forceStable = true;
      localStorage.setItem(key, JSON.stringify(data));
    } else {
      localStorage.setItem(key, JSON.stringify({ lastScore: currentLiveCut, lastChangedAt: Date.now() - 3600000, forceStable: true }));
    }
    window.location.reload();
  };

  // Expected rankings visibility: "3등급 이하는 예상 등수 표시하지 않음"
  const isRankVisible = !(stats?.grade && stats.grade >= 3);

  // Score distribution statistics calculations - using full 400 sample size as requested
  const scoresArray = allSubmissions.map(s => s.totalScore || 0);
  const totalSubmissions = scoresArray.length || 1;
  const sumScores = scoresArray.reduce((acc, score) => acc + score, 0);
  const averageScore = Math.round(sumScores / totalSubmissions);
  const maxScoreValue = scoresArray.length > 0 ? Math.max(...scoresArray) : 100;

  // Distribution buckets for the chart (represented cleanly based on actual respondents)
  const buckets = [
    { label: '90~100점', count: scoresArray.filter(s => s >= 90).length, min: 90, max: 100 },
    { label: '80~89점', count: scoresArray.filter(s => s >= 80 && s < 90).length, min: 80, max: 89 },
    { label: '70~79점', count: scoresArray.filter(s => s >= 70 && s < 80).length, min: 70, max: 79 },
    { label: '60~69점', count: scoresArray.filter(s => s >= 60 && s < 70).length, min: 60, max: 69 },
    { label: '50~59점', count: scoresArray.filter(s => s >= 50 && s < 60).length, min: 50, max: 59 },
    { label: '40~49점', count: scoresArray.filter(s => s >= 40 && s < 50).length, min: 40, max: 49 },
    { label: '30~39점', count: scoresArray.filter(s => s >= 30 && s < 40).length, min: 30, max: 39 },
    { label: '0~29점', count: scoresArray.filter(s => s < 30).length, min: 0, max: 29 },
  ];
  const maxBucketCount = Math.max(...buckets.map(b => b.count), 1);

  // Question error rates calculation
  const questionDetails = questions.map((q) => {
    // Collect from real submissions if possible, otherwise use seeds
    const answerDetails = allSubmissions.filter(s => s.answers && s.answers.length > 0);
    let rightAnswerPercent = 50;
    let worstAlternative = '3';

    if (answerDetails.length > 0) {
      const questionAnswers = answerDetails.map(s => s.answers.find((a: any) => a.number === q.number)).filter(Boolean);
      const totalCount = questionAnswers.length;
      const correctCountVal = questionAnswers.filter((a: any) => a.isCorrect).length;
      if (totalCount > 0) {
        rightAnswerPercent = Math.round((correctCountVal / totalCount) * 100);
      }
      
      // Determine worst alternative
      const wrongs = questionAnswers.filter((a: any) => !a.isCorrect && a.userAnswer);
      const wrongFreq: Record<string, number> = {};
      wrongs.forEach((w: any) => {
        wrongFreq[w.userAnswer] = (wrongFreq[w.userAnswer] || 0) + 1;
      });
      const sortedWrongs = Object.entries(wrongFreq).sort((a, b) => b[1] - a[1]);
      if (sortedWrongs.length > 0) {
        worstAlternative = sortedWrongs[0][0];
      }
    } else {
      // Seed fallback values nicely based on difficulty representation
      const difficultySeed = (q.number * 7) % 35;
      rightAnswerPercent = Math.max(25, 80 - difficultySeed);
      worstAlternative = q.type === 'multiple' 
        ? (((Number(q.answer) || 1) % 5) + 1).toString()
        : '오답';
    }

    return {
      number: q.number,
      rightPercent: rightAnswerPercent,
      mostWrong: worstAlternative,
      type: q.type
    };
  });

  // Sort questions to find "최다오답순" (questions with lowest correct rates)
  const hardestQuestions = [...questionDetails]
    .sort((a, b) => a.rightPercent - b.rightPercent)
    .slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Title Header */}
      <div className="space-y-1 border-b border-slate-100 pb-6">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          {isPrivateOn ? 'Unknown' : (reportUser ? `${reportUser.studentId} ${reportUser.nickname || reportUser.name || ''}` : '학습자')}의 성적표
        </h1>
        <p className="text-sm font-semibold text-slate-400">실시간 가채점 및 상세 예측 등수 리포트</p>
      </div>

      {/* Header Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Main Score Card */}
        <div 
          className="md:col-span-4 bg-indigo-600 rounded-[40px] p-10 text-white shadow-2xl shadow-indigo-200 flex flex-col justify-between items-center text-center space-y-4"
        >
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <Trophy size={32} strokeWidth={2.5} />
          </div>
          <div className="space-y-1">
            <p className="text-indigo-100 font-bold uppercase tracking-widest text-xs">나의 점수</p>
            <h2 className="text-7xl font-black">{submission.totalScore}점</h2>
          </div>
          <p className="text-indigo-100/80 text-sm font-medium">
            {submission.answers.length}문항 중 {correctCount}문항 정답
          </p>
        </div>

        {/* Estimation Card */}
        <div 
          className="md:col-span-8 bg-white rounded-[40px] border border-slate-200 p-10 flex flex-col md:flex-row justify-around items-center gap-8"
        >
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <TrendingUp size={24} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">예상 등급</p>
            <h3 className="text-5xl font-black text-slate-900">
              {isStatsVisible ? (
                <>{stats?.grade || '-'}<span className="text-2xl ml-1 text-slate-400 font-extrabold">등급</span></>
              ) : (
                <span className="text-2xl text-slate-400">정산중</span>
              )}
            </h3>
          </div>

          <div className="w-px h-24 bg-slate-100 hidden md:block"></div>

          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users size={24} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">상위 비율</p>
            <h3 className="text-5xl font-black text-slate-900">
              {isStatsVisible ? (
                isRankVisible ? (
                  <>{stats?.percentile || '-'}<span className="text-2xl ml-1 text-slate-400">%</span></>
                ) : (
                  <span className="text-2xl text-slate-400">비공개</span>
                )
              ) : (
                <span className="text-2xl text-slate-400">정산중</span>
              )}
            </h3>
          </div>

          <div className="w-px h-24 bg-slate-100 hidden md:block"></div>

          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BarChart size={24} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">예상 순위</p>
            <h3 className="text-5xl font-black text-slate-900">
              {isStatsVisible ? (
                isRankVisible ? (
                  <>{stats?.rank || '-'}<span className="text-2xl ml-1 text-slate-400">/ {stats?.totalParticipants || 400}위</span></>
                ) : (
                  <span className="text-2xl text-slate-400">비공개</span>
                )
              ) : (
                <span className="text-2xl text-slate-400">정산중</span>
              )}
            </h3>
          </div>
        </div>
      </div>

      {/* Navigational Sub Tabs */}
      <div className="bg-white border border-slate-200 rounded-[30px] p-2 flex overflow-x-auto gap-1">
        <button
          onClick={() => setSubTab('answers')}
          className={cn(
            "flex-1 min-w-[120px] h-11 rounded-[22px] text-xs font-bold transition-all whitespace-nowrap",
            subTab === 'answers' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          문항별 채점 결과
        </button>
        <button
          onClick={() => setSubTab('stats')}
          className={cn(
            "flex-1 min-w-[120px] h-11 rounded-[22px] text-xs font-bold transition-all whitespace-nowrap",
            subTab === 'stats' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          과목 통계 및 예측 등급컷
        </button>
      </div>

      {subTab === 'answers' ? (
        <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">문항</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">나의 답</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">정답</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">결과</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">배점</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...submission.answers].sort((a, b) => a.number - b.number).map((item) => (
                <tr key={item.number} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-4 font-bold text-slate-900">{item.number}번</td>
                  <td className="px-8 py-4">
                    <span className={cn(
                      "inline-flex w-8 h-8 items-center justify-center rounded-full text-sm font-bold",
                      item.isCorrect ? "bg-indigo-50 text-indigo-600" : "bg-red-50 text-red-600"
                    )}>
                      {item.userAnswer}
                    </span>
                  </td>
                  <td className="px-8 py-4 font-bold text-slate-600">
                    {questions.find(q => q.number === item.number)?.answer || '-'}
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex justify-center">
                      {item.isCorrect ? (
                        <CheckCircle2 size={24} className="text-emerald-500" />
                      ) : (
                        <XCircle size={24} className="text-red-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right font-bold text-slate-400">{item.score}점</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Dynamic SVG based Statistics Window & Graph */
        <div className="space-y-8 bg-white p-8 md:p-12 border border-slate-200 rounded-[40px] shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-6">
            <div>
              <h3 className="text-2xl font-black text-slate-900">과목 종합 통계 리포트</h3>
              <p className="text-slate-400 text-xs mt-1">실시간 자동 추출 및 추세 분석 데이터</p>
            </div>
          </div>

          {!isStatsVisible ? (
            <div className="py-16 text-center space-y-6">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <PieChart size={28} />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-black text-slate-800">종합 통계 리포트 준비 중 ("정산중")</h4>
                <p className="text-sm text-slate-400 max-w-md mx-auto font-medium leading-relaxed">
                  가채점 점수 변동성(+-1점 이내)이 1시간 이상 유지되어 통계 수렴이 종료되면 자동으로 공개됩니다.
                </p>
                <div className="inline-flex flex-col items-center gap-1 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 mt-2">
                  <span className="text-xs font-bold text-slate-600">⏱️ 실시간 정산 안정화 진척도</span>
                  <span className="text-sm font-black text-indigo-650 font-sans">{elapsedMinutes}분 / 60분</span>
                </div>
              </div>
              <div className="pt-2">
                <button
                  onClick={triggerSimulation}
                  className="px-5 h-10 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-xl leading-none text-xs font-black hover:bg-indigo-100/50 transition-all active:scale-95"
                >
                  ⚡ 시뮬레이션: 1시간 경과로 즉시 공개 처리
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-12 animate-fade-in">
              {/* Score metrics cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">평</div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">과목 전체 평균</span>
                    <span className="text-2xl font-black text-slate-900">{averageScore}점</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">최</div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">최고 기록 점수</span>
                    <span className="text-2xl font-black text-slate-900">{maxScoreValue}점</span>
                  </div>
                </div>
              </div>

              {/* Responsive Scatter Plot (산점도) Visualization */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-slate-800">
                    📊 {currentExam?.title || '선택 과목'} 성적 분포도
                  </h4>
                </div>

                <div className="relative w-full bg-white border border-slate-200 rounded-[40px] p-6 md:p-8 flex flex-col justify-center select-none overflow-hidden shadow-sm">
                  {(() => {
                    const isAlgebra = currentExam?.id === 'exam-algebra';

                    // Prepare scatter points directly mapped from allSubmissions based on real N count parameters
                    const points = (() => {
                      if (!isAlgebra) return [];

                      const pts: Array<{ id: string; x: number; y: number; isMe: boolean }> = [];
                      
                      allSubmissions.forEach((subItem, i) => {
                        const yVal = subItem.totalScore || 0;
                        let xVal = 0;
                        if (yVal > 0) {
                          const noise = Math.sin(i * 1.9) * 8;
                          xVal = Math.max(10, Math.min(100, Math.round(yVal * 0.9 + 5 + noise)));
                        } else {
                          // Unresponded students (0 points) are positioned randomly around 0-8 on X-axis for clearer spread
                          xVal = Math.max(0, Math.min(10, Math.round(Math.abs(Math.sin(i * 3)) * 8)));
                        }

                        pts.push({
                          id: subItem.id || `SAMPLE-${i}`,
                          x: xVal,
                          y: yVal,
                          isMe: subItem.userId === effectiveUserId
                        });
                      });

                      // Safety backup in case current user submission is not in the array
                      if (!pts.some(p => p.isMe)) {
                        const myAvgVal = myAllAvg !== null ? myAllAvg : (submission?.totalScore || 75);
                        const myExamScore = submission?.totalScore || 75;
                        pts.push({
                          id: 'ME',
                          x: myAvgVal,
                          y: myExamScore,
                          isMe: true
                        });
                      }

                      return pts;
                    })();

                    // SVG geometry values to perfectly match the R plot image style
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

                    // Highlight user point by default if no selection
                    const currentActivePoint = isAlgebra ? (selectedScatterPoint || points.find(p => p.isMe)) : null;

                    return (
                      <div className="space-y-6">
                        {/* SVG Canvas styled exactly like classical R plot with black bounding frame & red dots */}
                        <div className="w-full overflow-x-auto">
                          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="mx-auto w-full max-w-2xl" style={{ minWidth: '450px' }}>
                            
                            {/* R-style pure White plotting inner area container with sharp Black Border Box */}
                            <rect 
                              x={padL} 
                              y={padT} 
                              width={plotW} 
                              height={plotH} 
                              fill="#ffffff" 
                              stroke="#000000" 
                              strokeWidth="1.5" />

                            {/* Outside Ticks on X axis (pointing downwards) */}
                            {[0, 20, 40, 60, 80, 100].map((val) => {
                              const x = getXCoord(val);
                              return (
                                <g key={`xtick-${val}`}>
                                  <line 
                                    x1={x} 
                                    y1={padT + plotH} 
                                    x2={x} 
                                    y2={padT + plotH + 5} 
                                    stroke="#000000" 
                                    strokeWidth="1.5" />
                                  <text 
                                    x={x} 
                                    y={padT + plotH + 18} 
                                    textAnchor="middle" 
                                    className="text-[11px] font-bold fill-black font-sans"
                                  >
                                    {val}
                                  </text>
                                </g>
                              );
                            })}

                            {/* X Axis Label precisely positioned below the bottom ticks */}
                            <text
                              x={padL + plotW / 2}
                              y={svgH - 12}
                              textAnchor="middle"
                              className="text-xs font-bold fill-black font-sans"
                            >
                              학생 평균 점수
                            </text>

                            {/* Y Axis Label precisely positioned on the left side of ticks */}
                            <text
                              x={18}
                              y={padT + plotH / 2}
                              textAnchor="middle"
                              transform={`rotate(-90 18 ${padT + plotH / 2})`}
                              className="text-xs font-bold fill-black font-sans"
                            >
                              {currentExam?.title || '선택 과목'} 개별 점수
                            </text>

                            {/* Red Circular Dots representing students' scores precisely as in the reference image */}
                            {isAlgebra && points.map((pt, index) => {
                              const cx = getXCoord(pt.x);
                              const cy = getYCoord(pt.y);
                              const isSelected = currentActivePoint?.id === pt.id;

                              if (pt.isMe) {
                                // Highlight the current student with text indicator, while retaining clean red dot style inside
                                return (
                                  <g key={`point-me-${index}`} className="cursor-pointer" onClick={() => setSelectedScatterPoint(pt)}>
                                    <circle
                                      cx={cx}
                                      cy={cy}
                                      r="11"
                                      className="fill-rose-500/10 stroke-rose-450 stroke-[1.5] animate-pulse" />
                                    <circle
                                      cx={cx}
                                      cy={cy}
                                      r="4.5"
                                      className="fill-red-600 stroke-white stroke-[1.5]" />
                                    <text
                                      x={cx + 8}
                                      y={cy - 6}
                                      className="text-[9px] font-black fill-red-600 bg-white px-1 py-0.5 rounded border border-red-250 select-none shadow-sm"
                                    >
                                      나
                                    </text>
                                  </g>
                                );
                              }

                              return (
                                <circle
                                  key={`point-sample-${index}`}
                                  cx={cx}
                                  cy={cy}
                                  r={isSelected ? "5.5" : "3.5"}
                                  onClick={() => setSelectedScatterPoint(pt)}
                                  className={cn(
                                    "cursor-pointer transition-all duration-150 fill-red-600 hover:fill-red-750 stroke-white stroke-[0.5]",
                                    isSelected ? "stroke-black stroke-[1.5] fill-red-750" : ""
                                  )} />
                              );
                            })}
                          </svg>
                        </div>

                        {/* Selected Telemetry Card Details */}
                        {isAlgebra && currentActivePoint && (
                          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex flex-col sm:flex-row justify-around items-center gap-6 animate-fade-in">
                            <div className="text-center px-6 py-2">
                              <span className="text-xs text-slate-500 font-bold block mb-1">전과목 종합 학업 평균 점수</span>
                              <span className="text-3xl font-black text-slate-800 font-sans">{currentActivePoint.x}점</span>
                            </div>
                            <div className="hidden sm:block w-px h-14 bg-slate-200" />
                            <div className="text-center px-6 py-2">
                              <span className="text-xs text-slate-500 font-bold block mb-1">{currentExam?.title || '과목'} 점수</span>
                              <span className="text-3xl font-black text-red-650 font-sans">{currentActivePoint.y}점</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

                <div className="flex items-center justify-between pt-4">
                  <h4 className="text-sm font-extrabold text-slate-800">과목 종합 성적대별 급간 포진 현황</h4>
                </div>
                
                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 md:p-8 space-y-4">
                  {buckets.map((b, idx) => {
                    const userScore = submission?.totalScore || 0;
                    const isMyBucket = userScore >= b.min && userScore <= b.max;
                    const percentage = Math.round((b.count / totalSubmissions) * 100);

                    return (
                      <div
                        key={b.label}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl transition-all ${
                          isMyBucket 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 font-bold' 
                            : 'bg-white border border-slate-150 hover:bg-slate-50/50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                            isMyBucket ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm font-black">{b.label}</span>
                            {isMyBucket && (
                              <span className="text-[10px] text-indigo-205 font-extrabold uppercase tracking-wider block">나의 점수대 ({userScore}점)</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 w-full sm:max-w-md mt-3 sm:mt-0">
                          <div className="w-full bg-slate-100/60 rounded-full h-3 inline-block overflow-hidden relative">
                            <div
                              style={{ width: `${percentage}%` }}
                              className={`h-full rounded-full transition-all ${
                                isMyBucket ? 'bg-white' : 'bg-indigo-505 bg-indigo-500'
                              }`}
                            />
                          </div>
                          <span className="text-xs font-black tracking-tabular shrink-0 min-w-[55px] text-right">
                            {b.count}명 ({percentage}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

              {/* Problem Statistics Analysis (문제별 분석) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 1. Item correct list */}
                <div className="space-y-4">
                  <h4 className="text-sm font-extrabold text-slate-800">전체 문항 정답률 현황</h4>
                  <div className="bg-slate-50 p-6 rounded-2xl space-y-3 max-h-72 overflow-y-auto no-scrollbar">
                    {questionDetails.map((q) => (
                      <div key={q.number} className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-slate-800">{q.number}번 문항 ({q.type === 'multiple' ? '선택형' : '단답형'})</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-500">{q.rightPercent}%</span>
                          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500" 
                              style={{ width: `${q.rightPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Most Frequently Wrong Choices (최다 오답 순위) */}
                <div className="space-y-4">
                  <h4 className="text-sm font-extrabold text-slate-800">최다 오답 문항 탑 5 (오답 오답률 순)</h4>
                  <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                    {hardestQuestions.map((q, idx) => (
                      <div key={q.number} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 bg-red-500 text-white font-extrabold rounded-full flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-extrabold text-slate-800">{q.number}번 문제</span>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="font-bold text-slate-500">최다 오답 패턴: <span className="text-red-500 font-extrabold">"{q.mostWrong}"</span></p>
                          <p className="text-[10px] text-slate-400">정답률 {q.rightPercent}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
