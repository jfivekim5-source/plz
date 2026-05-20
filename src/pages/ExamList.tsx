import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { GraduationCap, ArrowRight, Search, Filter } from 'lucide-react';
import { Exam } from '@/src/types';
import { ExamService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';

export default function ExamList() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadExams() {
      try {
        const data = await ExamService.getExams();
        if (data.length > 0) {
          setExams(data);
        } else {
          // Fallback mock data if DB is empty for demo purpose
          setExams([
            { id: '1', title: '2026년 3월 고1 모의고사', grade: '고1', subject: '수학', isOpen: true, questionCount: 30 },
            { id: '2', title: '2026년 3월 고1 모의고사', grade: '고1', subject: '국어', isOpen: true, questionCount: 45 },
            { id: '3', title: '2026년 3월 고1 모의고사', grade: '고1', subject: '영어', isOpen: true, questionCount: 45 },
          ]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (user) {
      loadExams();
    }
  }, [user]);

  // Restrict guest access
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">시험 선택</h1>
          <p className="text-slate-500">가채점을 진행할 시험을 선택해주세요.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="시험명 검색..." 
              className="pl-10 pr-4 h-11 w-full md:w-64 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <button className="h-11 w-11 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600">
            <Filter size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-48 bg-slate-100 rounded-[32px] animate-pulse"></div>
          ))
        ) : (
          exams.map((exam) => (
            <motion.div
              key={exam.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              className="bg-white border border-slate-200 p-8 rounded-[32px] shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-200 transition-all group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full">
                    {exam.subject}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    문항 {exam.questionCount}개
                  </span>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {exam.title}
                  </h3>
                  <p className="text-sm text-slate-500">{exam.grade}</p>
                </div>

                <Link
                  to={`/exams/${exam.id}`}
                  className="inline-flex w-full items-center justify-center h-12 bg-slate-50 rounded-2xl text-sm font-semibold text-slate-900 group-hover:bg-indigo-600 group-hover:text-white transition-all"
                >
                  답안 입력하기
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
