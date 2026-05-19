import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, BarChart3, ShieldCheck, MessageCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { ExamService, SubmissionService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [submissionsCount, setSubmissionsCount] = useState(0);
  const [gradeCuts, setGradeCuts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      const e = await ExamService.getExams();
      setExams(e);
      const allSubs = await SubmissionService.getAllSubmissionsAcrossExams();
      setSubmissionsCount(allSubs.length);
      
      const cuts: Record<string, number> = {};
      e.forEach(exam => {
        const subjectSubs = allSubs
          .filter(s => s.examId === exam.id)
          .sort((a, b) => b.totalScore - a.totalScore);
        
        if (subjectSubs.length > 0) {
          const index = Math.floor(subjectSubs.length * 0.1);
          cuts[exam.id] = subjectSubs[Math.min(index, subjectSubs.length - 1)].totalScore;
        } else {
          cuts[exam.id] = 0;
        }
      });
      setGradeCuts(cuts);
    }
    load();
  }, []);

  return (
    <div className="space-y-24 py-12">
      {/* Hero Section */}
      <section className="text-center space-y-8 max-w-4xl mx-auto px-4">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.1]">
            답만 입력하면 <br />
            <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-8">예상 등급</span>까지 한 번에
          </h1>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/exams"
            className="h-16 px-10 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-2xl shadow-indigo-100 hover:bg-black transition-all active:scale-95 text-lg"
          >
            가채점 시작하기
            <ArrowRight size={20} />
          </Link>
          <Link
            to="/reviews"
            className="h-16 px-10 bg-white text-slate-900 border-2 border-slate-100 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all text-lg"
          >
            <MessageCircle size={20} className="text-indigo-600" /> 시험 후기 게시판
          </Link>
        </div>
      </section>

      {/* Grade Cuts Section - 3 Static Boxes */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {exams.slice(0, 3).map((exam) => (
            <div
              key={exam.id}
              className="bg-white border-2 border-slate-100 p-8 rounded-[32px] shadow-xl shadow-slate-100 flex flex-col justify-center items-center text-center space-y-4 hover:border-indigo-200 transition-all"
            >
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">
                {exam.title}
              </p>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">1st Grade Cut</p>
                <p className="text-4xl font-black text-slate-900 tracking-tighter">
                  {gradeCuts[exam.id] || '??'}
                  <span className="text-xl font-bold text-slate-300 ml-1">점</span>
                </p>
              </div>
            </div>
          ))}
          {exams.length === 0 && (
            <div className="col-span-full h-32 flex items-center justify-center text-slate-400 font-medium">
              등록된 시험 정보가 없습니다.
            </div>
          )}
        </div>
      </section>

      {/* Features Grid */}
      <section className="flex flex-col md:flex-row justify-center items-center md:items-stretch gap-8 max-w-5xl mx-auto px-4">
        {[
          {
            title: "빠른 답안 입력",
            desc: "간편한 인터페이스로 모의고사 답안을 1분 만에 입력할 수 있습니다.",
            icon: CheckCircle2,
            color: "text-emerald-600",
            bg: "bg-emerald-50"
          },
          {
            title: "실시간 데이터 분석",
            desc: "전체 사용자들의 데이터를 실계산하여 정확도 높은 등급컷을 산출합니다.",
            icon: BarChart3,
            color: "text-indigo-600",
            bg: "bg-indigo-50"
          },
          {
            title: "안전한 데이터 보관",
            desc: "사용자의 답변 정보는 암호화되어 안전하게 보관됩니다.",
            icon: ShieldCheck,
            color: "text-amber-600",
            bg: "bg-amber-50"
          },
        ].map((feature, i) => (
          <div
            key={i}
            className="w-full max-w-sm p-8 bg-white border border-slate-200 rounded-3xl space-y-4 hover:border-indigo-300 transition-colors shadow-sm"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", feature.bg)}>
              <feature.icon className={feature.color} size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">{feature.title}</h3>
            <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
