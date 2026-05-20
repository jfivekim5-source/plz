export interface Exam {
  id: string;
  title: string;
  grade: string;
  subject: string;
  examDate?: string;
  isOpen: boolean;
  questionCount: number;
}

export interface Question {
  id: string;
  examId: string;
  number: number;
  answer: string;
  score: number;
  type: 'multiple' | 'subjective';
}

export interface Submission {
  id?: string;
  userId: string;
  examId: string;
  totalScore: number;
  submittedAt: string;
  isDummy?: boolean;
  answers: {
    number: number;
    userAnswer: string;
    isCorrect: boolean;
    score: number;
  }[];
}
