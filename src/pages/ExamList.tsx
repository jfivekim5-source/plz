import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, ArrowRight, Search, Filter, ChevronDown, ChevronUp, BookOpen, CheckCircle } from 'lucide-react';
import { Exam } from '@/src/types';
import { ExamService, SubmissionService, isExamSupported, SettingsService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';

export default function ExamList() {
  const { user, userData, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpenPanel, setIsOpenPanel] = useState(true); // Control the final exam block expansion
  const [submittedMap, setSubmittedMap] = useState<Record<string, boolean>>({});
  const [siteSettings, setSiteSettings] = useState<any>(null);

  useEffect(() => {
    async function loadExams() {
      try {
        const data = await ExamService.getExams();
        setExams(data);

        try {
          const settings = await SettingsService.getSettings();
          setSiteSettings(settings);
        } catch (e) {
          console.error("Failed to load settings in ExamList", e);
        }

        if (user) {
          const subMap: Record<string, boolean> = {};
          const reals = await SubmissionService.getRealSubmissions();
          const userSubs = reals.filter(s => s.userId === user.uid);
          data.forEach(exam => {
            if (userSubs.some(s => s.examId === exam.id)) {
              subMap[exam.id] = true;
            }
          });
          setSubmittedMap(subMap);
        }
      } catch (err) {
        console.error("Failed to load exams", err);
      } finally {
        setLoading(false);
      }
    }
    if (user && !authLoading) {
      loadExams();
    }
  }, [user, authLoading]);

  // Prevent premature redirection while auth state is initializing
  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold text-sm">학적 정보 확인 중...</p>
      </div>
    );
  }

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
  // Also filter out private exams (where grading disclosure is turned off by admin)
  let finalExams = isAdmin ? exams : exams.filter(e => {
    const isSelected = selectedIds.includes(e.id);
    if (!isSelected) return false;
    
    const subConf = siteSettings?.subjects?.[e.id];
    if (subConf && subConf.discloseGrading === false) {
      return false; // Remove if set to private!
    }
    return true;
  });

  // Diagnostic fallback: if standard user has selected subjects but final filtering results in 0 items,
  // and we haven't filtered them due to deliberate private settings, we fallback to displaying all exams.
  // Actually, if they are empty because they are all private, we should not fallback to all exams.
  // So we only fallback if there are no private settings causing it.
  const hasVisibleExams = exams.some(e => {
    if (!selectedIds.includes(e.id)) return false;
    const subConf = siteSettings?.subjects?.[e.id];
    return !(subConf && subConf.discloseGrading === false);
  });
  if (!isAdmin && selectedIds.length > 0 && finalExams.length === 0 && exams.length > 0 && !hasVisibleExams) {
    // Deliberately empty due to all subjects being private, do not fallback to everything.
  } else if (!isAdmin && selectedIds.length > 0 && finalExams.length === 0 && exams.length > 0) {
    console.warn("Failsafe triggered: finalExams is empty but selectedIds has items.");
    finalExams = exams;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-150 pb-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">배정 시험 과목</h1>
          <p className="text-slate-500 text-sm font-semibold">가채점을 진행할 시험 과목을 선택해주세요.</p>
        </div>
        {!loading && (
          <span className="px-4 h-10 inline-flex items-center justify-center bg-indigo-50 text-indigo-600 text-sm font-black rounded-full font-sans max-w-fit">
            배정 과목: {finalExams.length}개
          </span>
        )}
      </div>

      <div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-44 bg-slate-100 rounded-[32px] animate-pulse"></div>
            ))}
          </div>
        ) : finalExams.length === 0 ? (
          <div className="py-20 bg-white border border-slate-200 rounded-[40px] text-center text-slate-400 font-semibold text-sm shadow-sm space-y-2">
            <BookOpen size={48} className="mx-auto text-slate-300 stroke-[1.5]" />
            <p>설정된 가채점 시험이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {finalExams.map((exam) => {
              const hasSubmitted = submittedMap[exam.id];
              const isSupported = isExamSupported(exam.id);

              return (
                <motion.div
                  key={exam.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={isSupported ? { y: -4 } : {}}
                  className={`border p-8 rounded-[32px] shadow-sm transition-all relative overflow-hidden bg-white ${
                    isSupported 
                      ? 'border-slate-200 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 group' 
                      : 'border-slate-100 opacity-60 bg-slate-50/50'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 bg-slate-100 text-slate-605 text-[10px] font-bold rounded-full">
                        {exam.subject}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!isSupported ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-extrabold font-sans">
                            미지원 과목
                          </span>
                        ) : hasSubmitted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-extrabold font-sans">
                            <CheckCircle size={10} /> 완료
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">
                            문항 {exam.questionCount}개
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className={`text-xl font-extrabold line-clamp-1 transition-colors ${
                        isSupported ? 'text-slate-900 group-hover:text-indigo-650' : 'text-slate-400'
                      }`}>
                        {exam.title}
                      </h3>
                      <p className="text-xs text-slate-400 font-semibold">
                        {isSupported ? `${exam.grade} 학년 기말고사 시험` : '현재 가채점 미지원 과목'}
                      </p>
                    </div>

                    {isSupported ? (
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
                    ) : (
                      <button
                        disabled
                        className="inline-flex w-full items-center justify-center h-12 rounded-2xl text-xs font-black bg-slate-100 text-slate-400 cursor-not-allowed"
                      >
                        가채점 미지원 과목
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
