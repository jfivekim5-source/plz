import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { GraduationCap, Save, Send, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Exam, Question, Submission } from '@/src/types';
import { ExamService, SubmissionService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';

export default function ExamInput() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!examId) return;
      try {
        const [examData, qData] = await Promise.all([
          ExamService.getExam(examId),
          ExamService.getQuestions(examId)
        ]);

        if (examData) {
          setExam(examData);
          setQuestions(qData);
        } else {
          // Fallback mockup if database is empty
          setExam({
            id: examId,
            title: '2026년 3월 고1 모의고사',
            grade: '고1',
            subject: '수학',
            isOpen: true,
            questionCount: 30
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [examId]);

  const handleAnswerSelect = (qNum: number, choice: string) => {
    setAnswers(prev => ({ ...prev, [qNum]: choice }));
  };

  const calculateProgress = () => {
    if (!exam) return 0;
    const answeredCount = Object.keys(answers).length;
    return Math.round((answeredCount / exam.questionCount) * 100);
  };

  const handleSubmit = async () => {
    if (!exam) return;
    
    // Support Guest Submission if not logged in
    const effectiveUserId = userData?.uid || `GUEST-${localStorage.getItem('guest_id') || (() => {
      const g = Math.random().toString(36).substring(7);
      localStorage.setItem('guest_id', g);
      return g;
    })()}`;

    const unansweredCount = exam.questionCount - Object.keys(answers).length;
    if (unansweredCount > 0) {
      if (!confirm(`아직 입력하지 않은 문항이 ${unansweredCount}개 있습니다. 정말 제출하시겠습니까?`)) return;
    }
    
    setIsSubmitting(true);
    try {
      let totalScore = 0;
      const submissionAnswers = Array.from({ length: exam.questionCount }, (_, i) => {
        const num = i + 1;
        const userAnswer = answers[num] || '';
        const question = questions.find(q => q.number === num);
        
        // Mock scoring logic if questions aren't in DB yet
        const isCorrect = question ? question.answer === userAnswer : false;
        const score = isCorrect ? (question?.score || (num > 21 ? 4 : 3)) : 0;
        
        if (isCorrect) totalScore += score;

        return {
          number: num,
          userAnswer,
          isCorrect,
          score
        };
      });

      await SubmissionService.submit({
        userId: effectiveUserId,
        examId: exam.id,
        totalScore,
        submittedAt: new Date().toISOString(),
        answers: submissionAnswers
      });
      
      navigate(`/results?examId=${exam.id}&userId=${effectiveUserId}`);
    } catch (err) {
      console.error(err);
      alert('제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isChoiceQuestion = (qNum: number) => {
    if (!exam) return true;
    if (exam.id === 'exam-speech-lang') return true; // All 28 are choice
    if (exam.id === 'exam-algebra') return qNum <= 16; // 16 choice, 6 subjective
    if (exam.id === 'exam-physics') return qNum <= 15; // 15 choice, 5 subjective
    return qNum <= 21; // Default fallback
  };

  if (loading) return <div className="p-12 text-center text-slate-400">시험 정보를 불러오는 중...</div>;
  if (!exam) return <div className="p-12 text-center text-slate-400">시험을 찾을 수 없습니다.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/exams')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{exam.title}</h1>
            <p className="text-sm font-medium text-slate-500">{exam.grade} · {exam.subject}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">입력 진행도</p>
            <div className="flex items-center gap-3">
              <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                   key={calculateProgress()}
                   initial={{ width: 0 }}
                   animate={{ width: `${calculateProgress()}%` }}
                   className="h-full bg-indigo-600"
                />
              </div>
              <span className="text-sm font-bold text-indigo-600">{calculateProgress()}%</span>
            </div>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="h-12 px-8 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            {isSubmitting ? '채점 중...' : '채점하기'}
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Answer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {Array.from({ length: exam.questionCount }, (_, i) => i + 1).map((qNum, i) => (
          <motion.div
            key={`${exam.id}-${qNum}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: (i % 15) * 0.01 }}
            className={cn(
              "p-8 bg-white rounded-[32px] border-2 transition-all flex flex-col gap-6",
              answers[qNum] 
                ? "border-indigo-600 shadow-xl shadow-indigo-100 ring-4 ring-indigo-50" 
                : "border-slate-100 hover:border-slate-200"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm transition-all",
                  answers[qNum] ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                )}>
                  {qNum}
                </div>
                <span className="text-sm font-bold text-slate-900 tracking-tight">
                  {isChoiceQuestion(qNum) ? '객관식' : '서답형'}
                </span>
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">
                {isChoiceQuestion(qNum) ? '3점' : '4점'}
              </div>
            </div>

            {isChoiceQuestion(qNum) ? (
              <div className="grid grid-cols-5 gap-2">
                {['1', '2', '3', '4', '5'].map((choice) => (
                  <button
                    key={choice}
                    onClick={() => handleAnswerSelect(qNum, choice)}
                    className={cn(
                      "aspect-square rounded-2xl flex items-center justify-center text-base font-bold transition-all border-2",
                      answers[qNum] === choice 
                        ? "bg-slate-900 border-slate-900 text-white scale-110 shadow-lg" 
                        : "bg-white border-slate-50 text-slate-400 hover:border-indigo-200 hover:text-indigo-600"
                    )}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            ) : (
              <div className="relative group">
                <input
                  type="number"
                  placeholder="정답 수치 입력"
                  value={answers[qNum] || ''}
                  onChange={(e) => handleAnswerSelect(qNum, e.target.value)}
                  className="w-full h-14 px-6 bg-slate-50 border-2 border-transparent rounded-2xl text-center font-bold text-indigo-600 text-xl focus:bg-white focus:border-indigo-600 focus:outline-none transition-all placeholder:text-slate-300 placeholder:text-sm"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
                  <GraduationCap size={16} />
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Floating Progress Mobile */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white border border-slate-200 shadow-2xl rounded-3xl p-4 md:hidden flex items-center justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-slate-400">
            <span>나의 진행도</span>
            <span>{calculateProgress()}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600" style={{ width: `${calculateProgress()}%` }} />
          </div>
        </div>
        <button 
          onClick={handleSubmit}
          className="h-12 px-6 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100"
        >
          채점
        </button>
      </div>
    </div>
  );
}
