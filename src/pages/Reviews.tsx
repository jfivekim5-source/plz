import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { ReviewService, ExamService } from '@/src/services/dataService';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, User, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Link } from 'react-router-dom';

export default function Reviews() {
  const { userData } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [postExamId, setPostExamId] = useState<string>('');
  const [reviews, setReviews] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInfo();
    // Load local storage user entries for live mapping
    try {
      const dbStr = localStorage.getItem('exam_app_users_db');
      if (dbStr) {
        setUsersMap(JSON.parse(dbStr));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (userData) {
      loadReviews();
    }
  }, [selectedExamId, userData]);

  const loadInfo = async () => {
    const data = await ExamService.getExams();
    setExams(data);
    if (data.length > 0) {
      setPostExamId(data[0].id);
    }
  };

  const loadReviews = async () => {
    setLoading(true);
    const data = await ReviewService.getReviews(selectedExamId === 'all' ? undefined : selectedExamId);
    setReviews(data);
    setLoading(false);
  };

  const getReviewerName = (rev: any) => {
    if (rev.userId && rev.nickname) {
      return `${rev.userId} ${rev.nickname}`;
    }

    const userProfile = Object.values(usersMap).find(
      (u: any) => u.studentId === rev.userId || u.uid === rev.userId
    ) as any;

    if (userProfile) {
      const studentId = userProfile.studentId || rev.userId;
      const nicknameVal = userProfile.nickname || userProfile.name || '';
      return `${studentId} ${nicknameVal}`;
    }

    return rev.userId; // fallback
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !userData) return;
    
    const targetExam = selectedExamId === 'all' ? postExamId : selectedExamId;
    if (!targetExam) {
      alert('등록할 과목을 선택해주세요.');
      return;
    }
    
    await ReviewService.addReview({
      examId: targetExam,
      userId: userData.studentId,
      nickname: userData.nickname || userData.name || '',
      content: comment
    });
    setComment('');
    loadReviews();
  };

  // Prevent guests (non-logged-in actions) as requested
  if (!userData) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-6">
        <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
          <MessageSquare size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">접근 권한이 없습니다</h2>
          <p className="text-sm text-slate-400">시험 후기 게시판은 로그인된 회원만 이용하실 수 있습니다.</p>
        </div>
        <Link 
          to="/login"
          className="inline-flex h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold items-center justify-center transition-all shadow-lg shadow-indigo-100"
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">시험 후기 게시판</h1>
        <p className="text-slate-500 font-medium">과목별 시험 난이도와 의견을 나누어 보세요.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        {/* Sidebar: Subject Selection */}
        <div className="space-y-2">
          {/* 전체 Room */}
          <button
            onClick={() => setSelectedExamId('all')}
            className={cn(
              "w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group",
              selectedExamId === 'all' 
                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100/50" 
                : "bg-white border-slate-100 text-slate-800 hover:border-slate-200"
            )}
          >
            <span className="font-extrabold text-xs tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              전체 란 (전과목 후기)
            </span>
            <ChevronRight size={14} className={cn("transition-transform", selectedExamId === 'all' ? "translate-x-1" : "text-slate-300")} />
          </button>

          {exams.map(exam => (
            <button
              key={exam.id}
              onClick={() => setSelectedExamId(exam.id)}
              className={cn(
                "w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group",
                selectedExamId === exam.id 
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                  : "bg-white border-slate-100 text-slate-600 hover:border-slate-200"
              )}
            >
              <span className="font-bold text-xs tracking-tight">{exam.title}</span>
              <ChevronRight size={14} className={cn("transition-transform", selectedExamId === exam.id ? "translate-x-1" : "text-slate-300")} />
            </button>
          ))}
        </div>

        {/* Content: Reviews */}
        <div className="space-y-6">
          {/* Post Box */}
          {!userData?.isPrivate && (
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-100/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 pb-3">
                <div className="flex items-center gap-2 text-indigo-600">
                  <MessageSquare size={18} />
                  <h3 className="text-sm font-bold uppercase tracking-widest">후기 남기기</h3>
                </div>
                {selectedExamId === 'all' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 font-sans">과목 지정:</span>
                    <select
                      value={postExamId}
                      onChange={(e) => setPostExamId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    >
                      {exams.map(e => (
                        <option key={e.id} value={e.id}>{e.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <form onSubmit={handleSubmit} className="relative">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    selectedExamId === 'all'
                      ? `${exams.find(e => e.id === postExamId)?.title || '과목'} 시험은 어떠셨나요?`
                      : `${exams.find(e => e.id === selectedExamId)?.title} 시험은 어떠셨나요?`
                  }
                  className="w-full h-32 p-5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-200 transition-all font-medium resize-none"
                />
                <button
                  type="submit"
                  className="absolute bottom-4 right-4 h-12 px-6 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-black transition-all active:scale-95 flex items-center gap-2"
                >
                  <Send size={16} /> 게시
                </button>
              </form>
            </div>
          )}

          {/* List */}
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {reviews.map((rev, idx) => (
                <motion.div
                  key={rev.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white p-6 rounded-[28px] border border-slate-50 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                        <User size={14} />
                      </div>
                      <span className="text-sm font-bold text-slate-900">{getReviewerName(rev)}</span>
                      {/* Room tag badge */}
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        {exams.find(e => e.id === rev.examId)?.title || '공통'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">· {new Date(rev.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed font-semibold pl-1.5">
                    {rev.content}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {reviews.length === 0 && !loading && (
              <div className="py-20 text-center space-y-3">
                <p className="text-slate-400 font-bold">아직 작성된 후기가 없습니다.</p>
                <p className="text-xs text-slate-300">첫 후기를 남겨보세요!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
