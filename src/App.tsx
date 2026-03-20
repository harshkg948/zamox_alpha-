import { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Compass, 
  Map, 
  MessageSquare, 
  User, 
  Settings,
  Leaf,
  Brain,
  ChevronRight,
  CheckCircle2,
  Trophy,
  Flame,
  Plus,
  Newspaper,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  RefreshCw,
  ExternalLink,
  LogOut,
  Activity,
  Menu,
  Trash2,
  Save,
  Sparkles,
  Send,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, UserProfile, CareerAnalysis, Roadmap, Task, ChatMessage, CareerInsight, WellnessLog, DailyQuizResponse, DailyTask } from './types';
import Markdown from 'react-markdown';
import { analyzeCareer, generateRoadmap, fetchCareerNews, chatWithMentor, generateDailyTasks, generateIntegratedInsights } from './services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth, db, logout, handleFirestoreError, OperationType } from './firebase';
import { doc, onSnapshot, setDoc, updateDoc, collection, query, where, orderBy, limit, addDoc, serverTimestamp, deleteDoc, deleteField, writeBatch, getDocs } from 'firebase/firestore';
import { AuthGuard } from './components/AuthGuard';
import { WellnessView } from './components/WellnessView';
import { KnowledgeQuizView } from './components/KnowledgeQuizView';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Ensure URL is absolute
const ensureAbsoluteUrl = (url: string) => {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `https://${url}`;
};

// Views
type View = 'dashboard' | 'analysis' | 'roadmap' | 'mentor' | 'news' | 'wellness' | 'profile' | 'settings' | 'check-in' | 'knowledge-quiz' | 'not-found';

export default function App() {
  return (
    <AuthGuard>
      {(user) => <MainApp user={user} />}
    </AuthGuard>
  );
}

function MainApp({ user }: { user: any }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [newsInsights, setNewsInsights] = useState<CareerInsight[]>([]);
  const [dailyQuizzes, setDailyQuizzes] = useState<DailyQuizResponse[]>([]);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [integratedInsights, setIntegratedInsights] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'dark' | 'light') || 'dark';
  });
  const hasCareerAnalysis = Boolean(profile?.careerAnalysis);
  const unlockedViews: View[] = ['dashboard', 'analysis', 'profile', 'settings'];

  // Apply theme
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Sync Profile
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        // Initialize profile
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || 'Student',
          email: user.email || '',
          photoURL: user.photoURL || '',
          skills: [],
          interests: [],
          goals: [],
          growthStage: 'Seed',
          streak: 0,
          focusScore: 0,
          progressPercentage: 0
        };
        setDoc(doc(db, 'users', user.uid), newProfile);
      }
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));
    return unsub;
  }, [user.uid]);

  // Sync Roadmap
  useEffect(() => {
    const q = query(collection(db, 'roadmaps'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setRoadmap({ id: snap.docs[0].id, ...snap.docs[0].data() } as Roadmap);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'roadmaps'));
    return unsub;
  }, [user.uid]);

  // Sync Tasks
  useEffect(() => {
    const q = query(collection(db, 'tasks'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));
    return unsub;
  }, [user.uid]);

  // Sync Chat
  useEffect(() => {
    const q = query(collection(db, 'chats'), where('uid', '==', user.uid), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setChatHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'chats'));
    return unsub;
  }, [user.uid]);

  // Sync Daily Quizzes
  useEffect(() => {
    const q = query(collection(db, 'dailyQuizzes'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'), limit(10));
    const unsub = onSnapshot(q, (snap) => {
      setDailyQuizzes(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyQuizResponse)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'dailyQuizzes'));
    return unsub;
  }, [user.uid]);

  // Sync Daily Tasks
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'dailyTasks'), where('uid', '==', user.uid), where('date', '==', today));
    const unsub = onSnapshot(q, (snap) => {
      setDailyTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyTask)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'dailyTasks'));
    return unsub;
  }, [user.uid]);

  // Generate Integrated Insights
  useEffect(() => {
    if (profile && dailyQuizzes.length > 0) {
      generateIntegratedInsights(profile, dailyQuizzes, tasks)
        .then(setIntegratedInsights)
        .catch(console.error);
    }
  }, [profile, dailyQuizzes, tasks]);

  // Simple hash-based router
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as View;
      const validViews: View[] = ['dashboard', 'analysis', 'roadmap', 'mentor', 'news', 'wellness', 'profile', 'settings', 'check-in', 'knowledge-quiz'];
      if (!hash) { window.location.hash = 'dashboard'; return; }
      if (validViews.includes(hash)) setCurrentView(hash);
      else setCurrentView('not-found');
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (view: View) => {
    const nextView = !hasCareerAnalysis && !unlockedViews.includes(view) ? 'dashboard' : view;
    window.location.hash = nextView;
  };
  
  // Redirect if analysis is already done
  useEffect(() => {
    if (currentView === 'analysis' && profile?.careerAnalysis) {
      navigateTo('dashboard');
    }
  }, [currentView, profile?.careerAnalysis]);

  useEffect(() => {
    if (!loading && !hasCareerAnalysis && !unlockedViews.includes(currentView)) {
      navigateTo('dashboard');
    }
  }, [currentView, hasCareerAnalysis, loading]);

  const handleAnalysisComplete = async (answers: Record<string, string>, analysis: CareerAnalysis) => {
    if (!profile) return;
    const updatedProfile: UserProfile = {
      ...profile,
      currentRole: answers.role,
      skills: answers.skills.split(',').map(s => s.trim()),
      interests: answers.interests.split(',').map(s => s.trim()),
      goals: [answers.goals],
      careerAnalysis: analysis,
      growthStage: 'Seed'
    };
    await updateDoc(doc(db, 'users', user.uid), updatedProfile as any);
    navigateTo('dashboard');
  };

  const handleGenerateRoadmap = async (_careerTitle?: string) => {
    if (!profile?.careerAnalysis) {
      navigateTo('dashboard');
      return;
    }
    const selectedCareerTitle = _careerTitle || profile.careerAnalysis.suggestions?.[0]?.title || profile.goals?.[0];
    if (!selectedCareerTitle) return;
    const newRoadmap = await generateRoadmap(selectedCareerTitle, profile.skills);
    const docRef = await addDoc(collection(db, 'roadmaps'), { ...newRoadmap, uid: user.uid });
    
    // Generate initial tasks for Month 1
    const month1 = newRoadmap.months[0];
    for (const week of month1.weeks) {
      for (const taskTitle of week.tasks) {
        await addDoc(collection(db, 'tasks'), {
          uid: user.uid,
          roadmapId: docRef.id,
          title: taskTitle,
          status: 'pending',
          monthIndex: 0,
          weekIndex: week.week - 1,
          dueDate: new Date().toISOString().split('T')[0]
        });
      }
    }
    navigateTo('roadmap');
  };

  const toggleTask = async (taskId: string, currentStatus: string) => {
    await updateDoc(doc(db, 'tasks', taskId), {
      status: currentStatus === 'pending' ? 'completed' : 'pending'
    });
    
    // Update streak if all tasks completed today
    const today = new Date().toISOString().split('T')[0];
    const todaysTasks = tasks.filter(t => t.dueDate === today);
    if (todaysTasks.length > 0 && todaysTasks.every(t => t.status === 'completed' || t.id === taskId)) {
      if (profile && profile.lastActive !== today) {
        await updateDoc(doc(db, 'users', user.uid), {
          streak: (profile.streak || 0) + 1,
          lastActive: today
        });
      }
    }
  };

  const handleFetchNews = async () => {
    setIsNewsLoading(true);
    try {
      const goals = profile?.goals?.length ? profile.goals : ["Technology", "Career Growth"];
      const insights = await fetchCareerNews(goals, profile?.preferredSources);
      setNewsInsights(insights);
    } catch (err) {
      console.error(err);
    } finally {
      setIsNewsLoading(false);
    }
  };

  const handleQuizComplete = async (quizData: Partial<DailyQuizResponse>) => {
    if (!profile) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const quizRef = await addDoc(collection(db, 'dailyQuizzes'), {
        uid: user.uid,
        date: today,
        ...quizData,
        timestamp: new Date().toISOString()
      });

      // Calculate new focus score
      // Focus Score = (Avg Focus * 0.4) + (Avg Difficulty * 0.3) + (Consistency * 0.3)
      const recentQuizzes = [quizData as DailyQuizResponse, ...dailyQuizzes].slice(0, 7);
      const avgFocus = recentQuizzes.reduce((acc, q) => acc + q.focus, 0) / recentQuizzes.length;
      const avgDiff = recentQuizzes.reduce((acc, q) => acc + q.difficulty, 0) / recentQuizzes.length;
      const consistency = (recentQuizzes.length / 7) * 10;
      const newFocusScore = Math.round((avgFocus * 4) + (avgDiff * 3) + (consistency * 3));

      // Calculate progress
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

      await updateDoc(doc(db, 'users', user.uid), {
        focusScore: newFocusScore,
        progressPercentage: progress
      });

      // Generate Daily Tasks
      const aiTasks = await generateDailyTasks(quizData, profile.goals[0], roadmap?.title || 'Initial Stage');
      const taskPromises = aiTasks.map(t => addDoc(collection(db, 'dailyTasks'), {
        uid: user.uid,
        date: today,
        ...t,
        status: 'pending'
      }));
      await Promise.all(taskPromises);

      setCurrentView('dashboard');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'dailyQuizzes');
    }
  };

  const handleToggleDailyTask = async (taskId: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, 'dailyTasks', taskId), {
        status: currentStatus === 'completed' ? 'pending' : 'completed'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'dailyTasks');
    }
  };

  const handleResetCareer = async () => {
    if (!profile) return;
    try {
      // 1. Delete all tasks
      const tasksQuery = query(collection(db, 'tasks'), where('uid', '==', user.uid));
      const tasksSnap = await getDocs(tasksQuery);
      const taskDeletions = tasksSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(taskDeletions);

      // 2. Delete all roadmaps
      const roadmapsQuery = query(collection(db, 'roadmaps'), where('uid', '==', user.uid));
      const roadmapsSnap = await getDocs(roadmapsQuery);
      const roadmapDeletions = roadmapsSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(roadmapDeletions);

      // 3. Delete all chats
      const chatsQuery = query(collection(db, 'chats'), where('uid', '==', user.uid));
      const chatsSnap = await getDocs(chatsQuery);
      const chatDeletions = chatsSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(chatDeletions);

      // 4. Delete all wellness logs
      const wellnessQuery = query(collection(db, 'wellness'), where('uid', '==', user.uid));
      const wellnessSnap = await getDocs(wellnessQuery);
      const wellnessDeletions = wellnessSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(wellnessDeletions);

      // Delete daily tasks
      const dailyTasksQuery = query(collection(db, 'dailyTasks'), where('uid', '==', user.uid));
      const dailyTasksSnap = await getDocs(dailyTasksQuery);
      const dailyTaskDeletions = dailyTasksSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(dailyTaskDeletions);

      // Delete daily quizzes
      const quizzesQuery = query(collection(db, 'dailyQuizzes'), where('uid', '==', user.uid));
      const quizzesSnap = await getDocs(quizzesQuery);
      const quizDeletions = quizzesSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(quizDeletions);

      // Delete knowledge quizzes and their attempts
      const kQuizzesQuery = query(collection(db, 'knowledgeQuizzes'), where('uid', '==', user.uid));
      const kQuizzesSnap = await getDocs(kQuizzesQuery);
      const kQuizDeletions = kQuizzesSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(kQuizDeletions);

      const kAttemptsQuery = query(collection(db, 'knowledgeQuizAttempts'), where('uid', '==', user.uid));
      const kAttemptsSnap = await getDocs(kAttemptsQuery);
      const kAttemptDeletions = kAttemptsSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(kAttemptDeletions);

      // 5. Update profile (Reset everything except login info)
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        currentRole: deleteField(),
        skills: [],
        interests: [],
        goals: [],
        growthStage: 'Seed',
        streak: 0,
        focusScore: 0,
        progressPercentage: 0,
        lastActive: deleteField(),
        careerAnalysis: deleteField(),
        preferredSources: deleteField()
      });
      
      // Clear local states that might not update immediately from snapshots
      setRoadmap(null);
      setTasks([]);
      setChatHistory([]);
      setNewsInsights([]);
      setDailyTasks([]);
      setDailyQuizzes([]);
      setIntegratedInsights([]);
      
      navigateTo('analysis');
    } catch (err) {
      console.error('Reset Career Error:', err);
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleUpdateProfile = async (data: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), data);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return null;

  return (
    <div className="flex h-screen bg-bg-theme text-[var(--color-text)] overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "bg-card-theme border-r border-[var(--color-border)] transition-all duration-300 flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className={cn("p-6 flex", isSidebarOpen ? "items-center justify-between" : "flex-col items-center gap-4")}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
              <Leaf className="text-white w-5 h-5" />
            </div>
            {isSidebarOpen && <span className="font-bold text-xl tracking-tight gradient-text text-nowrap">ZAMOX</span>}
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-1.5 hover:bg-[var(--color-glass-bg)] rounded-full transition-colors text-[var(--color-text-muted)] hover:text-emerald-400"
          >
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => navigateTo('dashboard')} collapsed={!isSidebarOpen} />
          {!hasCareerAnalysis && (
            <NavItem icon={<Compass size={20} />} label="Career Analysis" active={currentView === 'analysis'} onClick={() => navigateTo('analysis')} collapsed={!isSidebarOpen} />
          )}
          {hasCareerAnalysis && (
            <>
              <NavItem icon={<Map size={20} />} label="Growth Roadmap" active={currentView === 'roadmap'} onClick={() => navigateTo('roadmap')} collapsed={!isSidebarOpen} />
              <NavItem icon={<Newspaper size={20} />} label="News Intelligence" active={currentView === 'news'} onClick={() => navigateTo('news')} collapsed={!isSidebarOpen} />
              <NavItem icon={<Activity size={20} />} label="Wellness" active={currentView === 'wellness'} onClick={() => navigateTo('wellness')} collapsed={!isSidebarOpen} />
              <NavItem icon={<RefreshCw size={20} />} label="Daily Check-in" active={currentView === 'check-in'} onClick={() => navigateTo('check-in')} collapsed={!isSidebarOpen} />
              <NavItem icon={<Brain size={20} />} label="Daily Quiz" active={currentView === 'knowledge-quiz'} onClick={() => navigateTo('knowledge-quiz')} collapsed={!isSidebarOpen} />
              <NavItem icon={<MessageSquare size={20} />} label="AI Mentor" active={currentView === 'mentor'} onClick={() => navigateTo('mentor')} collapsed={!isSidebarOpen} />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[var(--color-border)] space-y-2">
          <NavItem icon={<User size={20} />} label="Profile" active={currentView === 'profile'} onClick={() => navigateTo('profile')} collapsed={!isSidebarOpen} />
          <NavItem icon={<LogOut size={20} />} label="Logout" onClick={() => logout()} collapsed={!isSidebarOpen} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-10 glass px-8 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold capitalize">{currentView.replace('-', ' ')}</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
              <Flame size={16} />
              <span className="text-sm font-bold">{profile?.streak || 0} Day Streak</span>
            </div>
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full transition-colors hover:bg-[var(--color-glass-bg)] text-[var(--color-text-muted)] hover:text-emerald-400"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              onClick={() => navigateTo('settings')}
              className={cn(
                "p-2 rounded-full transition-colors",
                currentView === 'settings' ? "bg-emerald-500/20 text-emerald-400" : "hover:bg-[var(--color-glass-bg)] text-[var(--color-text-muted)]"
              )}
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {currentView === 'dashboard' && (
              <DashboardView 
                profile={profile} 
                tasks={tasks} 
                dailyTasks={dailyTasks}
                integratedInsights={integratedInsights}
                onToggleTask={toggleTask} 
                onToggleDailyTask={handleToggleDailyTask}
                onStartAnalysis={() => navigateTo('analysis')}
                onStartQuiz={() => navigateTo('check-in')}
              />
            )}
            {currentView === 'check-in' && (
              <DailyCheckInView onComplete={handleQuizComplete} />
            )}
            {currentView === 'knowledge-quiz' && profile && (
              <KnowledgeQuizView 
                profile={profile}
                roadmapTasks={tasks}
                dailyTasks={dailyTasks}
              />
            )}
            {currentView === 'analysis' && (
              <AnalysisView onComplete={handleAnalysisComplete} />
            )}
            {currentView === 'roadmap' && (
              <RoadmapView 
                roadmap={roadmap} 
                profile={profile}
                onGenerate={handleGenerateRoadmap}
              />
            )}
            {currentView === 'news' && (
              <NewsView 
                news={newsInsights} 
                isLoading={isNewsLoading}
                onRefresh={handleFetchNews}
                profile={profile}
              />
            )}
            {currentView === 'wellness' && (
              <WellnessView uid={user.uid} />
            )}
            {currentView === 'mentor' && (
              <MentorChat 
                uid={user.uid}
                history={chatHistory} 
                profile={profile}
                roadmap={roadmap}
              />
            )}
            {currentView === 'profile' && (
              <ProfileView profile={profile} />
            )}
            {currentView === 'settings' && (
              <SettingsView 
                profile={profile} 
                onResetCareer={handleResetCareer}
                onUpdateProfile={handleUpdateProfile}
              />
            )}
            {currentView === 'not-found' && (
              <NotFoundView onBackHome={() => navigateTo('dashboard')} />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center rounded-full transition-all duration-200 group",
        collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-2.5",
        active 
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
          : "text-muted hover:text-text-theme hover:bg-glass"
      )}
    >
      <span className={cn(active ? "text-emerald-400" : "group-hover:text-emerald-400")}>{icon}</span>
      {!collapsed && <span className="font-medium text-nowrap">{label}</span>}
    </button>
  );
}

// --- Dashboard View ---
function DashboardView({ profile, tasks, dailyTasks, integratedInsights, onToggleTask, onToggleDailyTask, onStartAnalysis, onStartQuiz }: any) {
  if (!profile?.careerAnalysis) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
          <Compass className="text-emerald-500 w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Welcome to ZAMOX</h1>
        <p className="text-muted max-w-md mb-8">Start by analyzing your career path to unlock personalized roadmaps and daily tasks.</p>
        <button onClick={onStartAnalysis} className="btn-glass flex items-center gap-2">
          Start Career Analysis <ChevronRight size={18} />
        </button>
      </motion.div>
    );
  }

  const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
  const roadmapProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  
  const growthStage = roadmapProgress < 33 ? 'Seed' : roadmapProgress < 66 ? 'Growth' : 'Bloom';
  const stageIcon = growthStage === 'Seed' ? <div className="w-12 h-12 bg-amber-900/20 rounded-full flex items-center justify-center border border-amber-900/30"><div className="w-4 h-4 bg-amber-700 rounded-full" /></div> :
                   growthStage === 'Growth' ? <div className="w-12 h-12 bg-emerald-900/20 rounded-full flex items-center justify-center border border-emerald-900/30"><Leaf className="text-emerald-600" size={24} /></div> :
                   <div className="w-12 h-12 bg-pink-900/20 rounded-full flex items-center justify-center border border-pink-900/30"><Trophy className="text-pink-500" size={24} /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Growth Dashboard</h1>
          <p className="text-muted text-sm">Welcome back, {profile.displayName}</p>
        </div>
        <button onClick={onStartQuiz} className="btn-glass flex items-center gap-2 py-2 px-4 text-sm">
          <RefreshCw size={16} /> Daily Check-in
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card p-4">
          <p className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Focus Score</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-400">{profile.focusScore || 0}</span>
            <span className="text-[10px] text-muted">/100</span>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Roadmap Progress</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{roadmapProgress}%</span>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Growth Stage</p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-amber-500">{growthStage}</span>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Current Goal</p>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold truncate">{profile.goals?.[0] || 'None'}</span>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Streak</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-orange-500">{profile.streak || 0}</span>
            <span className="text-[10px] text-muted">/100</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-emerald-500" /> AI Daily Tasks
            </h3>
            <div className="space-y-3">
              {dailyTasks.length > 0 ? dailyTasks.map((task: DailyTask) => (
                <div key={task.id} onClick={() => onToggleDailyTask(task.id, task.status)} className={cn("card p-4 flex items-center gap-4 cursor-pointer group", task.status === 'completed' ? "opacity-60" : "")}>
                  <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all", task.status === 'completed' ? "bg-emerald-500 border-emerald-500" : "border-theme group-hover:border-emerald-500")}>
                    {task.status === 'completed' && <CheckCircle2 size={14} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className={cn("font-medium", task.status === 'completed' ? "line-through" : "")}>{task.title}</p>
                    <p className="text-xs text-muted">{task.description}</p>
                  </div>
                </div>
              )) : (
                <div className="card p-8 text-center border-dashed border-theme">
                  <p className="text-muted italic">Complete your daily check-in to generate AI tasks.</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold mb-4">Roadmap Tasks</h3>
            <div className="space-y-3">
              {tasks.length > 0 ? tasks.filter(t => t.dueDate === new Date().toISOString().split('T')[0]).map((task: Task) => (
                <div key={task.id} onClick={() => onToggleTask(task.id, task.status)} className={cn("card p-4 flex items-center gap-4 cursor-pointer group", task.status === 'completed' ? "opacity-60" : "")}>
                  <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all", task.status === 'completed' ? "bg-emerald-500 border-emerald-500" : "border-theme group-hover:border-emerald-500")}>
                    {task.status === 'completed' && <CheckCircle2 size={14} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className={cn("font-medium", task.status === 'completed' ? "line-through" : "")}>{task.title}</p>
                  </div>
                </div>
              )) : (
                <div className="card p-8 text-center border-dashed border-theme">
                  <p className="text-muted italic">No roadmap tasks for today.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-emerald-500" /> Integrated Insights
          </h3>
          <div className="space-y-4">
            {integratedInsights.length > 0 ? integratedInsights.map((insight: any, idx: number) => (
              <div key={idx} className={cn(
                "card p-4 border-l-4",
                insight.type === 'strength' ? "border-emerald-500" : insight.type === 'weakness' ? "border-red-500" : "border-blue-500"
              )}>
                <h4 className="font-bold text-sm mb-1">{insight.title}</h4>
                <p className="text-xs text-muted leading-relaxed">{insight.summary}</p>
              </div>
            )) : (
              <div className="card p-8 text-center border-dashed border-theme">
                <p className="text-muted text-sm italic">Keep tracking to unlock deeper insights.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DailyCheckInView({ onComplete }: any) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<any>({
    studyHours: 4,
    topic: '',
    difficulty: 5,
    focus: 7
  });
  const [loading, setLoading] = useState(false);

  const steps = [
    { key: 'studyHours', q: "How many hours did you study today?", type: 'range', min: 0, max: 15, step: 0.5 },
    { key: 'topic', q: "What was the main topic you focused on?", type: 'text', placeholder: 'e.g. React Hooks, Data Structures...' },
    { key: 'difficulty', q: "How difficult was the topic? (1-10)", type: 'range', min: 1, max: 10, step: 1 },
    { key: 'focus', q: "How would you rate your focus level? (1-10)", type: 'range', min: 1, max: 10, step: 1 },
  ];

  const handleNext = async () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setLoading(true);
      await onComplete(answers);
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const currentStep = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-xl mx-auto"
    >
      <div className="card p-0 overflow-hidden border border-theme shadow-2xl shadow-emerald-500/5">
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-theme">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          />
        </div>

        <div className="p-8">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-inner">
                <Sparkles className="text-emerald-500" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Daily Check-in</h2>
                <p className="text-[10px] text-muted font-mono uppercase tracking-[0.2em] font-bold">Step {step + 1} of {steps.length}</p>
              </div>
            </div>
            {step > 0 && (
              <button 
                onClick={handleBack}
                className="px-3 py-1.5 hover:bg-bg-muted-theme rounded-full text-muted transition-colors text-xs font-bold uppercase tracking-widest"
              >
                Back
              </button>
            )}
          </div>

          <div className="space-y-8">
            <h3 className="text-xl font-medium text-neutral-200 leading-snug min-h-[3rem]">{currentStep.q}</h3>
            
            <div className="min-h-[140px] flex flex-col justify-center">
              {currentStep.type === 'text' ? (
                <input 
                  type="text"
                  value={answers[currentStep.key]}
                  onChange={(e) => setAnswers({ ...answers, [currentStep.key]: e.target.value })}
                  placeholder={currentStep.placeholder}
                  className="w-full bg-bg-theme border border-theme rounded-2xl p-5 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-lg placeholder:text-muted"
                />
              ) : (
                <div className="space-y-8">
                  <div className="relative pt-2">
                    <input 
                      type="range"
                      min={currentStep.min}
                      max={currentStep.max}
                      step={currentStep.step}
                      value={answers[currentStep.key]}
                      onChange={(e) => setAnswers({ ...answers, [currentStep.key]: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-theme rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                  <div className="flex justify-between items-center px-2">
                    <span className="text-[10px] font-mono text-muted font-bold uppercase tracking-widest">{currentStep.min}</span>
                    <div className="flex flex-col items-center">
                      <motion.span 
                        key={answers[currentStep.key]}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-5xl font-bold text-emerald-400 tabular-nums"
                      >
                        {answers[currentStep.key]}
                      </motion.span>
                      <span className="text-[9px] uppercase tracking-[0.3em] text-muted font-bold mt-1">Level</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted font-bold uppercase tracking-widest">{currentStep.max}</span>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleNext}
              disabled={loading || (currentStep.type === 'text' && !answers[currentStep.key])}
              className="w-full btn-glass py-5 flex items-center justify-center gap-3 text-lg font-bold shadow-xl shadow-emerald-500/10 active:scale-[0.98] transition-all group"
            >
              {loading ? (
                <RefreshCw className="animate-spin" size={20} />
              ) : (
                <>
                  <span>{step === steps.length - 1 ? 'Complete Check-in' : 'Continue'}</span>
                  <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
function AnalysisView({ onComplete }: any) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const questions = [
    { key: 'role', q: "What is your current role or field of study?", type: 'text' },
    { key: 'skills', q: "What are your top 3 technical or soft skills?", type: 'text' },
    { key: 'interests', q: "Which industries or technologies excite you the most?", type: 'text' },
    { key: 'goals', q: "Where do you see yourself in 2 years?", type: 'text' },
    { key: 'workStyle', q: "Do you prefer deep technical work, leadership, or creative problem solving?", type: 'text' },
  ];

  const handleNext = async () => {
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      setLoading(true);
      try {
        const analysis = await analyzeCareer(answers);
        onComplete(answers, analysis);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
      <div className="mb-12">
        <div className="flex justify-between text-sm text-muted mb-2">
          <span>Question {step + 1} of {questions.length}</span>
          <span>{Math.round(((step + 1) / questions.length) * 100)}%</span>
        </div>
        <div className="w-full bg-theme h-1 rounded-full">
          <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <h2 className="text-3xl font-bold mb-8">{questions[step].q}</h2>
      <textarea 
        className="w-full bg-card-theme border border-theme rounded-2xl p-6 focus:border-emerald-500 outline-none min-h-[150px] text-lg"
        placeholder="Type your answer here..."
        value={answers[questions[step].key] || ''}
        onChange={(e) => setAnswers({ ...answers, [questions[step].key]: e.target.value })}
      />

      <div className="mt-8 flex justify-end">
        <button onClick={handleNext} disabled={loading || !answers[questions[step].key]} className="btn-glass flex items-center gap-2">
          {loading ? "Analyzing..." : step === questions.length - 1 ? "Finish Analysis" : "Next Question"}
          {!loading && <ChevronRight size={18} />}
        </button>
      </div>
    </motion.div>
  );
}

// --- Roadmap View ---
function RoadmapView({ roadmap, profile, onGenerate }: any) {
  if (!profile?.careerAnalysis) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
          <Compass className="text-emerald-500 w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Welcome to ZAMOX</h1>
        <p className="text-muted max-w-md mb-8">Start by analyzing your career path to unlock personalized roadmaps and daily tasks.</p>
        <button onClick={() => (window.location.hash = 'analysis')} className="btn-glass flex items-center gap-2">
          Start Career Analysis <ChevronRight size={18} />
        </button>
      </motion.div>
    );
  }

  if (!roadmap) {
    const currentSkills = profile?.skills?.slice(0, 4) || [];
    const roadmapOptions = profile.careerAnalysis?.suggestions?.length
      ? profile.careerAnalysis.suggestions.slice(0, 3).map((suggestion: any) => ({
          title: suggestion.title,
          matchScore: suggestion.matchScore,
          description: suggestion.description,
          strengths: suggestion.strengths || [],
          timeline: '6 months',
          coverage: 'AI personalized path',
        }))
      : [];

    if (roadmapOptions.length === 0) {
      return (
        <div className="card p-8 text-center border-dashed border-theme">
          <h2 className="text-2xl font-bold mb-3">Career analysis required</h2>
          <p className="text-muted max-w-2xl mx-auto">Complete your career analysis first. Your roadmap options will unlock after the assessment is finished.</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold">Choose your path</h2>
          <p className="text-sm text-muted mt-2">These 3 roadmap options are generated from your career analysis. Select one to build your personalized roadmap.</p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {roadmapOptions.map((option: any) => (
            <div key={option.title} className="card flex flex-col justify-between border border-emerald-500/20 shadow-[0_20px_60px_rgba(16,185,129,0.08)]">
              <div>
                <div className="flex justify-between items-start mb-4 gap-4">
                  <div>
                    <h3 className="text-xl font-bold">{option.title}</h3>
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mt-1">AI-generated learning path</p>
                  </div>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full font-bold whitespace-nowrap">{option.matchScore}% Match</span>
                </div>
                <p className="text-muted text-sm mb-4">{option.description}</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3 mb-5">
                  <div className="rounded-2xl border border-theme bg-bg-muted-theme p-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Timeline</p>
                    <p className="font-semibold">{option.timeline}</p>
                  </div>
                  <div className="rounded-2xl border border-theme bg-bg-muted-theme p-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Coverage</p>
                    <p className="font-semibold">{option.coverage}</p>
                  </div>
                  <div className="rounded-2xl border border-theme bg-bg-muted-theme p-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Built from</p>
                    <p className="font-semibold">Your analysis</p>
                  </div>
                </div>

                {option.strengths?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Matched strengths</p>
                    <div className="flex flex-wrap gap-2">
                      {option.strengths.map((strength: string) => (
                        <span key={`${option.title}-${strength}`} className="px-3 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {strength}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {currentSkills.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Current skills used for personalization</p>
                    <div className="flex flex-wrap gap-2">
                      {currentSkills.map((skill: string) => (
                        <span key={`${option.title}-${skill}`} className="px-3 py-1 rounded-full text-xs bg-[var(--color-glass-bg)] text-[var(--color-text-muted)] border border-theme">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => onGenerate(option.title)} className="w-full btn-glass">
                Select Path
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{roadmap.title}</h1>
          <p className="text-muted">{roadmap.description}</p>
        </div>
      </div>

      <div className="space-y-12 relative before:absolute before:left-8 before:top-0 before:bottom-0 before:w-px before:bg-theme">
        {roadmap.months.map((month, mIdx) => (
          <div key={mIdx} className="relative pl-20">
            <div className="absolute left-0 top-0 w-16 h-16 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center font-bold text-emerald-400">
              M{month.month}
            </div>
            <div className="card">
              <h3 className="text-xl font-bold mb-4 text-emerald-400">{month.focus}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Key Goals</h4>
                  <ul className="space-y-2">
                    {month.goals.map((g, i) => <li key={i} className="text-sm text-muted flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> {g}</li>)}
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Weekly Plan</h4>
                  {month.weeks.map((week, wIdx) => (
                    <div key={wIdx} className="p-3 bg-bg-muted-theme rounded-xl border border-theme">
                      <p className="text-xs font-bold text-muted mb-2">Week {week.week}</p>
                      <ul className="space-y-1">
                        {week.tasks.map((t, i) => <li key={i} className="text-xs text-muted">• {t}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// --- News View ---
function NewsView({ news, isLoading, onRefresh, profile }: any) {
  useEffect(() => {
    if (news.length === 0 && !isLoading) {
      onRefresh();
    }
  }, []);

  if (!profile) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">News Intelligence</h1>
          <p className="text-muted">AI-curated career insights for: <span className="text-emerald-400 font-medium">{profile?.goals?.[0] || 'your goals'}</span></p>
        </div>
        <button onClick={onRefresh} disabled={isLoading} className="btn-glass flex items-center gap-2">
          {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />}
          {isLoading ? 'Analyzing...' : 'Refresh'}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="card h-64 animate-pulse bg-bg-muted-theme" />)}
        </div>
      ) : news.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {news.map((insight: CareerInsight, i: number) => (
            <div key={i} className="card group hover:border-emerald-500/50 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className={cn("p-2 rounded-lg", insight.importance === 'high' ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400")}>
                  {insight.importance === 'high' ? <AlertTriangle size={20} /> : <Newspaper size={20} />}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{insight.trend}</span>
              </div>
              <h3 className="text-xl font-bold mb-3">{insight.title}</h3>
              <p className="text-muted text-sm mb-6">{insight.summary}</p>
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl mb-4">
                <p className="text-xs text-muted"><span className="font-bold text-emerald-400">Next Step:</span> {insight.nextSteps}</p>
              </div>
              
              {insight.sources && insight.sources.length > 0 && (
                <div className="pt-4 border-t border-theme">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Sources</p>
                  <div className="flex flex-wrap gap-3">
                    {insight.sources.map((source, sIdx) => (
                      <a 
                        key={sIdx} 
                        href={ensureAbsoluteUrl(source.url)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] text-muted hover:text-emerald-400 transition-colors flex items-center gap-1"
                      >
                        <ExternalLink size={10} />
                        <span className="truncate max-w-[120px]">{source.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center border-dashed">
          <Newspaper className="mx-auto text-muted mb-4" size={48} />
          <p className="text-muted">Click refresh to fetch the latest industry insights.</p>
        </div>
      )}
    </motion.div>
  );
}

// --- Mentor Chat ---
function MentorChat({ uid, history, profile, roadmap }: any) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    const userMsg = message;
    setMessage('');
    setLoading(true);
    
    try {
      const context = `User is aiming for ${profile?.goals?.[0] || 'their career goals'}. Current skills: ${profile?.skills?.join(', ') || 'not specified'}. Roadmap: ${roadmap?.title || 'not started'}`;
      const userMsgDoc = { uid, role: 'user', content: userMsg, timestamp: new Date().toISOString() };
      await addDoc(collection(db, 'chats'), userMsgDoc);
      
      const response = await chatWithMentor(history, userMsg, context);
      const assistantMsgDoc = { uid, role: 'assistant', content: response, timestamp: new Date().toISOString() };
      await addDoc(collection(db, 'chats'), assistantMsgDoc);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[70vh] overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-6 mb-6 pr-4 scrollbar-hide">
        {history.map((msg: any, i: number) => (
          <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] p-4 rounded-2xl break-words", 
              msg.role === 'user' ? "bg-emerald-600 text-white rounded-tr-none" : "bg-card-theme border border-theme rounded-tl-none"
            )}>
              <div className="prose prose-invert max-w-none text-sm">
                <Markdown>{msg.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card-theme border border-theme p-4 rounded-2xl rounded-tl-none animate-pulse flex items-center gap-2 text-muted">
              <Sparkles size={16} className="animate-spin" /> Thinking...
            </div>
          </div>
        )}
      </div>
      <div className="relative group">
        <input 
          value={message} 
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask your AI Mentor anything..." 
          className="w-full bg-card-theme border border-theme rounded-full py-4 pl-6 pr-14 outline-none focus:border-emerald-500 transition-all shadow-lg"
        />
        <button 
          onClick={handleSend} 
          disabled={loading || !message.trim()} 
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500 hover:bg-emerald-600 disabled:bg-theme text-white rounded-full flex items-center justify-center transition-all active:scale-90"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

// --- Profile View ---
function ProfileView({ profile }: any) {
  const [newSource, setNewSource] = useState('');
  if (!profile) return null;

  const addSource = async () => {
    if (!newSource.trim()) return;
    const sources = [...(profile.preferredSources || []), newSource.trim()];
    try {
      await updateDoc(doc(db, 'users', profile.uid), { preferredSources: sources });
      setNewSource('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const removeSource = async (index: number) => {
    const sources = (profile.preferredSources || []).filter((_: any, i: number) => i !== index);
    try {
      await updateDoc(doc(db, 'users', profile.uid), { preferredSources: sources });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="card flex flex-col items-center text-center p-12">
        <div className="w-32 h-32 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
          <User className="text-emerald-500 w-16 h-16" />
        </div>
        <h2 className="text-3xl font-bold mb-2">{profile.displayName}</h2>
        <p className="text-emerald-400 font-medium">{profile.email}</p>
        <div className="mt-8 grid grid-cols-2 gap-4 w-full">
          <div className="p-4 bg-bg-muted-theme rounded-2xl border border-theme">
            <p className="text-2xl font-bold text-emerald-400">{profile.streak}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted">Streak</p>
          </div>
          <div className="p-4 bg-bg-muted-theme rounded-2xl border border-theme">
            <p className="text-2xl font-bold text-emerald-400">{profile.growthStage}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted">Stage</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Newspaper size={20} />
          </div>
          <h3 className="text-xl font-bold">Preferred News Sources</h3>
        </div>
        <p className="text-muted text-sm mb-6">
          Add specific domains or websites (e.g., "linkedin.com", "medium.com") to prioritize them in your news feed.
        </p>
        
        <div className="flex gap-3 mb-6">
          <input 
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addSource()}
            placeholder="e.g. techcrunch.com"
            className="flex-1 bg-glass border border-theme rounded-xl px-4 outline-none focus:border-emerald-500 text-sm"
          />
          <button onClick={addSource} className="btn-glass py-2">Add</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {profile.preferredSources?.map((source: string, i: number) => (
            <div key={i} className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-xs border border-emerald-500/20">
              {source}
              <button onClick={() => removeSource(i)} className="hover:text-red-400 transition-colors">
                <Plus size={14} className="rotate-45" />
              </button>
            </div>
          ))}
          {(!profile.preferredSources || profile.preferredSources.length === 0) && (
            <p className="text-muted text-xs italic">No preferred sources added yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsView({ profile, onResetCareer, onUpdateProfile }: any) {
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdateProfile({ displayName });
    setIsSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
          <Settings size={24} />
        </div>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <div className="card space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <User size={20} className="text-emerald-400" />
          Profile Settings
        </h3>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted">Display Name</label>
          <div className="flex gap-3">
            <input 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1 bg-glass border border-theme rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500"
              placeholder="Your name"
            />
            <button 
              onClick={handleSave} 
              disabled={isSaving || displayName === profile?.displayName}
              className="btn-glass flex items-center gap-2"
            >
              <Save size={18} />
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="card space-y-6 border-red-500/20">
        <h3 className="text-xl font-bold flex items-center gap-2 text-red-400">
          <Trash2 size={20} />
          Danger Zone
        </h3>
        
        <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
          <h4 className="font-bold text-red-400 mb-1">Reset Career Path</h4>
          <p className="text-sm text-muted mb-4">
            This will permanently delete your current career roadmap, all associated tasks, and analysis. You will need to take the career assessment again.
          </p>
          
          <div className="flex flex-wrap gap-3">
            {!showConfirmReset ? (
              <button 
                onClick={() => setShowConfirmReset(true)}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full border border-red-500/20 transition-all text-sm font-bold flex items-center gap-2"
              >
                <Trash2 size={16} />
                Reset Career & Analysis
              </button>
            ) : (
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2">
                <button 
                  onClick={onResetCareer}
                  className="px-4 py-2 bg-red-500 text-white rounded-full font-bold text-sm hover:bg-red-600 transition-all"
                >
                  Yes, Reset Everything
                </button>
                <button 
                  onClick={() => setShowConfirmReset(false)}
                  className="px-4 py-2 bg-glass hover:bg-border-theme text-muted rounded-full border border-theme transition-all text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {profile?.careerAnalysis && (
        <div className="card bg-emerald-500/5 border-emerald-500/20">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Trophy size={20} className="text-emerald-400" />
            Current Career Stats
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-bg-muted-theme rounded-2xl border border-theme">
              <p className="text-3xl font-bold text-emerald-400">{profile.careerAnalysis.careerFitScore}%</p>
              <p className="text-xs uppercase tracking-widest text-muted">Career Fit Score</p>
            </div>
            <div className="p-4 bg-bg-muted-theme rounded-2xl border border-theme">
              <p className="text-3xl font-bold text-emerald-400">{profile.growthStage}</p>
              <p className="text-xs uppercase tracking-widest text-muted">Growth Stage</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-bg-muted-theme rounded-2xl border border-theme">
            <p className="text-sm font-medium text-muted mb-2">Current Focus</p>
            <p className="text-lg font-bold text-emerald-400">{profile.currentRole || "Not set"}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function NotFoundView({ onBackHome }: any) {
  return (
    <div className="text-center py-20">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-muted mb-8">Page not found</p>
      <button onClick={onBackHome} className="btn-glass">Go Home</button>
    </div>
  );
}
