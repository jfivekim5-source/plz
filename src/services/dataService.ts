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
    id: 'exam-physics',
    title: '물리학',
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
  async addReview(review: { examId: string, userId: string, content: string }) {
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
      if (!saved) {
        localStorage.setItem(EXAMS_KEY, JSON.stringify(INITIAL_EXAMS));
        return INITIAL_EXAMS;
      }
      return JSON.parse(saved);
    }

    try {
      const snapshot = await getDocs(collection(db!, 'exams'));
      if (snapshot.empty) {
        for (const exam of INITIAL_EXAMS) {
          await setDoc(doc(db!, 'exams', exam.id), exam);
        }
        return INITIAL_EXAMS;
      }
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
    } catch (error) {
      return INITIAL_EXAMS;
    }
  },

  async getExam(examId: string): Promise<Exam | null> {
    const exams = await this.getExams();
    return exams.find(e => e.id === examId) || null;
  },

  async getQuestions(examId: string): Promise<Question[]> {
    if (isPlaceholder) return [];
    if (!db) return [];
    try {
      const snapshot = await getDocs(collection(db, 'exams', examId, 'questions'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
    } catch (error) {
      console.error('getQuestions failed', error);
      return [];
    }
  }
};

export const SubmissionService = {
  async submit(submission: Submission) {
    if (isPlaceholder) {
      const subs = await this.getAllSubmissionsRaw();
      const filtered = subs.filter(s => !(s.userId === submission.userId && s.examId === submission.examId));
      const newSub = { ...submission, id: submission.id || `SUB-${Date.now()}-${submission.userId}`, submittedAt: new Date().toISOString() };
      filtered.push(newSub);
      localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(filtered));
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
      const subs = await this.getAllSubmissionsRaw();
      return subs.find(s => s.examId === examId && s.userId === userId) || null;
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

  async getAllSubmissionsRaw(): Promise<Submission[]> {
    const saved = localStorage.getItem(SUBMISSIONS_KEY);
    if (!saved) {
      // Generate Mock Data for 120 students (Classes 4, 5, 6, 7)
      const mockSubmissions: Submission[] = [];
      const classes = [4, 5, 6, 7];
      const studentsPerClass = 30;
      const exams = INITIAL_EXAMS;

      classes.forEach(classNum => {
        for (let i = 1; i <= studentsPerClass; i++) {
          const studentNum = i.toString().padStart(2, '0');
          const studentId = `20${classNum}${studentNum}`;
          
          exams.forEach(exam => {
            const mockAnswers = Array.from({ length: exam.questionCount }, (_, idx) => {
              const qNum = idx + 1;
              const isChoice = exam.id === 'exam-speech-lang' ? true : 
                               exam.id === 'exam-algebra' ? qNum <= 16 :
                               exam.id === 'exam-physics' ? qNum <= 15 : true;
              
              const userAnswer = isChoice ? (Math.floor(Math.random() * 5) + 1).toString() : (Math.floor(Math.random() * 999) + 1).toString();
              return { number: qNum, userAnswer };
            });

            const ability = Math.random();
            let totalScore = 0;
            const detailedAnswers = mockAnswers.map((a, idx) => {
              const qNum = idx + 1;
              const isChoice = exam.id === 'exam-speech-lang' ? qNum <= 20 : 
                               exam.id === 'exam-algebra' ? qNum <= 16 :
                               exam.id === 'exam-physics' ? qNum <= 15 : true;
              
              const weight = exam.id === 'exam-speech-lang' ? (isChoice ? 3 : 5) :
                             exam.id === 'exam-algebra' ? (isChoice ? 4 : 6) :
                             exam.id === 'exam-physics' ? (isChoice ? 4 : 8) : 4;
              
              const isCorrect = Math.random() < ability;
              const score = isCorrect ? weight : 0;
              totalScore += score;
              
              return { ...a, isCorrect, score };
            });

            mockSubmissions.push({
              id: `SUB-${studentId}-${exam.id}`,
              userId: studentId,
              examId: exam.id,
              answers: detailedAnswers,
              totalScore,
              submittedAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
            });
          });
        }
      });

      localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(mockSubmissions));
      return mockSubmissions;
    }
    return JSON.parse(saved);
  },

  async getAllSubmissions(examId: string): Promise<Submission[]> {
    if (!isPlaceholder && db) {
      try {
        const snapshot = await getDocs(collection(db, 'exams', examId, 'submissions'));
        if (!snapshot.empty) {
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
        }
      } catch (error) {
        console.warn('Firestore fetch failed, falling back to mock data', error);
      }
    }

    // Fallback to local mock data
    const subs = await this.getAllSubmissionsRaw();
    return subs.filter(s => s.examId === examId);
  },

  async getAllSubmissionsAcrossExams(): Promise<Submission[]> {
     if (isPlaceholder) return this.getAllSubmissionsRaw();
     // In Firestore, we would need a collectionGroup or fetch each.
     // For demo simplicity, we'll just fetch from INITIAL_EXAMS.
     try {
       const all: Submission[] = [];
       const exams = await ExamService.getExams();
       for (const exam of exams) {
         const subs = await this.getAllSubmissions(exam.id);
         all.push(...subs);
       }
       return all;
     } catch (error) {
       return [];
     }
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
