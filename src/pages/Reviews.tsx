import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { ReviewService, ExamService } from '@/src/services/dataService';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, User, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function Reviews() {
  const { userData } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('exam-speech-lang');
  const [reviews, setReviews] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInfo();
  }, []);

  useEffect(() => {
    loadReviews();
  }, [selectedExamId]);

  const loadInfo = async () => {
    const data = await ExamService.getExams();
    setExams(data);
  };

  const loadReviews = async () => {
    setLoading(true);
    const data = await ReviewService.getReviews(selectedExamId);
    setReviews(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !userData) return;
    
    await ReviewService.addReview({
      examId: selectedExamId,
      userId: userData.studentId,
      content: comment
    });
    setComment('');
    loadReviews();
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">시험 후기 게시판</h1>
        <p className="text-slate-500 font-medium">과목별 시험 난이도와 의견을 나누어 보세요.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Subject Selection */}
        <div className="lg:col-span-1 space-y-2">
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
              <span className="font-bold text-sm tracking-tight">{exam.title}</span>
              <ChevronRight size={14} className={cn("transition-transform", selectedExamId === exam.id ? "translate-x-1" : "text-slate-300")} />
            </button>
          ))}
        </div>

        {/* Content: Reviews */}
        <div className="lg:col-span-3 space-y-6">
          {/* Post Box */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-100/50 space-y-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <MessageSquare size={18} />
              <h3 className="text-sm font-bold uppercase tracking-widest">후기 남기기</h3>
            </div>
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={`${exams.find(e => e.id === selectedExamId)?.title} 시험은 어떠셨나요?`}
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
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                        <User size={14} />
                      </div>
                      <span className="text-sm font-bold text-slate-900">{rev.userId}</span>
                      <span className="text-[10px] text-slate-400 font-medium">· {new Date(rev.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed font-medium">
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
