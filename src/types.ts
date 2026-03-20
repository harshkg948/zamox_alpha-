export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  currentRole?: string;
  skills: string[];
  interests: string[];
  goals: string[];
  growthStage: 'Seed' | 'Growth' | 'Bloom';
  streak: number;
  lastActive?: string;
  careerAnalysis?: CareerAnalysis;
  preferredSources?: string[];
  focusScore: number;
  progressPercentage: number;
}

export interface DailyQuizResponse {
  id: string;
  uid: string;
  date: string;
  studyHours: number;
  topic: string;
  difficulty: number; // 1-10
  focus: number; // 1-10
  timestamp: string;
}

export interface DailyTask {
  id: string;
  uid: string;
  date: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  type: 'ai-generated' | 'roadmap-sync';
}

export interface KnowledgeQuiz {
  id: string;
  uid: string;
  date: string;
  topic: string;
  difficulty: string;
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface KnowledgeQuizAttempt {
  id: string;
  uid: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  answers: number[];
  timestamp: string;
}

export interface CareerAnalysis {
  strengths: string[];
  weaknesses: string[];
  careerFitScore: number;
  suggestions: CareerSuggestion[];
}

export interface CareerSuggestion {
  title: string;
  matchScore: number;
  description: string;
  strengths: string[];
}

export interface Roadmap {
  id: string;
  uid: string;
  title: string;
  description: string;
  months: RoadmapMonth[];
  createdAt: string;
}

export interface RoadmapMonth {
  month: number;
  focus: string;
  goals: string[];
  weeks: RoadmapWeek[];
}

export interface RoadmapWeek {
  week: number;
  tasks: string[];
}

export interface Task {
  id: string;
  uid: string;
  roadmapId: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  dueDate: string;
  monthIndex: number;
  weekIndex: number;
}

export interface ChatMessage {
  id: string;
  uid: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface WellnessLog {
  id: string;
  uid: string;
  date: string;
  studyTime: number;
  focus: number;
  rest: number;
  breaks: number;
  summary?: string;
}

export interface WellnessInsight {
  title: string;
  desc: string;
  type: 'positive' | 'neutral' | 'negative';
}

export interface CareerInsight {
  title: string;
  summary: string;
  importance: 'high' | 'medium' | 'low';
  trend: string;
  skills: string[];
  warnings: string[];
  nextSteps: string;
  sources: { title: string; url: string }[];
}

export interface AppState {
  user: UserProfile | null;
  roadmap: Roadmap | null;
  tasks: Task[];
  chatHistory: ChatMessage[];
  wellnessLogs: WellnessLog[];
  newsInsights: CareerInsight[];
  loading: boolean;
}
