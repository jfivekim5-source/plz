import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { db, auth, isPlaceholder } from '@/src/lib/firebase';
import { Exam, Question, Submission } from '@/src/types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const SUBMISSIONS_KEY = 'exam_app_submissions_v3';
const EXAMS_KEY = 'exam_app_exams_v3';
const REVIEWS_KEY = 'exam_app_reviews_v3';

// Initial Mock Exams
const INITIAL_EXAMS: Exam[] = [
  {
    id: 'exam-speech-lang',
    title: '화법과 언어',
    grade: '고2',
    subject: '국어',
    isOpen: true,
    questionCount: 28
  },
  {
    id: 'exam-algebra',
    title: '대수',
    grade: '고2',
    subject: '수학',
    isOpen: true,
    questionCount: 22
  },
  {
    id: 'exam-english1',
    title: '영어 I',
    grade: '고2',
    subject: '영어',
    isOpen: true,
    questionCount: 30
  },
  {
    id: 'exam-physics',
    title: '물리학',
    grade: '고2',
    subject: '과학',
    isOpen: true,
    questionCount: 20
  },
  {
    id: 'exam-earth',
    title: '지구과학',
    grade: '고2',
    subject: '과학',
    isOpen: true,
    questionCount: 24
  },
  {
    id: 'exam-chemistry',
    title: '화학',
    grade: '고2',
    subject: '과학',
    isOpen: true,
    questionCount: 20
  },
  {
    id: 'exam-ai-basics',
    title: '인공지능 기초',
    grade: '고2',
    subject: '정보기술',
    isOpen: true,
    questionCount: 20
  },
  {
    id: 'exam-lit-video',
    title: '문학과 영상',
    grade: '고2',
    subject: '국어',
    isOpen: true,
    questionCount: 20
  },
  {
    id: 'exam-adv-english',
    title: '심화영어',
    grade: '고2',
    subject: '영어',
    isOpen: true,
    questionCount: 20
  },
  {
    id: 'exam-world-history',
    title: '세계사',
    grade: '고2',
    subject: '사회',
    isOpen: true,
    questionCount: 20
  },
  {
    id: 'exam-modern-society-ethics',
    title: '현대사회와 윤리',
    grade: '고2',
    subject: '사회',
    isOpen: true,
    questionCount: 20
  },
  {
    id: 'exam-society-culture',
    title: '사회와 문화',
    grade: '고2',
    subject: '사회',
    isOpen: true,
    questionCount: 20
  },
  {
    id: 'exam-global-citizenship-geo',
    title: '세계시민과 지리',
    grade: '고2',
    subject: '사회',
    isOpen: true,
    questionCount: 20
  },
  {
    id: 'exam-life-sciences',
    title: '생명과학',
    grade: '고2',
    subject: '과학',
    isOpen: true,
    questionCount: 20
  },
  {
    id: 'exam-ai-math',
    title: '인공지능 수학',
    grade: '고2',
    subject: '수학',
    isOpen: true,
    questionCount: 20
  }
];

// Initial Mock Reviews
const INITIAL_REVIEWS: any[] = [];

export const ReviewService = {
  async getReviews(examId?: string): Promise<any[]> {
    if (isPlaceholder) {
      const saved = localStorage.getItem(REVIEWS_KEY);
      const reviews = saved ? JSON.parse(saved) : INITIAL_REVIEWS;
      if (examId) return reviews.filter((r: any) => r.examId === examId);
      return reviews;
    }

    try {
      const q = query(collection(db!, 'reviews'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      let filtered = [...list];
      if (examId && examId !== 'all') {
        filtered = filtered.filter((r: any) => r.examId === examId);
      }
      
      filtered.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      if (filtered.length === 0) return INITIAL_REVIEWS.filter(r => examId && examId !== 'all' ? r.examId === examId : true);
      return filtered;
    } catch (error) {
      console.warn("Firestore reviews fallback", error);
      const fallback = INITIAL_REVIEWS;
      if (examId && examId !== 'all') {
        return fallback.filter((r: any) => r.examId === examId);
      }
      return fallback;
    }
  },
  async addReview(review: { examId: string, userId: string, content: string, nickname?: string }) {
    if (isPlaceholder) {
      const reviews = await this.getReviews();
      const newReview = { ...review, id: `REV-${Date.now()}`, createdAt: new Date().toISOString() };
      reviews.unshift(newReview);
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
      return;
    }

    try {
      await setDoc(doc(db!, 'reviews', `REV-${Date.now()}`), {
        ...review,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reviews');
    }
  },
  async deleteReview(reviewId: string) {
    if (isPlaceholder) {
      const reviews = await this.getReviews();
      const updated = reviews.filter((r: any) => r.id !== reviewId);
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(updated));
      return;
    }
    try {
      await deleteDoc(doc(db!, 'reviews', reviewId));
    } catch (error) {
      console.warn("Firestore delete review error", error);
    }
  },
  async updateReview(reviewId: string, newContent: string) {
    if (isPlaceholder) {
      const reviews = await this.getReviews();
      const updated = reviews.map((r: any) => r.id === reviewId ? { ...r, content: newContent } : r);
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(updated));
      return;
    }
    try {
      await updateDoc(doc(db!, 'reviews', reviewId), { content: newContent });
    } catch (error) {
      console.warn("Firestore update review error", error);
    }
  }
};

let cachedExams: Exam[] | null = null;
const questionsCache: Record<string, Question[]> = {};

export const ExamService = {
  async getExams(): Promise<Exam[]> {
    if (cachedExams) {
      return cachedExams;
    }

    if (isPlaceholder) {
      const saved = localStorage.getItem(EXAMS_KEY);
      let list = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(list)) list = [];
      const mergedList = [...INITIAL_EXAMS];
      list.forEach((e: any) => {
        const existingIdx = mergedList.findIndex((ie) => ie.id === e.id);
        if (existingIdx !== -1) {
          mergedList[existingIdx] = { ...mergedList[existingIdx], ...e };
        } else {
          mergedList.push(e);
        }
      });
      localStorage.setItem(EXAMS_KEY, JSON.stringify(mergedList));
      cachedExams = mergedList;
      return mergedList;
    }

    try {
      const snapshot = await getDocs(collection(db!, 'exams'));
      const dbExams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      const mergedList = [...INITIAL_EXAMS];
      
      dbExams.forEach((e: any) => {
        const existingIdx = mergedList.findIndex((ie) => ie.id === e.id);
        if (existingIdx !== -1) {
          mergedList[existingIdx] = { ...mergedList[existingIdx], ...e };
        } else {
          mergedList.push(e);
        }
      });

      // Background non-blocking seeding of any missing exams
      const missingExams = INITIAL_EXAMS.filter(ie => !dbExams.some(e => e.id === ie.id));
      if (missingExams.length > 0) {
        Promise.all(
          missingExams.map(ie => 
            setDoc(doc(db!, 'exams', ie.id), ie).catch(() => {})
          )
        ).catch(() => {});
      }

      cachedExams = mergedList;
      return mergedList;
    } catch (error) {
      console.warn("Firestore getExams error, falling back to INITIAL_EXAMS", error);
      cachedExams = INITIAL_EXAMS;
      return INITIAL_EXAMS;
    }
  },

  async getExam(examId: string): Promise<Exam | null> {
    const exams = await this.getExams();
    return exams.find(e => e.id === examId) || null;
  },

  async addExam(exam: Exam): Promise<void> {
    cachedExams = null;
    if (isPlaceholder) {
      const exams = await this.getExams();
      if (!exams.some(e => e.id === exam.id)) {
        exams.push(exam);
        localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
      }
      return;
    }

    try {
      await setDoc(doc(db!, 'exams', exam.id), exam);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `exams/${exam.id}`);
    }
  },

  async saveQuestions(examId: string, questions: Question[]): Promise<void> {
    localStorage.setItem(`custom_questions_${examId}`, JSON.stringify(questions));

    // Update in-memory cache
    questionsCache[examId] = questions;

    // Update the exam's questionCount in memory, local storage, and Firestore
    if (cachedExams) {
      const exam = cachedExams.find(e => e.id === examId);
      if (exam) {
        exam.questionCount = questions.length;
      }
    }

    const savedExams = localStorage.getItem(EXAMS_KEY);
    if (savedExams) {
      try {
        const exams = JSON.parse(savedExams);
        const exam = exams.find((e: any) => e.id === examId);
        if (exam) {
          exam.questionCount = questions.length;
          localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
        } else {
          const initExam = INITIAL_EXAMS.find(e => e.id === examId);
          if (initExam) {
            exams.push({ ...initExam, questionCount: questions.length });
            localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
          }
        }
      } catch (e) {}
    } else {
      const initExam = INITIAL_EXAMS.find(e => e.id === examId);
      if (initExam) {
        localStorage.setItem(EXAMS_KEY, JSON.stringify([{ ...initExam, questionCount: questions.length }]));
      }
    }

    if (!isPlaceholder && db) {
      try {
        const examRef = doc(db!, 'exams', examId);
        await setDoc(examRef, { questionCount: questions.length }, { merge: true });
      } catch (error) {
        console.error('Failed to update exam questionCount in Firestore', error);
      }
    }

    // Clear submissions cache to force re-computation of rankings
    delete submissionsCache[examId];
    cachedExams = null; // Force reload of exams from source to get updated questionCount

    // Recalculate and update existing real submissions for this exam!
    let realSubs: Submission[] = [];
    if (!isPlaceholder && db) {
      try {
        const snapshot = await getDocs(collection(db, 'exams', examId, 'submissions'));
        if (!snapshot.empty) {
          realSubs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isDummy: false } as any as Submission));
        }
      } catch (error) {
        console.warn('Firestore fetch failed for recalculation, using local', error);
      }
    }

    if (realSubs.length === 0) {
      const saved = localStorage.getItem(REAL_SUBMISSIONS_KEY);
      if (saved) {
        realSubs = JSON.parse(saved).filter((s: Submission) => s.examId === examId);
      }
    }

    const updatedRealSubs = realSubs.map(sub => {
      let totalScore = 0;
      const updatedAnswers = sub.answers.map(ans => {
        const q = questions.find(item => item.number === ans.number);
        if (!q) return ans;

        if (q.type === 'multiple') {
          const isCorrect = q.answer === ans.userAnswer;
          const score = isCorrect ? q.score : 0;
          totalScore += score;
          return { ...ans, isCorrect, score };
        } else {
          const userDefinedScore = Number(ans.userAnswer) || 0;
          const score = Math.min(q.score, userDefinedScore);
          totalScore += score;
          return { ...ans, isCorrect: score > 0, score };
        }
      });

      return {
        ...sub,
        answers: updatedAnswers,
        totalScore
      };
    });

    // Save to local storage
    const allLocalSaved = localStorage.getItem(REAL_SUBMISSIONS_KEY);
    let allLocalSubs: Submission[] = [];
    if (allLocalSaved) {
      allLocalSubs = JSON.parse(allLocalSaved).filter((s: Submission) => s.examId !== examId);
    }
    allLocalSubs.push(...updatedRealSubs);
    localStorage.setItem(REAL_SUBMISSIONS_KEY, JSON.stringify(allLocalSubs));

    if (!isPlaceholder && db) {
      try {
        // Save questions to Firestore
        await Promise.all(
          questions.map(q => 
            setDoc(doc(db!, 'exams', examId, 'questions', q.id || `Q-${q.number}`), q)
          )
        );

        // Update real submissions on Firestore
        if (updatedRealSubs.length > 0) {
          await Promise.all(
            updatedRealSubs.map(sub =>
              setDoc(doc(db!, 'exams', examId, 'submissions', sub.userId), sub)
            )
          );
        }
      } catch (error) {
        console.error('Firestore saveQuestions / submissions recalculation failed', error);
      }
    }
  },

  async getQuestions(examId: string): Promise<Question[]> {
    if (questionsCache[examId]) {
      return questionsCache[examId];
    }

    const savedKey = `custom_questions_${examId}`;
    const savedData = localStorage.getItem(savedKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        questionsCache[examId] = parsed;
        return parsed;
      } catch (e) {}
    }

    const exams = await this.getExams();
    const generateMockQuestions = (id: string): Question[] => {
      const exam = exams.find(e => e.id === id);
      if (!exam) return [];
      const seeded: Question[] = [];
      for (let i = 1; i <= exam.questionCount; i++) {
        const isChoice = ['exam-ai-basics', 'exam-lit-video', 'exam-adv-english', 'exam-world-history', 'exam-modern-society-ethics', 'exam-society-culture', 'exam-global-citizenship-geo', 'exam-life-sciences', 'exam-ai-math'].includes(id) ? true :
                         id === 'exam-speech-lang' ? true :
                         id === 'exam-algebra' ? i <= 15 :
                         id === 'exam-physics' ? i <= 15 :
                         id === 'exam-chemistry' ? true :
                         id === 'exam-earth' ? true :
                         id === 'exam-english1' ? i <= 24 : true;

        const score = ['exam-ai-basics', 'exam-lit-video', 'exam-adv-english', 'exam-world-history', 'exam-modern-society-ethics', 'exam-society-culture', 'exam-global-citizenship-geo', 'exam-life-sciences', 'exam-ai-math'].includes(id) ? 5 :
                      id === 'exam-speech-lang' ? (i <= 20 ? 3 : 5) :
                      id === 'exam-algebra' ? (isChoice ? 4 : 6) :
                      id === 'exam-physics' ? (isChoice ? 4 : 8) :
                      id === 'exam-chemistry' ? 5 :
                      id === 'exam-earth' ? 4 :
                      id === 'exam-english1' ? (isChoice ? 3 : 5) : 4;

        const answer = id === 'exam-algebra' ? '1' : (isChoice ? ((i % 5) + 1).toString() : (10 + (i * 3) % 90).toString());
        seeded.push({
          id: `Q-${i}`,
          examId: id,
          number: i,
          answer,
          score,
          type: isChoice ? 'multiple' : 'subjective'
        });
      }
      return seeded;
    };

    if (isPlaceholder) {
      const seedList = generateMockQuestions(examId);
      questionsCache[examId] = seedList;
      return seedList;
    }
    if (!db) return [];
    try {
      const snapshot = await getDocs(collection(db, 'exams', examId, 'questions'));
      if (snapshot.empty) {
        // Automatically seed questions into Firebase for this exam in the background parallelly!
        const seedList = generateMockQuestions(examId);
        Promise.all(
          seedList.map(q => 
            setDoc(doc(db!, 'exams', examId, 'questions', q.id), q).catch(() => {})
          )
        ).catch(() => {});
        questionsCache[examId] = seedList;
        return seedList;
      }
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      questionsCache[examId] = list;
      return list;
    } catch (error) {
      console.error('getQuestions failed', error);
      const seedList = generateMockQuestions(examId);
      questionsCache[examId] = seedList;
      return seedList;
    }
  }
};

const REAL_SUBMISSIONS_KEY = 'exam_app_real_submissions_v3';

const dummySubmissionsCache: Record<string, Submission[]> = {};
const submissionsCache: Record<string, Submission[]> = {};

const EXAM_MEMBERS_MAP: Record<string, number> = {
  'exam-speech-lang': 396,
  'exam-algebra': 396,
  'exam-english1': 396,
  'exam-physics': 215,
  'exam-chemistry': 216,
  'exam-earth': 148,
  'exam-ai-basics': 186,
  'exam-ai-math': 120,
};

export const isExamSupported = (examId: string): boolean => {
  return Object.prototype.hasOwnProperty.call(EXAM_MEMBERS_MAP, examId);
};

export const getExamCapacity = (examId: string): number => {
  return EXAM_MEMBERS_MAP[examId] || 100;
};

export const SubmissionService = {
  async getRealSubmissions(): Promise<Submission[]> {
    const saved = localStorage.getItem(REAL_SUBMISSIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  },

  async submit(submission: Submission) {
    delete submissionsCache[submission.examId];

    if (isPlaceholder) {
      const reals = await this.getRealSubmissions();
      const filtered = reals.filter(s => !(s.userId === submission.userId && s.examId === submission.examId));
      const newSub = { 
        ...submission, 
        id: submission.id || `SUB-${Date.now()}-${submission.userId}`, 
        submittedAt: new Date().toISOString() 
      };
      filtered.push(newSub);
      localStorage.setItem(REAL_SUBMISSIONS_KEY, JSON.stringify(filtered));
      return;
    }

    try {
      await setDoc(doc(db!, 'exams', submission.examId, 'submissions', submission.userId), {
        ...submission,
        submittedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `exams/${submission.examId}/submissions/${submission.userId}`);
    }
  },

  async getMySubmission(examId: string, userId: string): Promise<Submission | null> {
    if (isPlaceholder) {
      const reals = await this.getRealSubmissions();
      return reals.find(s => s.examId === examId && s.userId === userId) || null;
    }

    try {
      const docSnap = await getDoc(doc(db!, 'exams', examId, 'submissions', userId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Submission;
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  generateMockStudentIds(capacity: number): string[] {
    const pool: string[] = [];
    
    // 1. 20101 ~ 20931 (n is 1 to 9, idx is 1 to 31)
    for (let n = 1; n <= 9; n++) {
      for (let idx = 1; idx <= 31; idx++) {
        const classStr = n.toString();
        const idxStr = idx.toString().padStart(2, '0');
        pool.push(`20${classStr}${idxStr}`);
      }
    }
    
    // 2. 21001 ~ 21431 (m is 0 to 4, idx is 1 to 31)
    for (let m = 0; m <= 4; m++) {
      for (let idx = 1; idx <= 31; idx++) {
        const classStr = m.toString();
        const idxStr = idx.toString().padStart(2, '0');
        pool.push(`21${classStr}${idxStr}`);
      }
    }
    
    // High-performance slice to avoid expensive repeated array splicing
    return pool.slice(0, capacity);
  },

  generateDummySubmissions(examId: string, capacity: number): Submission[] {
    const cacheKey = `${examId}-${capacity}`;
    if (dummySubmissionsCache[cacheKey]) {
      return dummySubmissionsCache[cacheKey];
    }

    const list: Submission[] = [];
    const studentIds = this.generateMockStudentIds(capacity);
    
    // 미응답자 비율 (예: 약 15%)은 0점으로 둡니다.
    const noResponsePercentage = 0.15;
    const noResponseCount = Math.floor(capacity * noResponsePercentage);

    for (let i = 0; i < capacity; i++) {
      const studentId = studentIds[i] || `DUMMY-${examId}-${(i + 1).toString().padStart(4, '0')}`;
      
      let totalScore = 0;
      if (i < noResponseCount) {
        // 미응답자는 0점 처리
         totalScore = 0;
      } else {
        // 나머지 인원은 0~100점 고루고루(Uniform) 분포되게 함
        const scaleIndex = i - noResponseCount;
        const scaleTotal = capacity - noResponseCount;
        totalScore = Math.max(0, Math.min(100, Math.round((scaleIndex / (scaleTotal - 1 || 1)) * 100)));
      }

      list.push({
        id: `SUB-${studentId}-${examId}`,
        userId: studentId,
        examId: examId,
        answers: Array.from({ length: 20 }, (_, k) => ({
          number: k + 1,
          userAnswer: '1',
          isCorrect: Math.random() < (totalScore / 100),
          score: Math.random() < (totalScore / 100) ? 5 : 0
        })),
        totalScore,
        isDummy: true,
        submittedAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
      });
    }

    dummySubmissionsCache[cacheKey] = list;
    return list;
  },

  async getAllSubmissions(examId: string): Promise<Submission[]> {
    if (submissionsCache[examId]) {
      return submissionsCache[examId];
    }

    const capacity = getExamCapacity(examId);

    const dummyList = this.generateDummySubmissions(examId, capacity);

    let realSubs: Submission[] = [];
    if (!isPlaceholder && db) {
      try {
        const snapshot = await getDocs(collection(db, 'exams', examId, 'submissions'));
        if (!snapshot.empty) {
          realSubs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isDummy: false } as any as Submission));
        }
      } catch (error) {
        console.warn('Firestore fetch failed, falling back to mock data', error);
        realSubs = await this.getRealSubmissions();
        realSubs = realSubs.filter(s => s.examId === examId).map(s => ({ ...s, isDummy: false }));
      }
    } else {
      realSubs = await this.getRealSubmissions();
      realSubs = realSubs.filter(s => s.examId === examId).map(s => ({ ...s, isDummy: false }));
    }

    if (realSubs.length === 0) {
      const exampleScores = [100, 96, 92, 92, 88, 88, 84, 84, 80, 80, 76, 76, 72, 68, 64, 60, 56, 48, 44, 32, 20];
      realSubs = exampleScores.map((score, idx) => ({
        id: `PRE-REAL-${idx}-${examId}`,
        userId: `26-20${(301 + idx)}`,
        examId: examId,
        answers: Array.from({ length: 20 }, (_, k) => ({
          number: k + 1,
          userAnswer: '1',
          isCorrect: Math.random() < (score / 100),
          score: Math.random() < (score / 100) ? 5 : 0
        })),
        totalScore: score,
        isDummy: false,
        submittedAt: new Date(Date.now() - idx * 3600000).toISOString()
      }));
    }

    const realCount = realSubs.length;
    let finalResult = dummyList;
    if (realCount > 0) {
      const listCopy = [...dummyList];
      for (let r = 0; r < realCount; r++) {
        const realSub = realSubs[r];
        const cleanRealId = realSub.userId.replace(/^26-/, '');
        
        // Find if there is a dummy submission with this exact student ID
        const matchIndex = listCopy.findIndex(d => d.isDummy && d.userId === cleanRealId);
        if (matchIndex !== -1) {
          listCopy[matchIndex] = realSub;
        } else {
          // Fallback to replacing any zero-score or any dummy
          const zeroIndex = listCopy.findIndex(d => d.isDummy && d.totalScore === 0);
          if (zeroIndex !== -1) {
            listCopy[zeroIndex] = realSub;
          } else {
            const anyDummyIndex = listCopy.findIndex(d => d.isDummy);
            if (anyDummyIndex !== -1) {
              listCopy[anyDummyIndex] = realSub;
            } else {
              listCopy.push(realSub);
            }
          }
        }
      }
      finalResult = listCopy;
    }

    submissionsCache[examId] = finalResult;
    return finalResult;
  },

  async getAllSubmissionsRaw(examIds?: string[]): Promise<Submission[]> {
    const targetExams = examIds && examIds.length > 0
      ? INITIAL_EXAMS.filter(e => examIds.includes(e.id))
      : INITIAL_EXAMS;

    const results = await Promise.all(
      targetExams.map(exam => this.getAllSubmissions(exam.id))
    );
    const all: Submission[] = [];
    for (const subs of results) {
      all.push(...subs);
    }
    return all;
  },

  async getAllSubmissionsAcrossExams(examIds?: string[]): Promise<Submission[]> {
    return this.getAllSubmissionsRaw(examIds);
  }
};

export const GradeCalculator = {
  calculateGrade(rankingPercentage: number): number {
    if (rankingPercentage <= 10) return 1;
    if (rankingPercentage <= 34) return 2;
    if (rankingPercentage <= 66) return 3;
    if (rankingPercentage <= 90) return 4;
    return 5;
  },

  getStats(score: number, allSubmissions: Submission[]) {
    const scores = allSubmissions.map(s => s.totalScore).sort((a, b) => b - a);
    const total = scores.length || 1;
    const higher = scores.filter(s => s > score).length;
    const rank = higher + 1;
    const rankingPercentage = (rank / total) * 100;
    const grade = this.calculateGrade(rankingPercentage);

    return {
      rank,
      totalParticipants: total,
      percentile: 100 - Math.round(((rank - 1) / total) * 100),
      grade
    };
  }
};

export const SettingsService = {
  async getSettings(): Promise<any> {
    const defaultSubjects: Record<string, { minResponseRate: number; scoreChangeDiff: number; discloseGrading: boolean; discloseStats: boolean }> = {};
    const subIds = [
      'exam-speech-lang', 'exam-algebra', 'exam-english1', 'exam-physics', 
      'exam-chemistry', 'exam-earth', 'exam-ai-basics', 'exam-ai-math'
    ];
    subIds.forEach(id => {
      defaultSubjects[id] = {
        minResponseRate: id === 'exam-algebra' ? 100 : 40,
        scoreChangeDiff: 1,
        discloseGrading: true,
        discloseStats: true
      };
    });
    const defaultSettings = {
      allowGuestView: false,
      allowGuestVoteView: true,
      subjects: defaultSubjects
    };

    // 1. Try Firestore if not placeholder
    if (!isPlaceholder && db) {
      try {
        const snap = await getDoc(doc(db, 'settings', 'site'));
        if (snap.exists()) {
          const parsed = snap.data();
          if (parsed && parsed.subjects) {
            Object.keys(parsed.subjects).forEach(id => {
              const sub = parsed.subjects[id];
              if (sub.discloseGrading === undefined) sub.discloseGrading = true;
              if (sub.discloseStats === undefined) sub.discloseStats = true;
            });
          }
          return parsed;
        }
      } catch (error) {
        console.error('Firestore load settings failed', error);
      }
    }

    // 2. Fall back to local storage
    const stored = localStorage.getItem('exam_app_site_settings_v3');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.subjects) {
          Object.keys(parsed.subjects).forEach(id => {
            const sub = parsed.subjects[id];
            if (sub.discloseGrading === undefined) sub.discloseGrading = true;
            if (sub.discloseStats === undefined) sub.discloseStats = true;
          });
        }
        return parsed;
      } catch (e) {}
    }

    return defaultSettings;
  },

  async saveSettings(settings: any): Promise<void> {
    localStorage.setItem('exam_app_site_settings_v3', JSON.stringify(settings));
    if (!isPlaceholder && db) {
      try {
        await setDoc(doc(db, 'settings', 'site'), settings);
      } catch (error) {
        console.error('Firestore save settings failed', error);
      }
    }
  }
};

