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
  Grid,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { SubmissionService, GradeCalculator, ExamService, isExamSupported, getExamCapacity, SettingsService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';
import { Submission, Question } from '@/src/types';
import { db, isPlaceholder } from '@/src/lib/firebase';
import { getDocs, collection } from 'firebase/firestore';

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
  const [siteSettings, setSiteSettings] = useState<any>(null);

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
        const [sub, allSubs, qs, examsList, settings] = await Promise.all([
          SubmissionService.getMySubmission(examId, effectiveUserId),
          SubmissionService.getAllSubmissions(examId),
          ExamService.getQuestions(examId),
          ExamService.getExams(),
          SettingsService.getSettings()
        ]);

        setSiteSettings(settings);

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

        // Load internal users DB for detailed nickname mappings and privacy settings from Firestore & Local
        let firestoreUsers: Record<string, any> = {};
        if (!isPlaceholder && db) {
          try {
            const querySnap = await getDocs(collection(db, 'users'));
            querySnap.forEach((doc) => {
              firestoreUsers[doc.id] = doc.data();
            });
          } catch (e) {
            console.error("Failed to load users from Firestore in Results", e);
          }
        }

        const dbStr = localStorage.getItem('exam_app_users_db');
        const localUsers = dbStr ? JSON.parse(dbStr) : {};
        const combinedUsers = { ...localUsers, ...firestoreUsers };
        setUsersMap(combinedUsers);
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

  if (examId && !isExamSupported(examId)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 max-w-md mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">미지원 과목입니다</h2>
        <p className="text-sm text-slate-500">
          선택하신 과목은 현재 등급컷.com에서 정밀 분석을 지원하지 않는 과목입니다. 
          지원 대상 과목만 입력해 주시기 바랍니다.
        </p>
        <Link 
          to="/exams"
          className="h-11 px-6 inline-flex items-center justify-center bg-slate-900 hover:bg-black text-white rounded-xl font-semibold text-sm transition-all"
        >
          배정 과목 목록으로 이동
        </Link>
      </div>
    );
  }

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

  const subConf = (siteSettings || (() => {
    const raw = localStorage.getItem('exam_app_site_settings_v3');
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
    return null;
  })())?.subjects?.[examId || ''] || {
    minResponseRate: 40,
    scoreChangeDiff: 1,
    discloseGrading: true,
    discloseStats: true,
    allowGuestView: false
  };

  const isAdmin = userData?.role === 'admin';
  const isGradingVisible = subConf.discloseGrading !== false || isAdmin;

  const totalCapacity = getExamCapacity(examId || '');
  const realSubmissionsCount = allSubmissions.filter(s => !s.isDummy).length;
  const responseRate = totalCapacity > 0 ? (realSubmissionsCount / totalCapacity) * 100 : 0;
  const responseRatePercent = responseRate.toFixed(1);

  // Check if simulation was triggered to override
  const statsStatureKey = `exam_stats_stature_${examId}`;
  const statsStatureRaw = localStorage.getItem(statsStatureKey);
  let isStatsForceStable = false;
  if (statsStatureRaw) {
    try {
      isStatsForceStable = JSON.parse(statsStatureRaw).forceStable === true;
    } catch (e) {}
  }

  const isResponseRateMet = responseRate >= (subConf.minResponseRate || 0);
  const isStatsVisible = isAdmin || (isGradingVisible && subConf.discloseStats !== false && (isResponseRateMet || isStatsForceStable));
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
            <h2 className="text-7xl font-black">{isGradingVisible ? `${submission.totalScore}점` : "비공개"}</h2>
          </div>
          <p className="text-indigo-100/80 text-sm font-medium">
            {isGradingVisible ? `${submission.answers.length}문항 중 ${correctCount}문항 정답` : "채점 결과 비공개 상태"}
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
              {!isGradingVisible ? (
                <span className="text-2xl text-slate-400">비공개</span>
              ) : isStatsVisible ? (
                <>{stats?.grade || '-'}<span className="text-2xl ml-1 text-slate-400 font-extrabold">등급</span></>
              ) : subConf.discloseStats === false ? (
                <span className="text-2xl text-slate-400">비공개</span>
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
              {!isGradingVisible ? (
                <span className="text-2xl text-slate-400">비공개</span>
              ) : isStatsVisible ? (
                isRankVisible ? (
                  <>{stats?.percentile || '-'}<span className="text-2xl ml-1 text-slate-400">%</span></>
                ) : (
                  <span className="text-2xl text-slate-400">비공개</span>
                )
              ) : subConf.discloseStats === false ? (
                <span className="text-2xl text-slate-400">비공개</span>
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
              {!isGradingVisible ? (
                <span className="text-2xl text-slate-400">비공개</span>
              ) : isStatsVisible ? (
                isRankVisible ? (
                  <>{stats?.rank || '-'}<span className="text-2xl ml-1 text-slate-400">/ {stats?.totalParticipants || 400}위</span></>
                ) : (
                  <span className="text-2xl text-slate-400">비공개</span>
                )
              ) : subConf.discloseStats === false ? (
                <span className="text-2xl text-slate-400">비공개</span>
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
        !isGradingVisible ? (
          <div className="py-16 text-center space-y-4 bg-white p-8 border border-slate-200 rounded-[32px] shadow-sm">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">채점 결과 비공개</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              해당 과목은 현재 채점 비공개 설정 상태입니다. 관리자가 채점 결과를 공개하기 전까지는 채점 상세 내용을 조회할 수 없습니다.
            </p>
          </div>
        ) : (
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
        )
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
                <h4 className="text-lg font-black text-slate-800">종합 통계 리포트 준비 중 / 비공개</h4>
                {!isGradingVisible ? (
                  <p className="text-sm text-slate-400 max-w-md mx-auto font-medium leading-relaxed">
                    해당 과목은 현재 채점 결과 비공개 설정 상태입니다. 관리자가 채점 결과를 공개한 후 조회하실 수 있습니다.
                  </p>
                ) : subConf.discloseStats === false ? (
                  <p className="text-sm text-slate-400 max-w-md mx-auto font-medium leading-relaxed">
                    해당 과목은 현재 통계 비공개 설정 상태입니다. 관리자가 통계를 공개한 후 조회하실 수 있습니다.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400 max-w-md mx-auto font-medium leading-relaxed">
                      공개 최소 응답률 조건({subConf.minResponseRate || 0}%)을 충족해야 통계가 실시간 자동 공개됩니다.
                    </p>
                    <div className="inline-flex flex-col items-center gap-1 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 mt-2">
                      <span className="text-xs font-bold text-slate-600">⏱️ 실시간 정산 응답률 현황</span>
                      <span className="text-sm font-black text-indigo-650 font-sans">
                        {realSubmissionsCount}명 제출 / {totalCapacity}명 정원 ({responseRatePercent}%)
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold mt-1">
                        필요 최소 응답률: {subConf.minResponseRate || 0}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {isGradingVisible && subConf.discloseStats !== false && (
                <div className="pt-2">
                  <button
                    onClick={triggerSimulation}
                    className="px-5 h-10 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-xl leading-none text-xs font-black hover:bg-indigo-100/50 transition-all active:scale-95"
                  >
                    ⚡ 시뮬레이션: 강제 공개 처리
                  </button>
                </div>
              )}
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

              {/* 과목 종합 상위 20% 등수표 (급간포진현황 대체) */}
              {(() => {
                const totalCapacity = allSubmissions.length || 200;
                const realSubmissionsCount = allSubmissions.filter(s => !s.isDummy).length;
                const responseRatePercent = totalCapacity > 0 ? ((realSubmissionsCount / totalCapacity) * 100).toFixed(1) : "0.0";

                return (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h4 className="text-sm font-extrabold text-slate-800">과목 종합 상위 20% 우수자 등수표</h4>
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full border border-indigo-100/50 uppercase tracking-tight">
                          현재 응답률: {realSubmissionsCount}/{totalCapacity} ({responseRatePercent}%)
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-bold">
                        * 전체 학업 인원 중 상위 20% 이내의 실시간 우수자 등수표입니다.
                      </span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center w-20">등수</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">학번</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">가채점 점수</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">백분위</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">등급</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(() => {
                              const top20Limit = Math.ceil(rankedList.length * 0.20);
                              const top20Submissions = rankedList.slice(0, top20Limit);
                              
                              if (top20Submissions.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                                      집계된 데이터가 없습니다.
                                    </td>
                                  </tr>
                                );
                              }

                              return top20Submissions.map((sub) => {
                                const isMe = sub.userId === effectiveUserId;
                                const displayName = getDisplayName(sub.userId, sub.isDummy);
                                const grade = GradeCalculator.calculateGrade(sub.rank / rankedList.length * 100);

                                return (
                                  <tr 
                                    key={sub.id} 
                                    className={cn(
                                      "hover:bg-slate-50/50 transition-colors",
                                      isMe ? "bg-indigo-50/40 font-bold" : "",
                                      grade === 1 && !isMe ? "bg-emerald-50/10" : ""
                                    )}
                                  >
                                    <td className="px-6 py-4 text-center">
                                      <div className={cn(
                                        "w-7 h-7 rounded-full flex items-center justify-center font-black text-xs mx-auto",
                                        sub.rank === 1 ? "bg-amber-400 text-white shadow-sm" : 
                                        sub.rank === 2 ? "bg-slate-300 text-white shadow-sm" :
                                        sub.rank === 3 ? "bg-orange-300 text-white shadow-sm" : "text-slate-500 bg-slate-50"
                                      )}>
                                        {sub.rank}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-2">
                                        <span className={cn("text-sm", isMe ? "text-indigo-600 font-extrabold" : "text-slate-800 font-semibold")}>
                                          {displayName}
                                        </span>
                                        {isMe && (
                                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-600 text-white uppercase font-sans">
                                            나
                                          </span>
                                        )}
                                        {sub.isDummy && (
                                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 border border-slate-150">
                                            시뮬레이션
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <span className="text-base font-black text-slate-900">{sub.totalScore}</span>
                                      <span className="text-xs text-slate-400 ml-1">점</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className="text-xs font-bold text-indigo-600">
                                        {(100 - (sub.rank / rankedList.length * 100)).toFixed(0)}%
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <span className={cn(
                                        "text-xs font-black px-2 py-0.5 rounded border",
                                        grade === 1 ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                        grade === 2 ? "bg-blue-50 text-blue-600 border-blue-100" :
                                        grade === 3 ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                                        "bg-slate-50 text-slate-600 border-slate-100"
                                      )}>
                                        {grade}등급
                                      </span>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
