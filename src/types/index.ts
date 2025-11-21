export interface Student {
  id: string;
  name: string;
  usn: string;
  email: string;
  branch: string;
  year: string;
  semester: string;
}

export interface Question {
  id: string;
  type: 'mcq' | 'short-answer' | 'mixed';
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
  isBookmarked?: boolean;
  isSelected?: boolean;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  createdAt: string;
  numQuestions: number;
  questionType: string;
  duration?: number; // in minutes
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
}

export interface QuizShare {
  quizId: string;
  studentEmails: string[];
  links: Array<{
    email: string;
    link: string;
    token: string;
  }>;
}
