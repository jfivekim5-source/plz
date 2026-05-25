import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, ArrowRight, Search, Filter, ChevronDown, ChevronUp, BookOpen, CheckCircle } from 'lucide-react';
import { Exam } from '@/src/types';
import { ExamService, SubmissionService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';

export default function ExamList() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpenPanel, setIsOpenPanel] = useState(true); // Control the final exam block expansion
  const [submittedMap, setSubmittedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadExams() {
      try {
        const data = await ExamService.getExams();
        setExams(data);

        if (user) {
          const subMap: Record<string, boolean> = {};
          for (const exam of data) {
            const sub = await SubmissionService.getMySubmission(exam.id, user.uid);
            if (sub) {
              subMap[exam.id] = true;
            }
          }
          setSubmittedMap(subMap);
        }
      } catch (err) {
        console.error("Failed to load exams", err);
      } finally {
        setLoading(false);
      }
    }
    if (user) {
      loadExams();
    }
  }, [user]);

  // Restrict guest access
  if (!user || !userData) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = userData?.role === 'admin';

  // Redirect to sub choice if not completed yet (Bypass for admin)
  if (!isAdmin && (!userData.selectedSubjects || userData.selectedSubjects.length === 0)) {
    return <Navigate to="/login" replace />;
  }

  const selectedIds = userData.selectedSubjects || [];
  // Filter master exams by student's designated ones (unless admin, who gets all)
  let finalExams = isAdmin ? exams : exams.filter(e => selectedIds.includes(e.id));

  // Diagnostic fallback: if standard user has selected subjects but final filtering results in 0 items,
  // we fallback to displaying all exams as a robust guarantee.
  if (!isAdmin && selectedIds.length > 0 && finalExams.length === 0 && exams.length > 0) {
    console.warn("Failsafe triggered: finalExams is empty but selectedIds has items.");
    finalExams = exams;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-205 pb-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">시험 선택</h1>
          <p className="text-slate-500 text-sm font-semibold">가채점을 진행할 시험 과목을 선택해주세요.</p>
        </div>
      </div>

      {/* Main Accordion/Card Block: 2026학년도 서울고 2학년 1학기 기말고사 */}
      <div className="bg-white border border-slate-200 rounded-[40px] shadow-sm overflow-hidden transition-all duration-300">
        {/* Card Header Clickable Area */}
        <button
          onClick={() => setIsOpenPanel(!isOpenPanel)}
          className="w-full p-8 md:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between text-left gap-6 hover:bg-slate-50/50 transition-colors"
        >
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 shrink-0">
              <GraduationCap size={28} />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                2026학년도 서울고 2학년 1학기 기말고사
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 mt-2 sm:mt-0">
            <span className="px-4 h-10 flex items-center justify-center bg-indigo-50 text-indigo-600 text-sm font-black rounded-full font-sans">
              {loading ? '로딩 중...' : `배정 과목: ${finalExams.length}개`}
            </span>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
              {isOpenPanel ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
        </button>

        {/* Expandable Body */}
        <AnimatePresence initial={true}>
          {isOpenPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="border-t border-slate-100 bg-slate-50/30"
            >
              <div className="p-8 md:p-10">
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array(8).fill(0).map((_, i) => (
                      <div key={i} className="h-44 bg-slate-100 rounded-[32px] animate-pulse"></div>
                    ))}
                  </div>
                ) : finalExams.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-semibold text-sm">
                    설정된 가채점 시험이 없습니다.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {finalExams.map((exam) => {
                      const hasSubmitted = submittedMap[exam.id];

                      return (
                        <motion.div
                          key={exam.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -4 }}
                          className="bg-white border border-slate-200 p-8 rounded-[32px] shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 transition-all group relative overflow-hidden"
                        >
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                                {exam.subject}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {hasSubmitted && (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-extrabold font-sans">
                                    <CheckCircle size={10} /> 완료
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-slate-400">
                                  문항 {exam.questionCount}개
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <h3 className="text-xl font-extrabold text-slate-900 group-hover:text-indigo-650 transition-colors line-clamp-1">
                                {exam.title}
                              </h3>
                              <p className="text-xs text-slate-400 font-semibold">{exam.grade} 학년 기말고사 시험</p>
                            </div>

                            <Link
                              to={`/exams/${exam.id}`}
                              className={`inline-flex w-full items-center justify-center h-12 rounded-2xl text-xs font-black transition-all ${
                                hasSubmitted
                                  ? 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700'
                                  : 'bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white text-slate-900'
                              }`}
                            >
                              {hasSubmitted ? '답안 수정 / 조회' : '답안 입력하기'}
                              <ArrowRight className="ml-2 w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
