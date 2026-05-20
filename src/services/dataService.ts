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
  onSnapshot
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
  }
];

// Initial Mock Reviews
const INITIAL_REVIEWS = [
  { id: 'r1', examId: 'exam-speech-lang', userId: '20401', content: '이번 화작 좀 까다로웠던 것 같아요...', createdAt: new Date().toISOString() },
  { id: 'r2', examId: 'exam-algebra', userId: '20512', content: '대수 15번 실화입니까? 너무 어려움', createdAt: new Date().toISOString() },
];

export const ReviewService = {
  async getReviews(examId?: string): Promise<any[]> {
    if (isPlaceholder) {
      const saved = localStorage.getItem(REVIEWS_KEY);
      const reviews = saved ? JSON.parse(saved) : INITIAL_REVIEWS;
      if (examId) return reviews.filter((r: any) => r.examId === examId);
      return reviews;
    }

    try {
      const q = examId 
        ? query(collection(db!, 'reviews'), where('examId', '==', examId), orderBy('createdAt', 'desc'))
        : query(collection(db!, 'reviews'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return INITIAL_REVIEWS;
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return INITIAL_REVIEWS;
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
  }
};

export const ExamService = {
  async getExams(): Promise<Exam[]> {
    if (isPlaceholder) {
      const saved = localStorage.getItem(EXAMS_KEY);
      let list = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(list)) list = [];
      const mergedList = [...INITIAL_EXAMS];
      list.forEach((e: any) => {
        if (!mergedList.some((ie) => ie.id === e.id)) {
          mergedList.push(e);
        }
      });
      localStorage.setItem(EXAMS_KEY, JSON.stringify(mergedList));
      return mergedList;
    }

    try {
      const snapshot = await getDocs(collection(db!, 'exams'));
      const dbExams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      const mergedList = [...INITIAL_EXAMS];
      
      for (const ie of INITIAL_EXAMS) {
        if (!dbExams.some(e => e.id === ie.id)) {
          try {
            await setDoc(doc(db!, 'exams', ie.id), ie);
          } catch(e){}
        }
      }
      
      dbExams.forEach((e: any) => {
        if (!mergedList.some((ie) => ie.id === e.id)) {
          mergedList.push(e);
        }
      });
      return mergedList;
    } catch (error) {
      return INITIAL_EXAMS;
    }
  },

  async getExam(examId: string): Promise<Exam | null> {
    const exams = await this.getExams();
    return exams.find(e => e.id === examId) || null;
  },

  async addExam(exam: Exam): Promise<void> {
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

  async getQuestions(examId: string): Promise<Question[]> {
    const exams = await this.getExams();
    const generateMockQuestions = (id: string): Question[] => {
      const exam = exams.find(e => e.id === id);
      if (!exam) return [];
      const seeded: Question[] = [];
      for (let i = 1; i <= exam.questionCount; i++) {
        const isChoice = id === 'exam-speech-lang' ? true :
                         id === 'exam-algebra' ? i <= 15 :
                         id === 'exam-physics' ? i <= 15 :
                         id === 'exam-chemistry' ? true :
                         id === 'exam-earth' ? true :
                         id === 'exam-english1' ? i <= 24 : true;

        const score = id === 'exam-speech-lang' ? (i <= 20 ? 3 : 5) :
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
      if (examId === 'exam-algebra') {
        return seedList.map(q => ({ ...q, answer: '1' }));
      }
      return seedList;
    }
    if (!db) return [];
    try {
      const snapshot = await getDocs(collection(db, 'exams', examId, 'questions'));
      if (snapshot.empty) {
        // Automatically seed questions into Firebase for this exam
        const seedList = generateMockQuestions(examId);
        for (const q of seedList) {
          try {
            await setDoc(doc(db, 'exams', examId, 'questions', q.id), q);
          } catch (seedErr) {
            console.error(`Failed to write seeded question Q-${q.number} for ${examId}:`, seedErr);
          }
        }
        return seedList;
      }
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
      if (examId === 'exam-algebra') {
        return list.map(q => ({ ...q, answer: '1' }));
      }
      return list;
    } catch (error) {
      console.error('getQuestions failed', error);
      const seedList = generateMockQuestions(examId);
      if (examId === 'exam-algebra') {
        return seedList.map(q => ({ ...q, answer: '1' }));
      }
      return seedList;
    }
  }
};

const REAL_SUBMISSIONS_KEY = 'exam_app_real_submissions_v3';

export const SubmissionService = {
  async getRealSubmissions(): Promise<Submission[]> {
    const saved = localStorage.getItem(REAL_SUBMISSIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  },

  async submit(submission: Submission) {
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
    for (let c = 1; c <= 14; c++) {
      for (let s = 1; s <= 30; s++) {
        const classStr = c.toString().padStart(2, '0');
        const numStr = s.toString().padStart(2, '0');
        pool.push(`2${classStr}${numStr}`);
      }
    }
    // 400명 초과시 뒷번호부터 랜덤으로 삭제되도록 후반부 인덱스에서 무작위 선택하여 제거
    while (pool.length > capacity) {
      const startIndex = Math.floor(pool.length * 0.7);
      const deleteIdx = startIndex + Math.floor(Math.random() * (pool.length - startIndex));
      pool.splice(deleteIdx, 1);
    }
    return pool;
  },

  generateDummySubmissions(examId: string, capacity: number): Submission[] {
    const list: Submission[] = [];
    const studentIds = this.generateMockStudentIds(capacity);
    for (let i = 0; i < capacity; i++) {
      const studentId = studentIds[i] || `DUMMY-${examId}-${(i + 1).toString().padStart(4, '0')}`;
      
      // 대수(exam-algebra): 0~100점 균등 분포, 나머지: 1~50점 균등 분포
      const totalScore = examId === 'exam-algebra'
        ? Math.round((i * 100) / (capacity - 1))
        : Math.round(1 + ((i * 49) / (capacity - 1)));

      list.push({
        id: `SUB-${studentId}-${examId}`,
        userId: studentId,
        examId: examId,
        answers: [],
        totalScore,
        submittedAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
      });
    }
    return list;
  },

  async getAllSubmissions(examId: string): Promise<Submission[]> {
    let capacity = 100;
    if (examId === 'exam-speech-lang' || examId === 'exam-algebra' || examId === 'exam-english1') {
      capacity = 400;
    } else if (examId === 'exam-physics' || examId === 'exam-earth') {
      capacity = 200;
    } else if (examId === 'exam-chemistry') {
      capacity = 150;
    }

    const dummyList = this.generateDummySubmissions(examId, capacity);

    let realSubs: Submission[] = [];
    if (!isPlaceholder && db) {
      try {
        const snapshot = await getDocs(collection(db, 'exams', examId, 'submissions'));
        if (!snapshot.empty) {
          realSubs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
        }
      } catch (error) {
        console.warn('Firestore fetch failed, falling back to mock data', error);
        realSubs = await this.getRealSubmissions();
        realSubs = realSubs.filter(s => s.examId === examId);
      }
    } else {
      realSubs = await this.getRealSubmissions();
      realSubs = realSubs.filter(s => s.examId === examId);
    }

    const realCount = realSubs.length;
    if (realCount > 0) {
      // 덤이 데이터에서 진짜 제출 수만큼 제외하고 병합하여 전체 capacity가 그대로 유지되도록 합니다.
      const chosenDummyList = dummyList.slice(0, Math.max(0, capacity - realCount));
      return [...chosenDummyList, ...realSubs];
    }

    return dummyList;
  },

  async getAllSubmissionsRaw(): Promise<Submission[]> {
    const all: Submission[] = [];
    const exams = INITIAL_EXAMS;
    for (const exam of exams) {
      const subs = await this.getAllSubmissions(exam.id);
      all.push(...subs);
    }
    return all;
  },

  async getAllSubmissionsAcrossExams(): Promise<Submission[]> {
    return this.getAllSubmissionsRaw();
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
