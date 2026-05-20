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
  Users
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
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [showRankings, setShowRankings] = useState(false);
  const [loading, setLoading] = useState(true);

  const { user, userData } = useAuth();
  const searchUserId = searchParams.get('userId');
  const effectiveUserId = user?.uid || searchUserId;

  let capacity = 100;
  if (examId === 'exam-speech-lang' || examId === 'exam-algebra' || examId === 'exam-english1') {
    capacity = 400;
  } else if (examId === 'exam-physics' || examId === 'exam-earth') {
    capacity = 200;
  } else if (examId === 'exam-chemistry') {
    capacity = 150;
  }

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

  const getDisplayName = (id: string) => {
    // Realistic academic IDs (e.g. 20101 to 21430) are returned directly
    if (/^2\d{4}$/.test(id)) {
      return id;
    }
    return 'Unknown';
  };

  const correctCount = (submission.answers || []).filter(a => a.isCorrect).length;

  const rankedList = allSubmissions
    .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
    .map((s, i) => {
      const displayName = (s.userId && s.userId.startsWith('GUEST-')) ? '게스트' : (s.userId || '알 수 없음');
      return { ...s, rank: i + 1, displayName };
    });

  const isStatsVisible = true;
  const isRankVisible = true;

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Title Header */}
      <div className="space-y-1 border-b border-slate-100 pb-6">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Unknown의 성적표
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
                <>{stats?.grade || '-'}<span className="text-2xl ml-1 text-slate-400">등급</span></>
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
                <>{stats?.percentile || '-'}<span className="text-2xl ml-1 text-slate-400">%</span></>
              ) : (
                <span className="text-2xl text-slate-400">정산중</span>
              )}
            </h3>
          </div>

          <div className="w-px h-24 bg-slate-100 hidden md:block"></div>

          <button 
            onClick={() => setShowRankings(!showRankings)}
            className="text-center space-y-3 group outline-none"
          >
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <BarChart size={24} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest group-hover:text-amber-600 transition-colors">예상 순위 (클릭)</p>
            <h3 className="text-5xl font-black text-slate-900">
              {isStatsVisible ? (
                isRankVisible ? (
                  <>{stats?.rank || '-'}<span className="text-2xl ml-1 text-slate-400">/ {stats?.totalParticipants || 0}위</span></>
                ) : (
                  <span className="text-2xl text-slate-400">비공개</span>
                )
              ) : (
                <span className="text-2xl text-slate-400">정산중</span>
              )}
            </h3>
          </button>
        </div>
      </div>

      {/* Item Analysis or Rankings */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
            {showRankings ? '실시간 예상 순위표' : '문항별 채점 결과'}
          </h3>
          <div className="flex gap-2">
             <button 
               onClick={() => setShowRankings(!showRankings)}
               className={cn(
                 "h-10 px-4 flex items-center gap-2 rounded-xl text-sm font-semibold transition-all",
                 showRankings ? "bg-amber-600 text-white shadow-lg shadow-amber-100" : "bg-white border border-slate-200 text-slate-600 shadow-sm"
               )}
             >
               {showRankings ? '결과 보기' : '순위표 보기'}
             </button>
             <button className="h-10 px-4 flex items-center gap-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
               <Share2 size={16} /> 공유하기
             </button>
             <Link to={`/exams/${examId}`} className="h-10 px-4 flex items-center gap-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800">
               <RotateCcw size={16} /> 다시 채점
             </Link>
          </div>
        </div>

        {showRankings ? (
          <div
            className="bg-white border border-slate-200 rounded-[32px] overflow-hidden"
          >
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">순위</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">학번</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">점수</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">제출 시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankedList.map((rankSub) => (
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
                      <td className="px-8 py-4 font-bold text-slate-900">
                        {getDisplayName(rankSub.userId)} {rankSub.userId === effectiveUserId && "(나)"}
                      </td>
                      <td className="px-8 py-4 font-black text-indigo-600">{rankSub.totalScore}점</td>
                      <td className="px-8 py-4 text-right text-xs text-slate-400">
                        {new Date(rankSub.submittedAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            className="bg-white border border-slate-200 rounded-[32px] overflow-hidden"
          >
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
                {submission.answers.map((item) => (
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
        )}
      </section>
    </div>
  );
}
