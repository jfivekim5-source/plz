import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, BarChart3, MessageCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { ExamService, SubmissionService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<any[]>([]);
  const [gradeCuts, setGradeCuts] = useState<Record<string, number>>({});
  const [mySubmissions, setMySubmissions] = useState<Record<string, boolean>>({});
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    async function load() {
      const e = await ExamService.getExams();
      setExams(e);

      // Total submissions (includes dummy + real ones)
      const allSubs = await SubmissionService.getAllSubmissionsAcrossExams();
      
      const cuts: Record<string, number> = {};
      const userSubmissionMap: Record<string, boolean> = {};

      // If user is logged in, find which exams they completed
      if (user) {
        for (const exam of e) {
          const mySub = await SubmissionService.getMySubmission(exam.id, user.uid);
          if (mySub) {
            userSubmissionMap[exam.id] = true;
          }
        }
      }
      setMySubmissions(userSubmissionMap);

      e.forEach(exam => {
        const subjectSubs = allSubs
          .filter(s => s.examId === exam.id)
          .sort((a, b) => b.totalScore - a.totalScore);
        
        if (subjectSubs.length > 0) {
          // 1st Grade Cut calculation: e.g., top 10%
          const index = Math.floor(subjectSubs.length * 0.1);
          cuts[exam.id] = subjectSubs[Math.min(index, subjectSubs.length - 1)].totalScore;
        } else {
          cuts[exam.id] = 0;
        }
      });
      setGradeCuts(cuts);
    }
    load();
  }, [user]);

  return (
    <div className="space-y-20 py-12">
      {/* Hero Section */}
      <section className="text-center space-y-8 max-w-4xl mx-auto px-4">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.1]">
            답만 입력하면 <br />
            <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-8">예상 등급</span>까지 한 번에
          </h1>
          <p className="text-slate-500 max-w-lg mx-auto text-base font-medium">
            실시간 데이터로 정확하게 계산되는 1등급 예측 등급컷 서비스
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to={user ? "/exams" : "/login"}
            className="h-16 px-12 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-2xl shadow-indigo-100/50 hover:bg-slate-900 transition-all active:scale-95 text-lg"
          >
            가채점 시작하기
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Grade Cuts Section - Horizontal Marquee for Logged-In Users only */}
      <section className="max-w-6xl mx-auto px-4">
        {!user ? (
          // Guest Banner (Restrict Access)
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 rounded-[36px] text-center space-y-5 max-w-2xl mx-auto">
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
            <div className="text-center">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">실시간 예측 등급컷</h2>
            </div>

            {/* Carousel Slider with 좌우 Arrow buttons */}
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
                  className="flex gap-6 transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${slideIndex * 100}%)` }}
                >
                  {/* Grid or Flex based wrap of slides */}
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
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">1st Grade Cut</p>
                                <p className="text-5xl font-black text-slate-900 tracking-tighter">
                                  {hasSubmitted ? `${gradeCuts[exam.id] || 0}점` : '??점'}
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
            간편한 인터페이스로 모의고사 답안을 1분 만에 입력할 수 있습니다.
          </p>
        </div>

        {/* Feature 2: 실시간 데이터 분석 */}
        <div className="w-full md:w-1/3 p-8 bg-white border border-slate-200 rounded-[32px] space-y-5 shadow-sm hover:border-indigo-100 transition-colors">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-50">
            <BarChart3 className="text-indigo-600" size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">실시간 데이터 분석</h3>
          <p className="text-slate-500 text-sm leading-relaxed">
            전체 사용자들의 데이터를 실계산하여 정확도 높은 등급컷을 산출합니다.
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
    </div>
  );
}
