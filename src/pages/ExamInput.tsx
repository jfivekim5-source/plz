import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { GraduationCap, Send, ChevronLeft, Filter, RefreshCw, CheckSquare, AlertCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Exam, Question, Submission } from '@/src/types';
import { ExamService, SubmissionService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';

export default function ExamInput() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { userData, loading: authLoading } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [unknownQuestions, setUnknownQuestions] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showUnansweredOnly, setShowUnansweredOnly] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!examId || !userData) return;
      try {
        const [examData, qData, mySub] = await Promise.all([
          ExamService.getExam(examId),
          ExamService.getQuestions(examId),
          SubmissionService.getMySubmission(examId, userData.uid)
        ]);

        if (examData) {
          setExam(examData);
          setQuestions(qData);
          
          // If a prior submission exists for this user, pre-fill the answers!
          if (mySub && mySub.answers) {
            const prefilled: Record<number, string> = {};
            const loadedUnknowns: Record<number, boolean> = {};
            mySub.answers.forEach(ans => {
              prefilled[ans.number] = ans.userAnswer;
              if (ans.userAnswer === '') {
                loadedUnknowns[ans.number] = true;
              }
            });
            setAnswers(prefilled);
            setUnknownQuestions(loadedUnknowns);
          }
        }
      } catch (err) {
        console.error("Failed to load exam core data", err);
      } finally {
        setLoading(false);
      }
    }
    if (userData) {
      loadData();
    }
  }, [examId, userData]);

  // Support 1-5 multi-choice toggles
  const handleAnswerSelect = (qNum: number, choice: string) => {
    setUnknownQuestions(prev => ({ ...prev, [qNum]: false }));
    setAnswers(prev => {
      const currentVal = prev[qNum] || '';
      const selectedList = currentVal ? currentVal.split(',') : [];
      let nextList: string[];

      if (selectedList.includes(choice)) {
        nextList = selectedList.filter(v => v !== choice);
      } else {
        nextList = [...selectedList, choice].sort((a, b) => Number(a) - Number(b));
      }

      return {
        ...prev,
        [qNum]: nextList.join(',')
      };
    });
  };

  // Support subjective absolute points direct setter
  const handleSubjectiveScoreSelect = (qNum: number, pts: string) => {
    setUnknownQuestions(prev => ({ ...prev, [qNum]: false }));
    setAnswers(prev => ({
      ...prev,
      [qNum]: pts
    }));
  };

  const calculateProgress = () => {
    if (!exam) return 0;
    const answeredCount = Object.keys(answers).filter(k => answers[Number(k)] !== '').length;
    return Math.round((answeredCount / exam.questionCount) * 100);
  };

  const isChoiceQuestion = (qNum: number) => {
    if (!exam) return true;
    if (exam.id === 'exam-speech-lang') return true;
    if (exam.id === 'exam-algebra') return qNum <= 15;
    if (exam.id === 'exam-physics') return qNum <= 15;
    if (exam.id === 'exam-chemistry') return true;
    if (exam.id === 'exam-earth') return true;
    if (exam.id === 'exam-english1') return qNum <= 24;
    return qNum <= 21; // fallback
  };

  const getQuestionMaxScore = (qNum: number) => {
    const q = questions.find(item => item.number === qNum);
    if (q) return q.score;
    // fallback points mapping
    if (exam?.id === 'exam-speech-lang') return qNum <= 20 ? 3 : 5;
    if (exam?.id === 'exam-algebra') return qNum <= 15 ? 4 : 6;
    if (exam?.id === 'exam-physics') return qNum <= 15 ? 4 : 8;
    if (exam?.id === 'exam-chemistry') return 5;
    if (exam?.id === 'exam-earth') return 4;
    if (exam?.id === 'exam-english1') return qNum <= 24 ? 3 : 5;
    return 4;
  };

  const handleSubmit = async () => {
    if (!exam || !userData) return;
    
    const unlistedNums: number[] = [];
    for (let i = 1; i <= exam.questionCount; i++) {
      if (!answers[i]) {
        unlistedNums.push(i);
      }
    }

    if (unlistedNums.length > 0) {
      if (!confirm(`아직 입력하지 않은 문항이 ${unlistedNums.length}개 있습니다. 정말 제출하시겠습니까?`)) return;
    }
    
    setIsSubmitting(true);
    try {
      let totalScore = 0;
      const submissionAnswers = Array.from({ length: exam.questionCount }, (_, i) => {
        const num = i + 1;
        const userAnswer = answers[num] || '';
        const question = questions.find(q => q.number === num);
        const maxScore = getQuestionMaxScore(num);

        let isCorrect = false;
        let score = 0;

        if (isChoiceQuestion(num)) {
          // Choice matching
          isCorrect = question ? question.answer === userAnswer : false;
          score = isCorrect ? maxScore : 0;
        } else {
          // Direct point mapping inputted by student
          const userDefinedScore = Number(userAnswer) || 0;
          score = userDefinedScore;
          isCorrect = userDefinedScore > 0;
        }

        totalScore += score;

        return {
          number: num,
          userAnswer,
          isCorrect,
          score
        };
      });

      await SubmissionService.submit({
        userId: userData.uid,
        examId: exam.id,
        totalScore,
        submittedAt: new Date().toISOString(),
        answers: submissionAnswers
      });
      
      navigate(`/results?examId=${exam.id}&userId=${userData.uid}`);
    } catch (err) {
      console.error(err);
      alert('제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Secure guest routing fallback
  if (authLoading) return <div className="p-12 text-center text-slate-400">학적 확인 중...</div>;
  if (!userData) {
    return <Navigate to="/login" replace />;
  }

  if (loading) return <div className="p-12 text-center text-slate-400">시험 정보와 이전 저장 답안을 불러오고 있습니다...</div>;
  if (!exam) return <div className="p-12 text-center text-slate-400">시험을 찾을 수 없습니다.</div>;

  // Track unfilled question indices
  const unansweredNumbers: number[] = [];
  for (let i = 1; i <= exam.questionCount; i++) {
    if (!answers[i]) {
      unansweredNumbers.push(i);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32 px-4">
      {/* Header Block with Back button and progress indicators */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/exams')}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 border border-slate-250 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{exam.title}</h1>
            <p className="text-sm font-semibold text-slate-400">{exam.grade} · {exam.subject}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">입력 완료 진행도</p>
            <div className="flex items-center gap-3">
              <div className="w-32 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                   key={calculateProgress()}
                   initial={{ width: 0 }}
                   animate={{ width: `${calculateProgress()}%` }}
                   className="h-full bg-indigo-500"
                />
              </div>
              <span className="text-sm font-black text-indigo-600">{calculateProgress()}%</span>
            </div>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="h-14 px-8 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 disabled:bg-indigo-600 disabled:text-white disabled:opacity-50"
          >
            {isSubmitting ? '수정 사항 채점 중...' : '답안 저장 및 채점'}
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* 모르는 문제 입력 Panel */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-6 md:p-8 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
              모르는 문제 입력 (마킹 비우기)
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              모르는 문제 번호를 체크하면 해당 문항의 마킹이 자동으로 비워지고 ‘모름’ 상태로 기록됩니다. 아래 1번부터 {exam.questionCount}번까지 나열되어 있습니다.
            </p>
          </div>
          {Object.values(unknownQuestions).filter(Boolean).length > 0 && (
            <button
              onClick={() => {
                if (confirm('모든 모르는 문제 설정을 해제하시겠습니까?')) {
                  setUnknownQuestions({});
                }
              }}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors shrink-0"
            >
              전체 해제
            </button>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: exam.questionCount }, (_, i) => i + 1).map((qNum) => {
            const isUnknown = !!unknownQuestions[qNum];
            return (
              <button
                key={`unknown-toggle-${qNum}`}
                type="button"
                onClick={() => {
                  setUnknownQuestions(prev => {
                    const nextVal = !prev[qNum];
                    if (nextVal) {
                      // Automatically clear answer
                      setAnswers(ansPrev => ({ ...ansPrev, [qNum]: '' }));
                    }
                    return { ...prev, [qNum]: nextVal };
                  });
                }}
                className={cn(
                  "min-w-10 h-10 px-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-0.5",
                  isUnknown 
                    ? "bg-rose-50 border-rose-200 text-rose-600 scale-105 shadow-sm" 
                    : "bg-slate-50 border-slate-150 text-slate-600 hover:border-slate-300"
                )}
              >
                <span>{qNum}</span>
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-tighter",
                  isUnknown ? "text-rose-500" : "text-slate-300"
                )}>
                  {isUnknown ? '모름' : '선택'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Answer Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {Array.from({ length: exam.questionCount }, (_, i) => i + 1)
          .filter(qNum => {
            if (showUnansweredOnly) {
              return !answers[qNum];
            }
            return true;
          })
          .map((qNum, i) => {
            const isUnknownStatus = !!unknownQuestions[qNum];
            const hasMarked = !isUnknownStatus && !!answers[qNum];
            const maxScore = getQuestionMaxScore(qNum);
            const questionTypeChoice = isChoiceQuestion(qNum);
            const selectedSet = (answers[qNum] || '').split(',').filter(Boolean);

            return (
              <motion.div
                id={`q-card-${qNum}`}
                key={`${exam.id}-card-${qNum}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (i % 15) * 0.015 }}
                className={cn(
                  "p-8 bg-white rounded-[32px] border-2 transition-all flex flex-col justify-between h-56",
                  isUnknownStatus
                    ? "border-rose-300 shadow-xl shadow-rose-100/30 ring-4 ring-rose-50 bg-rose-50/10"
                    : hasMarked 
                      ? "border-indigo-500 shadow-xl shadow-indigo-100/50 ring-4 ring-indigo-50" 
                      : "border-slate-100 hover:border-slate-200"
                )}
              >
                {/* Visual Top Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm transition-all shadow-sm",
                      isUnknownStatus
                        ? "bg-rose-500 text-white"
                        : hasMarked ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-400"
                    )}>
                      {qNum}
                    </div>
                    <span className="text-sm font-bold text-slate-700">
                      {isUnknownStatus ? '모르는 문제' : (questionTypeChoice ? '객관식' : '서답형')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={cn(
                      "text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider",
                      isUnknownStatus 
                        ? "text-rose-600 bg-rose-50 animate-pulse" 
                        : "text-indigo-600 bg-indigo-50"
                    )}>
                      {isUnknownStatus ? '채점 시 오답 처리' : `배점 ${maxScore}점`}
                    </div>
                  </div>
                </div>

                {/* Main Body Input Area */}
                <div className="my-auto">
                  {questionTypeChoice ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-5 gap-2">
                        {['1', '2', '3', '4', '5'].map((choice) => {
                          const isPressed = selectedSet.includes(choice);
                          return (
                            <button
                              key={choice}
                              type="button"
                              onClick={() => handleAnswerSelect(qNum, choice)}
                              className={cn(
                                "aspect-square rounded-2xl flex items-center justify-center text-base font-bold transition-all border-2",
                                isPressed 
                                  ? "bg-slate-900 border-slate-900 text-white scale-110 shadow-lg" 
                                  : "bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-600"
                              )}
                            >
                              {choice}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11px] font-bold text-slate-400/80 mb-1">자신이 획득한 부분 점수 직접입력</p>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {Array.from({ length: maxScore + 1 }, (_, scoreIdx) => scoreIdx).map((scoreVal) => {
                          const scoreStr = scoreVal.toString();
                          const isPicked = answers[qNum] === scoreStr;
                          return (
                            <button
                              key={`score-pick-${qNum}-${scoreVal}`}
                              type="button"
                              onClick={() => handleSubjectiveScoreSelect(qNum, scoreStr)}
                              className={cn(
                                "h-9 px-3 rounded-xl font-bold text-xs transition-colors border",
                                isPicked 
                                  ? "bg-indigo-600 border-indigo-600 text-white scale-105 shadow" 
                                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                              )}
                            >
                              {scoreVal}점
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

      {/* Floating Progress Mobile Tracker */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white border border-slate-200 shadow-2xl rounded-3xl p-4 md:hidden flex items-center justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-slate-400">
            <span>내 모킹 진행도</span>
            <span>{calculateProgress()}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500" style={{ width: `${calculateProgress()}%` }} />
          </div>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100 disabled:bg-indigo-600 disabled:text-white disabled:opacity-50"
        >
          {isSubmitting ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  );
}
