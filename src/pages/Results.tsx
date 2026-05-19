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
  const [showRankings, setShowRankings] = useState(false);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const searchUserId = searchParams.get('userId');
  const effectiveUserId = user?.uid || searchUserId;

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

  const correctCount = submission.answers.filter(a => a.isCorrect).length;

  const rankedList = allSubmissions
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((s, i) => {
      const displayName = s.userId.startsWith('GUEST-') ? '게스트' : s.userId;
      return { ...s, rank: i + 1, displayName };
    });

  return (
    <div className="max-w-5xl mx-auto space-y-12">
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
            <h2 className="text-7xl font-black">{submission.totalScore}</h2>
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
            <h3 className="text-5xl font-black text-slate-900">{stats?.grade || '-'}<span className="text-2xl ml-1 text-slate-400">등급</span></h3>
          </div>

          <div className="w-px h-24 bg-slate-100 hidden md:block"></div>

          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users size={24} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">상위 비율</p>
            <h3 className="text-5xl font-black text-slate-900">{stats?.percentile || '-'}<span className="text-2xl ml-1 text-slate-400">%</span></h3>
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
            <h3 className="text-5xl font-black text-slate-900">{stats?.rank || '-'}<span className="text-2xl ml-1 text-slate-400">/ {stats?.totalParticipants || 0}위</span></h3>
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
                      {rankSub.displayName} {rankSub.userId === effectiveUserId && "(나)"}
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
            <div className="p-8 bg-slate-50 border-t border-slate-100 text-center">
               <p className="text-sm text-slate-500">
                 * 예상 등급은 현재 입력된 표본({stats?.totalParticipants || 0}건)을 기반으로 하며 실시간으로 변동될 수 있습니다.
               </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
