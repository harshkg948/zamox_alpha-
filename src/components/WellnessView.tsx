import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Moon, 
  Zap, 
  BookOpen, 
  Plus, 
  ChevronRight, 
  TrendingUp, 
  CheckCircle2,
  Leaf,
  MessageSquare,
  Send,
  Sparkles,
  Coffee,
  Brain,
  RefreshCw
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { WellnessLog, WellnessInsight } from '../types';
import { processWellnessCheckIn, generateWellnessInsights } from '../services/gemini';

export function WellnessView({ uid }: { uid: string }) {
  const [logs, setLogs] = useState<WellnessLog[]>([]);
  const [insights, setInsights] = useState<WellnessInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInText, setCheckInText] = useState('');
  const [lastCheckIn, setLastCheckIn] = useState<WellnessLog | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'wellness'),
      where('uid', '==', uid),
      orderBy('date', 'desc'),
      limit(14)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WellnessLog));
      setLogs([...data].reverse());
      setLoading(false);
      
      // Generate insights if we have enough data
      if (data.length >= 3) {
        generateWellnessInsights(data).then(setInsights).catch(console.error);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wellness');
    });

    return unsubscribe;
  }, [uid]);

  const handleCheckIn = async () => {
    if (!checkInText.trim()) return;
    setIsAnalyzing(true);
    try {
      const metrics = await processWellnessCheckIn(checkInText);
      const today = new Date().toISOString().split('T')[0];
      
      const logData = {
        uid,
        date: today,
        ...metrics,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'wellness'), logData);
      setLastCheckIn(logData as any);
      setCheckInText('');
      setShowCheckIn(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'wellness');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const chartData = logs.map(log => ({
    name: log.date.split('-').slice(1).join('/'),
    study: log.studyTime,
    focus: log.focus,
    rest: log.rest,
    breaks: log.breaks || 0
  }));

  const avgStudy = (logs.reduce((acc, l) => acc + l.studyTime, 0) / (logs.length || 1)).toFixed(1);
  const avgFocus = (logs.reduce((acc, l) => acc + l.focus, 0) / (logs.length || 1)).toFixed(1);
  const avgRest = (logs.reduce((acc, l) => acc + l.rest, 0) / (logs.length || 1)).toFixed(1);
  const avgBreaks = (logs.reduce((acc, l) => acc + (l.breaks || 0), 0) / (logs.length || 1)).toFixed(1);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            Wellness Tracking <Sparkles className="text-emerald-500" size={24} />
          </h1>
          <p className="text-muted">AI-guided insights to optimize your study-life balance.</p>
        </div>
        <button 
          onClick={() => setShowCheckIn(true)}
          className="btn-glass flex items-center justify-center gap-2 py-3 px-6"
        >
          <MessageSquare size={18} /> Daily Check-in
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          icon={<BookOpen className="text-blue-400" />} 
          label="Avg. Study" 
          value={`${avgStudy}h`} 
          sub="Daily"
        />
        <StatCard 
          icon={<Brain className="text-yellow-400" />} 
          label="Avg. Focus" 
          value={`${avgFocus}/10`} 
          sub="Quality"
        />
        <StatCard 
          icon={<Moon className="text-purple-400" />} 
          label="Avg. Rest" 
          value={`${avgRest}/10`} 
          sub="Sleep"
        />
        <StatCard 
          icon={<Coffee className="text-orange-400" />} 
          label="Avg. Breaks" 
          value={avgBreaks} 
          sub="Frequency"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-500" /> Performance Trends
            </h3>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Study</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Focus</div>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorStudy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="name" stroke="#737373" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#737373" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '12px' }}
                  itemStyle={{ color: '#d4d4d4' }}
                />
                <Area type="monotone" dataKey="study" stroke="#10b981" fillOpacity={1} fill="url(#colorStudy)" strokeWidth={3} />
                <Area type="monotone" dataKey="focus" stroke="#3b82f6" fillOpacity={1} fill="url(#colorFocus)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-emerald-500" /> AI Growth Insights
          </h3>
          <div className="space-y-4">
            {insights.length > 0 ? (
              insights.map((insight, idx) => (
                <InsightItem 
                  key={idx}
                  title={insight.title} 
                  desc={insight.desc} 
                  type={insight.type}
                />
              ))
            ) : (
              <div className="p-8 text-center card border-dashed border-theme">
                <div className="w-12 h-12 bg-theme rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="text-muted" size={24} />
                </div>
                <p className="text-sm text-muted">
                  Log at least 3 days to unlock personalized AI growth insights.
                </p>
              </div>
            )}
          </div>
          
          {lastCheckIn && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl"
            >
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">Today's Summary</p>
              <p className="text-sm text-muted italic">"{lastCheckIn.summary}"</p>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCheckIn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="card max-w-lg w-full p-8 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500"></div>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                  <Sparkles className="text-emerald-500" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Daily Wellness Check-in</h2>
                  <p className="text-sm text-muted">Tell me about your day in your own words.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-bg-theme rounded-2xl border border-theme">
                  <p className="text-sm text-muted leading-relaxed">
                    "How was your study session today? Did you feel focused? How much did you sleep last night, and did you take enough breaks?"
                  </p>
                </div>

                <div className="relative">
                  <textarea 
                    value={checkInText}
                    onChange={(e) => setCheckInText(e.target.value)}
                    placeholder="e.g. I studied for 6 hours today. Felt really focused in the morning but tired after lunch. Slept 8 hours last night and took 4 short breaks."
                    className="w-full bg-bg-theme border border-theme rounded-2xl p-4 text-sm min-h-[120px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
                    disabled={isAnalyzing}
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowCheckIn(false)} 
                    className="flex-1 px-4 py-3 border border-theme rounded-xl hover:bg-glass transition-colors text-sm font-medium"
                    disabled={isAnalyzing}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCheckIn} 
                    className="flex-1 btn-glass flex items-center justify-center gap-2 py-3 text-sm"
                    disabled={isAnalyzing || !checkInText.trim()}
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="animate-spin" size={18} />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Complete Check-in
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode, label: string, value: string, sub: string }) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="p-2 bg-bg-muted-theme rounded-xl border border-theme">
          {icon}
        </div>
        <span className="text-[10px] text-muted font-bold uppercase tracking-widest">{sub}</span>
      </div>
      <div>
        <p className="text-xs text-muted mb-1">{label}</p>
        <span className="text-2xl font-bold tracking-tight">{value}</span>
      </div>
    </div>
  );
}

function InsightItem({ title, desc, type }: { title: string, desc: string, type: 'positive' | 'neutral' | 'negative' }) {
  return (
    <div className="card p-4 flex gap-4 items-start border-l-4" style={{ 
      borderLeftColor: type === 'positive' ? '#10b981' : type === 'neutral' ? '#3b82f6' : '#ef4444' 
    }}>
      <div className={cn(
        "p-2 rounded-lg mt-1",
        type === 'positive' ? "bg-emerald-500/10 text-emerald-400" : 
        type === 'neutral' ? "bg-blue-500/10 text-blue-400" : 
        "bg-red-500/10 text-red-400"
      )}>
        {type === 'positive' ? <CheckCircle2 size={16} /> : <Sparkles size={16} />}
      </div>
      <div>
        <h4 className="font-bold text-sm mb-1">{title}</h4>
        <p className="text-xs text-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
