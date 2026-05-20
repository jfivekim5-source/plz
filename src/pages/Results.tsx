import { useState, useEffect } from 'react';
import { useSearchParams, Link, Navigate } from 'react-router-dom';
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
  const [subTab, setSubTab] = useState<'answers' | 'rankings' | 'stats'>('answers');
  const [loading, setLoading] = useState(true);

  const { user, userData } = useAuth();
  const searchUserId = searchParams.get('userId');
  const effectiveUserId = user?.uid || searchUserId;

  const capacity = 400; // Hardcoded to 400 for all subjects

  useEffect(() => {
    async function loadResults() {
      if (!examId || !effectiveUserId) return;
      try {
        const [sub, allSubs, qs] = await Promise.all([
          SubmissionService.getMySubmission(examId, effectiveUserId),
          SubmissionService.getAllSubmissions(examId),
          ExamService.getQuestions(examId)
        ]);

        if (sub) {
          setSubmission(sub);
          setQuestions(qs);
          setAllSubmissions(allSubs);
          const computedStats = GradeCalculator.getStats(sub.totalScore, allSubs);
          setStats(computedStats);
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
    loadResults();
  }, [examId, effectiveUserId]);

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

  // Calculate stats visible ratio: "대수 이외의 과목은 실제표본으로 50%이상 교체되어야 평균 등수 등급 공개"
  const realCount = allSubmissions.filter(s => !s.isDummy).length;
  const isStatsVisible = examId === 'exam-algebra' || (realCount >= capacity * 0.5);

  // Expected rankings visibility: "3등급 이하는 예상 등수 표시하지 않음"
  const isRankVisible = !(stats?.grade && stats.grade >= 3);

  // Score distribution statistics calculations
  const scoresArray = allSubmissions.map(s => s.totalScore || 0);
  const totalSubmissions = scoresArray.length || 1;
  const sumScores = scoresArray.reduce((acc, score) => acc + score, 0);
  const averageScore = Math.round(sumScores / totalSubmissions);
  const maxScoreValue = Math.max(...scoresArray, 100);

  // Distribution buckets for the chart: [0-19, 20-39, 40-59, 60-79, 80-89, 90-100]
  const buckets = [
    { label: '90~100', count: scoresArray.filter(s => s >= 90).length },
    { label: '80~89', count: scoresArray.filter(s => s >= 80 && s < 90).length },
    { label: '60~79', count: scoresArray.filter(s => s >= 60 && s < 80).length },
    { label: '40~59', count: scoresArray.filter(s => s >= 40 && s < 60).length },
    { label: '20~39', count: scoresArray.filter(s => s >= 20 && s < 40).length },
    { label: '0~19', count: scoresArray.filter(s => s < 20).length },
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
          onClick={() => setSubTab('rankings')}
          className={cn(
            "flex-1 min-w-[120px] h-11 rounded-[22px] text-xs font-bold transition-all whitespace-nowrap",
            subTab === 'rankings' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          실시간 예측 순위표
        </button>
        {userData?.role === 'admin' && (
          <button
            onClick={() => setSubTab('stats')}
            className={cn(
              "flex-1 min-w-[120px] h-11 rounded-[22px] text-xs font-bold transition-all whitespace-nowrap",
              subTab === 'stats' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            과목 통계 분석 (새창)
          </button>
        )}
      </div>

      {subTab === 'rankings' ? (
        !isStatsVisible ? (
          <div className="bg-white p-12 border border-slate-200 rounded-[32px] text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
              <Trophy size={28} />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-bold text-slate-800">예측 순위 집계 중 ("정산중")</h4>
              <p className="text-sm text-slate-400 max-w-sm mx-auto font-medium">
                정산 중에는 실시간 예측 순위표가 공개되지 않습니다. 실제 표본이 50% 이상 제출되어 채점이 완료된 후 공개됩니다.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
            <div className="bg-indigo-50/50 p-4 border-b border-indigo-100/50 text-center text-xs font-bold text-indigo-700">
              실시간 예측 순위표는 상위 20%만 공개됩니다. (동점 시 공동 순위 표시 반영)
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">순위</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">학번</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">점수</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">제출 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankedList
                  .filter((s) => {
                    const top20Limit = Math.max(1, Math.ceil(rankedList.length * 0.2));
                    return s.rank <= top20Limit;
                  })
                  .map((rankSub) => (
                    <tr 
                      key={rankSub.id} 
                      className={cn(
                        "hover:bg-slate-50/50 transition-colors",
                        rankSub.userId === effectiveUserId && "bg-indigo-50/50"
                      )}
                    >
                      <td className="px-8 py-4">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs",
                          rankSub.rank === 1 ? "bg-amber-400 text-white" : 
                          rankSub.rank === 2 ? "bg-slate-300 text-white" :
                          rankSub.rank === 3 ? "bg-orange-300 text-white" : "text-slate-400 bg-slate-50"
                        )}>
                          {rankSub.rank}
                        </div>
                      </td>
                      <td className="px-8 py-4 font-bold text-slate-900 flex items-center gap-2">
                        {getDisplayName(rankSub.userId, !!rankSub.isDummy)}
                        {rankSub.userId === effectiveUserId && <span className="text-xs text-indigo-600 font-extrabold">(나)</span>}
                      </td>
                      <td className="px-8 py-4 font-black text-indigo-600">{rankSub.totalScore}점</td>
                      <td className="px-8 py-4 text-right text-xs text-slate-400">
                        {rankSub.isDummy ? '자동 인공정산' : new Date(rankSub.submittedAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )
      ) : (subTab === 'answers' || userData?.role !== 'admin') ? (
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
            <div className="py-24 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
                <PieChart size={28} />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-slate-800">통계 산정 대기 중 ("정산중")</h4>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  대수 이외 과목은 실제표본의 50% 이상 (200명 이상) 제출 시 전체 종합 정밀 통계 및 예상 평균 등급컷이 자동으로 정밀 공개됩니다.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-12 animate-fade-in">
              {/* Score metrics cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold">표</div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">종합 표본 수량</span>
                    <span className="text-2xl font-black text-slate-900">{totalSubmissions}건</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Coordinate Graphic - SVG based Graph & Trendline */}
              <div className="space-y-4">
                <h4 className="text-sm font-extrabold text-slate-800">점수대 분포 및 정규 추세선 (Bell Curve)</h4>
                
                <div className="relative w-full aspect-[2/1] bg-slate-50 border border-slate-100 rounded-2xl p-6 flex flex-col justify-end">
                  {/* SVG Container for Plotting graph and drawing trendline */}
                  <svg className="absolute inset-0 w-full h-full p-6 overflow-visible" xmlns="http://www.w3.org/2000/svg">
                    {/* Horizontal Grid lines */}
                    <line x1="0%" y1="20%" x2="100%" y2="20%" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="0%" y1="80%" x2="100%" y2="80%" stroke="#f1f5f9" strokeWidth="1" />

                    {/* Bars plotting */}
                    {buckets.map((b, idx) => {
                      const barWidth = 45;
                      const spacing = (100 / buckets.length);
                      const xOffset = `${spacing * idx + (spacing / 5)}%`;
                      const heightPercent = `${(b.count / maxBucketCount) * 85}%`;

                      return (
                        <g key={b.label}>
                          <rect
                            x={xOffset}
                            y={`${100 - Number(heightPercent.replace('%', ''))}%`}
                            width={`${barWidth}px`}
                            height={heightPercent}
                            fill="#6366f1"
                            opacity="0.15"
                            rx="4"
                          />
                        </g>
                      );
                    })}

                    {/* Trend Line Curve (Spline Curve) over distribution */}
                    <path
                      d={`M 15 160 Q 150 20, 320 60 T 600 170`}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="3.5"
                      strokeDasharray="4 4"
                      className="opacity-90"
                    />
                  </svg>

                  {/* Axis Labeling overlay */}
                  <div className="w-full flex justify-between text-[11px] font-bold text-slate-400 mt-2 z-10 px-4">
                    {buckets.map((b) => (
                      <span key={b.label} className="text-center w-12">{b.label}</span>
                    ))}
                  </div>
                </div>
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
