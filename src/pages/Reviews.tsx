import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { ReviewService, ExamService } from '@/src/services/dataService';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, User, ChevronRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Link } from 'react-router-dom';

interface Comment {
  id: string;
  reviewId: string;
  userId: string;
  nickname: string;
  content: string;
  createdAt: string;
}

export default function Reviews() {
  const { userData } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [postExamId, setPostExamId] = useState<string>('');
  const [reviews, setReviews] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');

  // Comments states
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({});
  const [newCommentContent, setNewCommentContent] = useState<Record<string, string>>({}); // reviewId -> text
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  const saveComments = (newComments: Comment[]) => {
    setAllComments(newComments);
    try {
      localStorage.setItem('exam_review_comments', JSON.stringify(newComments));
    } catch (e) {}
  };

  const handleToggleExpand = (reviewId: string) => {
    setExpandedReviewIds(prev => ({
      ...prev,
      [reviewId]: !prev[reviewId]
    }));
  };

  const handleAddComment = (reviewId: string) => {
    const text = newCommentContent[reviewId]?.trim();
    if (!text || !userData) return;

    const newComment: Comment = {
      id: `COM-${Date.now()}`,
      reviewId,
      userId: userData.studentId,
      nickname: userData.nickname || userData.name || '',
      content: text,
      createdAt: new Date().toISOString()
    };

    const updated = [...allComments, newComment];
    saveComments(updated);
    setNewCommentContent(prev => ({ ...prev, [reviewId]: '' }));
  };

  const handleDeleteComment = (commentId: string) => {
    if (!window.confirm('정말 이 댓글을 삭제하시겠습니까?')) return;
    const updated = allComments.filter(c => c.id !== commentId);
    saveComments(updated);
  };

  const handleStartEditComment = (com: Comment) => {
    setEditingCommentId(com.id);
    setEditingCommentText(com.content);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSaveEditComment = (commentId: string) => {
    if (!editingCommentText.trim()) return;
    const updated = allComments.map(c => {
      if (c.id === commentId) {
        return { ...c, content: editingCommentText.trim() };
      }
      return c;
    });
    saveComments(updated);
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 이 후기를 삭제하시겠습니까?')) return;
    await ReviewService.deleteReview(id);
    loadReviews();
  };

  const handleStartEdit = (rev: any) => {
    setEditingReviewId(rev.id);
    setEditingContent(rev.content);
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingContent.trim()) return;
    await ReviewService.updateReview(id, editingContent.trim());
    setEditingReviewId(null);
    setEditingContent('');
    loadReviews();
  };

  useEffect(() => {
    loadInfo();
    // Load local storage user entries for live mapping
    try {
      const dbStr = localStorage.getItem('exam_app_users_db');
      if (dbStr) {
        setUsersMap(JSON.parse(dbStr));
      }
    } catch (e) {}

    // Load comments
    try {
      const savedComs = localStorage.getItem('exam_review_comments');
      if (savedComs) {
        setAllComments(JSON.parse(savedComs));
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
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      <div className="space-y-3 text-center sm:text-left">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">시험 후기 게시판</h1>
        <p className="text-slate-500 font-medium">과목별 시험 난이도와 의견을 나누어 보세요.</p>
        <p className="text-xs text-rose-500 font-extrabold bg-rose-50/50 border border-rose-100/60 px-4 py-3 rounded-2xl flex items-center justify-center sm:justify-start gap-2">
          📢 깨끗하고 올바른 대화 환경을 위해 타인에 대한 무분별한 비난이나 비속어를 삼가주세요.
        </p>
      </div>

      <div className="space-y-6">
        {/* Subject selector Dropdown Select - styled elegant matching 투표 대상 과목 선택 */}
        <div className="flex flex-col items-center justify-center border-b border-slate-100 pb-5">
          <div className="w-full max-w-xs relative bg-white rounded-3xl p-1 shadow-sm">
            <label htmlFor="reviews-exam-select" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 text-center">조회 및 게시 대상 과목 선택</label>
            <div className="relative">
              <select
                id="reviews-exam-select"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full h-11 px-4 pr-10 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none text-center shadow-sm"
              >
                <option value="all">전체 과목 후기</option>
                {exams.map((exam) => (
                  <option key={`reviews-opt-${exam.id}`} value={exam.id}>
                    {exam.title}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 bottom-3.5 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Content: Reviews Feed */}
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
                    <span className="text-[11px] font-bold text-slate-500 font-sans font-black">과목 지정:</span>
                    <select
                      value={postExamId}
                      onChange={(e) => setPostExamId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
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
                  className="w-full h-32 p-5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-200 transition-all font-semibold resize-none text-slate-800 text-sm placeholder-slate-400"
                />
                <button
                  type="submit"
                  className="absolute bottom-4 right-4 h-11 px-5 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-black transition-all active:scale-95 flex items-center gap-2 cursor-pointer text-xs"
                >
                  <Send size={14} /> 게시
                </button>
              </form>
            </div>
          )}

          {/* List */}
          <div className="space-y-5">
            <AnimatePresence mode="popLayout">
              {reviews.map((rev, idx) => {
                const commentsCount = allComments.filter(c => c.reviewId === rev.id).length;
                const isExpanded = !!expandedReviewIds[rev.id];

                return (
                  <motion.div
                    key={rev.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white p-6 rounded-[28px] border border-slate-50 shadow-sm space-y-4"
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

                      {/* Actions: Edit & Delete buttons if authorized */}
                      {(rev.userId === userData.studentId || userData.role === 'admin') && editingReviewId !== rev.id && (
                        <div className="flex items-center gap-2 select-none">
                          <button
                            onClick={() => handleStartEdit(rev)}
                            className="text-xs font-bold text-slate-450 hover:text-indigo-600 transition-colors"
                          >
                            수정
                          </button>
                          <span className="text-[10px] text-slate-200">|</span>
                          <button
                            onClick={() => handleDelete(rev.id)}
                            className="text-xs font-bold text-slate-450 hover:text-rose-600 transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>

                    {editingReviewId === rev.id ? (
                      <div className="space-y-2 pl-1.5">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full h-24 p-4 border border-slate-200 rounded-xl bg-slate-50 text-slate-850 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-semibold resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleSaveEdit(rev.id)}
                            className="h-8 px-4 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all active:scale-95"
                          >
                            완료
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="h-8 px-4 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all active:scale-95"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => handleToggleExpand(rev.id)}
                        className="cursor-pointer group/content"
                      >
                        <p className="text-slate-650 text-sm leading-relaxed font-semibold pl-1.5 group-hover/content:text-slate-900 transition-all">
                          {rev.content}
                        </p>
                      </div>
                    )}

                    {/* Integrated Comments section toggle line */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-1 select-none">
                      <button
                        onClick={() => handleToggleExpand(rev.id)}
                        className="flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        <MessageSquare size={13} className="text-slate-400" />
                        <span>댓글 {commentsCount}개</span>
                      </button>
                      <button
                        onClick={() => handleToggleExpand(rev.id)}
                        className="text-[10px] font-extrabold text-slate-440 hover:text-indigo-600 transition-all cursor-pointer"
                      >
                        {isExpanded ? '댓글 접기 ▲' : '댓글 작성 및 보기 ▼'}
                      </button>
                    </div>

                    {/* Expandable comments list and writer block */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-fade-in pl-1">
                        {/* List of comments */}
                        {allComments.filter(c => c.reviewId === rev.id).length > 0 ? (
                          <div className="space-y-3.5 pl-3 border-l-2 border-slate-150">
                            {allComments.filter(c => c.reviewId === rev.id).map((com) => (
                              <div key={com.id} className="bg-slate-50/60 p-3.5 rounded-2xl border border-slate-100/70 space-y-1.5 relative group">
                                <div className="flex items-center justify-between select-none">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-black text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded-lg">
                                      {getReviewerName(com).split(' ')[1] || com.nickname || com.userId} ({com.userId})
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-bold">{new Date(com.createdAt).toLocaleString()}</span>
                                  </div>
                                  
                                  {/* Actions: Edit or Delete comment */}
                                  {(com.userId === userData.studentId || userData.role === 'admin') && editingCommentId !== com.id && (
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      <button
                                        onClick={() => handleStartEditComment(com)}
                                        className="font-bold text-slate-450 hover:text-indigo-600 transition-colors cursor-pointer"
                                      >
                                        수정
                                      </button>
                                      <span className="text-[9.5px] text-slate-200">|</span>
                                      <button
                                        onClick={() => handleDeleteComment(com.id)}
                                        className="font-bold text-slate-450 hover:text-rose-600 transition-colors cursor-pointer"
                                      >
                                        삭제
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {editingCommentId === com.id ? (
                                  <div className="space-y-2 mt-1">
                                    <input
                                      type="text"
                                      value={editingCommentText}
                                      onChange={(e) => setEditingCommentText(e.target.value)}
                                      className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 font-semibold"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEditComment(com.id);
                                      }}
                                    />
                                    <div className="flex gap-1.5 justify-end">
                                      <button
                                        onClick={() => handleSaveEditComment(com.id)}
                                        className="h-7 px-3 bg-indigo-600 text-white rounded-lg text-[10px] font-extrabold hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
                                      >
                                        완료
                                      </button>
                                      <button
                                        onClick={handleCancelEditComment}
                                        className="h-7 px-3 bg-slate-100 text-slate-550 rounded-lg text-[10px] font-bold hover:bg-slate-250 active:scale-95 transition-all cursor-pointer"
                                      >
                                        취소
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-slate-650 text-xs font-semibold pl-1 whitespace-pre-line leading-relaxed">
                                    {com.content}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-4 text-center select-none">
                            <span className="text-[11px] font-bold text-slate-350">작성된 댓글이 없습니다. 첫 마디를 나누어보세요!</span>
                          </div>
                        )}

                        {/* "글을 쓰는것처럼해서" - New Comment Input Form */}
                        <div className="bg-slate-50/75 rounded-2xl p-3 border border-slate-100 space-y-2">
                          <span className="text-[10px] font-black text-slate-450 block px-1 select-none">
                            💬 댓글 작성하기
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newCommentContent[rev.id] || ''}
                              onChange={(e) => setNewCommentContent(prev => ({ ...prev, [rev.id]: e.target.value }))}
                              placeholder="댓글 작성하기"
                              className="flex-1 text-xs px-3.5 h-10 border border-slate-150 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 font-semibold text-slate-800 placeholder-slate-400"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddComment(rev.id);
                                }
                              }}
                            />
                            <button
                              onClick={() => handleAddComment(rev.id)}
                              className="h-10 px-4 bg-indigo-600 font-extrabold text-white rounded-xl text-xs hover:bg-slate-900 active:scale-95 transition-all outline-none cursor-pointer"
                            >
                              등록
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
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
