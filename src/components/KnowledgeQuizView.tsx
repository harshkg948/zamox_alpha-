import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, CheckCircle2, XCircle, ArrowRight, RefreshCw, Trophy, Target, Flame, Sparkles, Activity } from 'lucide-react';
import { KnowledgeQuiz, KnowledgeQuizAttempt, UserProfile, Task, DailyTask } from '../types';
import { generateKnowledgeQuiz } from '../services/gemini';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface KnowledgeQuizViewProps {
  profile: UserProfile;
  roadmapTasks: Task[];
  dailyTasks: DailyTask[];
}

export function KnowledgeQuizView({ profile, roadmapTasks, dailyTasks }: KnowledgeQuizViewProps) {
  const [quiz, setQuiz] = useState<KnowledgeQuiz | null>(null);
  const [attempt, setAttempt] = useState<KnowledgeQuizAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchTodayQuiz();
  }, [profile.uid]);

  const fetchTodayQuiz = async () => {
    setLoading(true);
    try {
      // Check for existing quiz
      const quizQuery = query(
        collection(db, 'knowledgeQuizzes'),
        where('uid', '==', profile.uid),
        where('date', '==', today)
      );
      const quizSnap = await getDocs(quizQuery);

      if (!quizSnap.empty) {
        const quizData = { id: quizSnap.docs[0].id, ...quizSnap.docs[0].data() } as KnowledgeQuiz;
        setQuiz(quizData);

        // Check for existing attempt
        const attemptQuery = query(
          collection(db, 'knowledgeQuizAttempts'),
          where('uid', '==', profile.uid),
          where('quizId', '==', quizData.id)
        );
        const attemptSnap = await getDocs(attemptQuery);
        if (!attemptSnap.empty) {
          setAttempt({ id: attemptSnap.docs[0].id, ...attemptSnap.docs[0].data() } as KnowledgeQuizAttempt);
          setShowResults(true);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'knowledgeQuizzes');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setIsGenerating(true);
    try {
      const roadmapTaskTitles = roadmapTasks.slice(0, 5).map(t => t.title);
      const dailyTaskTitles = dailyTasks.map(t => t.title);
      
      const quizData = await generateKnowledgeQuiz(
        profile.currentRole || "AI ML Engineer",
        roadmapTaskTitles,
        dailyTaskTitles,
        profile.focusScore || 50
      );

      const newQuiz: Omit<KnowledgeQuiz, 'id'> = {
        ...quizData,
        uid: profile.uid,
        date: today
      };

      const docRef = await addDoc(collection(db, 'knowledgeQuizzes'), newQuiz);
      setQuiz({ id: docRef.id, ...newQuiz } as KnowledgeQuiz);
      setCurrentQuestion(0);
      setSelectedAnswers([]);
      setShowResults(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'knowledgeQuizzes');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswerSelect = (optionIndex: number) => {
    if (showResults) return;
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestion] = optionIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < (quiz?.questions.length || 0) - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      submitQuiz();
    }
  };

  const submitQuiz = async () => {
    if (!quiz) return;
    
    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (selectedAnswers[i] === q.correctAnswer) score++;
    });

    const newAttempt: Omit<KnowledgeQuizAttempt, 'id'> = {
      uid: profile.uid,
      quizId: quiz.id,
      score,
      totalQuestions: quiz.questions.length,
      answers: selectedAnswers,
      timestamp: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, 'knowledgeQuizAttempts'), newAttempt);
      setAttempt({ id: docRef.id, ...newAttempt } as KnowledgeQuizAttempt);
      setShowResults(true);

      // Update streak if not already done today
      const today = new Date().toISOString().split('T')[0];
      if (profile.lastActive !== today) {
        const newStreak = (profile.streak || 0) + 1;
        await setDoc(doc(db, 'users', profile.uid), {
          streak: newStreak,
          lastActive: today
        }, { merge: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'knowledgeQuizAttempts');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  if (!quiz) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-12 text-center border-dashed border-theme"
      >
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Brain className="text-emerald-500" size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-4">Daily Knowledge Challenge</h2>
        <p className="text-muted mb-8 max-w-md mx-auto">
          Test your progress on your roadmap and daily tasks. 
          Level adjusted to your current focus score: <span className="text-emerald-400 font-bold">{profile.focusScore}%</span>
        </p>
        <button 
          onClick={handleGenerateQuiz}
          disabled={isGenerating}
          className="btn-primary px-8 py-3 flex items-center gap-2 mx-auto"
        >
          {isGenerating ? <RefreshCw className="animate-spin" size={20} /> : <Sparkles size={20} />}
          {isGenerating ? "Generating Quiz..." : "Start Today's Quiz"}
        </button>
      </motion.div>
    );
  }

  const currentQ = quiz.questions[currentQuestion];
  const isAnswered = selectedAnswers[currentQuestion] !== undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Quiz Header */}
      <div className="card p-6 flex items-center justify-between border-theme">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
            <Target size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">{quiz.topic}</h2>
            <p className="text-xs text-muted uppercase tracking-widest font-bold">Difficulty: {quiz.difficulty}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Focus</p>
            <div className="flex items-center gap-1 text-blue-400 font-bold">
              <Activity size={14} />
              <span>{profile.focusScore}%</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Streak</p>
            <div className="flex items-center gap-1 text-orange-500 font-bold">
              <Flame size={14} />
              <span>{profile.streak}</span>
            </div>
          </div>
        </div>
      </div>

      {!showResults ? (
        <motion.div 
          key={currentQuestion}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="card p-8 space-y-8"
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-muted uppercase tracking-widest">Question {currentQuestion + 1} of {quiz.questions.length}</span>
            <div className="h-1.5 w-32 bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300" 
                style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
              />
            </div>
          </div>

          <h3 className="text-2xl font-bold leading-tight">{currentQ.question}</h3>

          <div className="grid grid-cols-1 gap-3">
            {currentQ.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswerSelect(idx)}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between group",
                  selectedAnswers[currentQuestion] === idx 
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                    : "bg-white/5 border-theme hover:border-emerald-500/50"
                )}
              >
                <span className="font-medium">{option}</span>
                <div className={cn(
                  "w-6 h-6 rounded-full border flex items-center justify-center transition-all",
                  selectedAnswers[currentQuestion] === idx 
                    ? "bg-emerald-500 border-emerald-500 text-white" 
                    : "border-theme group-hover:border-emerald-500/50"
                )}>
                  {selectedAnswers[currentQuestion] === idx && <CheckCircle2 size={14} />}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleNext}
              disabled={!isAnswered}
              className="btn-primary px-8 py-3 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentQuestion === quiz.questions.length - 1 ? "Finish Quiz" : "Next Question"}
              <ArrowRight size={20} />
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <div className="card p-12 text-center bg-emerald-500/10 border-emerald-500/20">
            <Trophy className="mx-auto text-amber-500 mb-6 animate-bounce" size={64} />
            <h2 className="text-4xl font-bold mb-2">Quiz Complete!</h2>
            <p className="text-muted mb-8">You scored {attempt?.score} out of {attempt?.totalQuestions}</p>
            
            <div className="flex justify-center gap-4">
              <div className="p-4 bg-bg-muted-theme rounded-2xl border border-theme min-w-[120px]">
                <p className="text-3xl font-bold text-emerald-400">{Math.round((attempt?.score || 0) / (attempt?.totalQuestions || 1) * 100)}%</p>
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Accuracy</p>
              </div>
              <div className="p-4 bg-bg-muted-theme rounded-2xl border border-theme min-w-[120px]">
                <p className="text-3xl font-bold text-blue-400">+{attempt?.score || 0 * 10}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold">XP Earned</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold px-2">Review Answers</h3>
            {quiz.questions.map((q, i) => (
              <div key={i} className="card p-6 border-theme">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {attempt?.answers[i] === q.correctAnswer ? (
                      <CheckCircle2 className="text-emerald-500" size={24} />
                    ) : (
                      <XCircle className="text-red-500" size={24} />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="font-bold text-lg">{q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, idx) => (
                        <div 
                          key={idx}
                          className={cn(
                            "p-3 rounded-xl text-sm border",
                            idx === q.correctAnswer ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : 
                            idx === attempt?.answers[i] ? "bg-red-500/10 border-red-500/30 text-red-400" :
                            "bg-bg-muted-theme border-transparent text-muted"
                          )}
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Explanation</p>
                      <p className="text-sm text-muted leading-relaxed">{q.explanation}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
