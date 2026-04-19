import { useState, useEffect, useRef, useMemo, FormEvent } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Flame, 
  Trophy, 
  Target, 
  TrendingUp, 
  Brain, 
  Zap, 
  MessageSquare, 
  X, 
  ChevronRight,
  Award,
  Settings,
  User as UserIcon,
  LayoutDashboard,
  ClipboardList,
  Lightbulb
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// --- Constants ---

const HABITS = [
  { id: 'h1', category: 'Mindset', name: 'Gratitude Advantage', description: "Write what you learned, what you're grateful for, what you did well." },
  { id: 'h2', category: 'Mindset', name: 'Capture Rule', description: '"If you can think it, ink it"—externalize every idea immediately.' },
  { id: 'h3', category: 'Mindset', name: 'Win Your Morning', description: "Plan tomorrow's 3 tasks tonight to eliminate procrastination." },
  { id: 'h4', category: 'Systems', name: 'Eat the Frog First', description: 'Do your hardest task first when your mind is fresh.' },
  { id: 'h5', category: 'Systems', name: 'Habit Stacking', description: 'Attach new habits to existing ones.' },
  { id: 'h6', category: 'Systems', name: 'Time Budgeting', description: 'Conduct 2-week time audit, then budget hours in advance.' },
  { id: 'h7', category: 'Systems', name: 'Decision Diet', description: 'Automate low-value choices to preserve mental energy.' },
  { id: 'h8', category: 'Wealth', name: 'Curated News Feed', description: 'Create industry-specific lists for high-quality information.' },
  { id: 'h9', category: 'Wealth', name: 'Idea Factory', description: 'Write 5 new ideas every morning to strengthen creativity.' },
  { id: 'h10', category: 'Wealth', name: 'Just-in-Time Learning', description: 'Learn only what you need to solve current problems, then apply immediately.' },
  { id: 'h11', category: 'Wealth', name: 'Budget for Growth', description: 'Allocate fixed % of income to courses, conferences, masterminds.' },
  { id: 'h12', category: 'Wealth', name: 'Automate Savings', description: 'Multiple bank accounts + auto-transfers = effortless wealth building.' },
  { id: 'h13', category: 'Wealth', name: 'Weekly Financial Check-in', description: 'Review P&L, cash flow, balance sheet every week.' },
  { id: 'h14', category: 'Wealth', name: 'Multiple Income Streams', description: 'Add customers/products to core business or develop side hustles.' },
  { id: 'h15', category: 'Wealth', name: 'Future Day Vision', description: 'Define your ideal average day, write it down, display it, reverse-engineer it.' },
  { id: 'h16', category: 'Wealth', name: 'Energy Journaling', description: 'Track what energizes vs. drains you; optimize accordingly.' },
  { id: 'h17', category: 'Wealth', name: 'Regular Growth Assessment', description: 'Evaluate health, relationship, business, personal goals; set incremental targets.' },
];

const CHAT_RULES = [
  { keywords: ['habit', 'discipline'], response: "Discipline is the bridge between goals and accomplishment. Focus on your selected 3 habits daily." },
  { keywords: ['motivation', 'start'], response: "Motivation gets you started. Habits keep you going. Start with your 'Frog'—the hardest task." },
  { keywords: ['streak', 'consistency'], response: "Consistency beats intensity. Even if you feel off, just check off one small action." },
  { keywords: ['focus', 'energy'], response: "Your energy is currency. Use 'Decision Diet' to save it for high-leverage work." },
  { keywords: ['wealth', 'money'], response: "Wealth is built through systems. Automate your savings and check your P&L weekly." },
  { keywords: ['learning', 'skill'], response: "Apply 'Just-in-Time Learning'. Don't hoard information; solve current bottlenecks." },
];

const BADGE_DEFINITIONS = [
  { id: 'first_step', name: 'First Step', description: 'First completion' },
  { id: 'streak_3', name: '3 Day Streak', description: 'Maintain a 3-day streak' },
  { id: 'streak_7', name: '7 Day Streak', description: 'Maintain a 7-day streak' },
  { id: 'consistency_50', name: 'Consistency Builder', description: '50 total completions' },
  { id: 'wealth_operator', name: 'Wealth Operator', description: '3 habits completed in one day' },
];

// --- Helper Functions ---

const getDayKey = (dayIndex: number) => {
  // We represent days as 1-7 for the current week context
  return dayIndex + 1;
};

const getTodayString = () => new Date().toISOString().split('T')[0];
const getYesterdayString = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
};

// --- Main Application ---

export default function App() {
  // -- Auth State --
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // -- App State --
  const [activeTab, setActiveTab] = useState<'select' | 'track' | 'reflect'>('select');
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);
  const [tracker, setTracker] = useState<Record<string, boolean>>({});
  const [reflections, setReflections] = useState({ tenX: '', energy: '', ideas: '' });
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastCompletedDate, setLastCompletedDate] = useState('');
  const [totalCompletions, setTotalCompletions] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  
  // -- Chat State --
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: "Welcome, Wealth Engineer. How can I help you optimize your systems today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // -- Persistence Initialization --
  useEffect(() => {
    // Auth Listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsAuthModalOpen(false);
        // Load from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setSelectedHabits(data.selectedHabits || []);
            setTracker(data.tracker || {});
            setReflections(data.reflections || { tenX: '', energy: '', ideas: '' });
            setXp(data.xp || 0);
            setStreak(data.streak || 0);
            setLastCompletedDate(data.lastCompletedDate || '');
            setTotalCompletions(data.totalCompletions || 0);
            setBadges(data.badges || []);
          } else {
            // First time login - initialize Firestore from local or defaults
            const saved = localStorage.getItem('wealth_engineer_state');
            let initialData = {
              selectedHabits: [],
              tracker: {},
              reflections: { tenX: '', energy: '', ideas: '' },
              xp: 0,
              streak: 0,
              lastCompletedDate: '',
              totalCompletions: 0,
              badges: []
            };
            
            if (saved) {
              initialData = { ...initialData, ...JSON.parse(saved) };
            }

            await setDoc(doc(db, 'users', currentUser.uid), {
              ...initialData,
              userId: currentUser.uid,
              updatedAt: serverTimestamp()
            });

            // Set state to match initialData
            setSelectedHabits(initialData.selectedHabits);
            setTracker(initialData.tracker);
            setReflections(initialData.reflections);
            setXp(initialData.xp);
            setStreak(initialData.streak);
            setLastCompletedDate(initialData.lastCompletedDate);
            setTotalCompletions(initialData.totalCompletions);
            setBadges(initialData.badges);
          }
        } catch (err) {
          console.error("Firestore sync error:", err);
        }
      } else {
        // Guest mode - Load from local
        const saved = localStorage.getItem('wealth_engineer_state');
        if (saved) {
          const data = JSON.parse(saved);
          setSelectedHabits(data.selectedHabits || []);
          setTracker(data.tracker || {});
          setReflections(data.reflections || { tenX: '', energy: '', ideas: '' });
          setXp(data.xp || 0);
          setStreak(data.streak || 0);
          setLastCompletedDate(data.lastCompletedDate || '');
          setTotalCompletions(data.totalCompletions || 0);
          setBadges(data.badges || []);
        }
      }
      setAuthLoading(false);
    });

    // Request notification permission
    if ('Notification' in window) {
      Notification.requestPermission();
    }

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  // -- Persistence Sync --
  useEffect(() => {
    const state = { selectedHabits, tracker, reflections, xp, streak, lastCompletedDate, totalCompletions, badges };
    localStorage.setItem('wealth_engineer_state', JSON.stringify(state));

    if (user) {
      // Periodic or immediate Firestore update
      // For responsiveness, we update immediately here
      setDoc(doc(db, 'users', user.uid), {
        ...state,
        userId: user.uid,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(err => {
        console.error("Firestore update error:", err);
      });
    }
  }, [selectedHabits, tracker, reflections, xp, streak, lastCompletedDate, totalCompletions, badges, user]);

  // -- Notifications Interval --
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 20 && now.getMinutes() === 0) {
        if (Notification.permission === 'granted') {
          new Notification("Wealth Engineer Habits", {
            body: "Log your habits and reflect on your day.",
          });
        }
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // -- Chat Scroll Effect --
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // -- Derived State --
  const level = Math.floor(xp / 100) + 1;
  const xpProgress = xp % 100;

  // -- Handlers --

  const toggleHabitSelection = (id: string) => {
    if (selectedHabits.includes(id)) {
      setSelectedHabits(prev => prev.filter(h => h !== id));
    } else if (selectedHabits.length < 3) {
      setSelectedHabits(prev => [...prev, id]);
    }
  };

  const handleTrack = (habitId: string, day: number) => {
    const key = `${habitId}_${day}`;
    const isNowComplete = !tracker[key];
    const today = getTodayString();
    const yesterday = getYesterdayString();

    setTracker(prev => ({ ...prev, [key]: isNowComplete }));

    if (isNowComplete) {
      // XP Logic
      setXp(prev => prev + 10);
      setTotalCompletions(prev => prev + 1);

      // Streak Logic
      // If at least one habit completed today (this one is the first for today if lastCompletedDate isn't today)
      if (lastCompletedDate !== today) {
        if (lastCompletedDate === yesterday) {
          setStreak(prev => prev + 1);
        } else {
          setStreak(1);
        }
        setLastCompletedDate(today);
      }

      // Check Badges
      const newBadges = [...badges];
      
      if (!newBadges.includes('first_step')) {
        newBadges.push('first_step');
      }

      // We'll re-calculate streak related badges after state update or using local variable
      // For simplicity, we check against the estimated new values
    } else {
      // Reverting XP (though prompt doesn't explicitly say to subtract, standard habit apps do)
      setXp(prev => Math.max(0, prev - 10));
      setTotalCompletions(prev => Math.max(0, prev - 1));
    }
  };

  // Badge check side effect
  useEffect(() => {
    const today = getTodayString();
    const newBadges = [...badges];
    let changed = false;

    if (totalCompletions >= 1 && !newBadges.includes('first_step')) {
      newBadges.push('first_step');
      changed = true;
    }
    if (streak >= 3 && !newBadges.includes('streak_3')) {
      newBadges.push('streak_3');
      changed = true;
    }
    if (streak >= 7 && !newBadges.includes('streak_7')) {
      newBadges.push('streak_7');
      changed = true;
    }
    if (totalCompletions >= 50 && !newBadges.includes('consistency_50')) {
      newBadges.push('consistency_50');
      changed = true;
    }

    // Wealth Operator: 3 habits completed on the same day index (we use day 1-7 for the grid)
    // Actually the logic should be "completed today". 
    // Let's assume the user checks the grid for the current day index.
    // For this app, let's check any day index in the current tracker.
    for (let d = 1; d <= 7; d++) {
      const dayCompletions = selectedHabits.filter(id => tracker[`${id}_${d}`]).length;
      if (dayCompletions === 3 && !newBadges.includes('wealth_operator')) {
        newBadges.push('wealth_operator');
        changed = true;
        break;
      }
    }

    if (changed) setBadges(newBadges);
  }, [totalCompletions, streak, tracker, selectedHabits]);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput.toLowerCase();
    setChatMessages(prev => [...prev, { role: 'user', text: chatInput }]);
    setChatInput('');

    setTimeout(() => {
      const rule = CHAT_RULES.find(r => r.keywords.some(k => userMsg.includes(k)));
      const reply = rule ? rule.response : "Focus on your daily inputs. Wealth is an emergent property of consistent, disciplined action. Keep tracking.";
      setChatMessages(prev => [...prev, { role: 'bot', text: reply }]);
    }, 300);
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      if (authMode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // -- Render Helpers --

  const renderAuthModal = () => {
    return (
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute inset-0 bg-primary/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-8 overflow-hidden"
            >
              <button 
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 right-4 text-text-muted hover:text-text-main p-1"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-4">
                  <Brain size={32} />
                </div>
                <h1 className="text-2xl font-extrabold text-primary uppercase tracking-tight">Cloud Optimization</h1>
                <p className="text-text-muted text-sm italic">Synchronize your systems across all nodes.</p>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-1.5 ml-1">Email Authority</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="engineer@wealth.com"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-accent transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-1.5 ml-1">Secure Protocol</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-accent transition-all"
                    required
                  />
                </div>
                
                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-[11px] p-3 rounded-lg font-medium">
                    {error}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-slate-200 uppercase tracking-widest text-sm"
                >
                  {authMode === 'login' ? 'Execute Login' : 'Register Protocol'}
                </button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface px-4 text-text-muted font-bold tracking-tighter">Bio-metric Sync</span>
                </div>
              </div>

              <button 
                onClick={handleGoogleSignIn}
                className="w-full bg-white border border-border text-text-main font-bold py-3 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm text-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sync with Google
              </button>

              <div className="mt-8 text-center">
                <button 
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-accent text-sm font-bold hover:underline"
                >
                  {authMode === 'login' ? 'Need an account? Deploy Profile' : 'Have an account? Access Protocol'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  };

  const renderSelect = () => {
    const categories = ['Mindset', 'Systems', 'Wealth'];
    return (
      <div className="space-y-8 pb-10">
        <div className="bg-[#EFF6FF] p-6 rounded-xl border border-blue-100">
          <h2 className="text-lg font-bold text-primary mb-1">Structural Configuration</h2>
          <p className="text-text-muted text-sm">Deploy exactly 3 habits to optimize your cognitive architecture.</p>
          <div className="mt-4 inline-flex items-center px-4 py-2 bg-white rounded-lg border border-blue-200 text-accent font-bold text-lg">
            {selectedHabits.length} / 3 Selected
          </div>
        </div>

        {categories.map(cat => (
          <div key={cat} className="space-y-4">
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-2 px-1">
              {cat === 'Mindset' && <Brain size={14} className="text-accent" />}
              {cat === 'Systems' && <Zap size={14} className="text-amber-500" />}
              {cat === 'Wealth' && <Target size={14} className="text-success" />}
              {cat}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {HABITS.filter(h => h.category === cat).map(habit => {
                const isSelected = selectedHabits.includes(habit.id);
                const isDisabled = !isSelected && selectedHabits.length >= 3;
                return (
                  <motion.div
                    key={habit.id}
                    whileHover={!isDisabled ? { y: -2, borderColor: '#2563EB' } : {}}
                    whileTap={!isDisabled ? { scale: 0.98 } : {}}
                    onClick={() => !isDisabled && toggleHabitSelection(habit.id)}
                    className={`p-5 rounded-xl border transition-all cursor-pointer relative group ${
                      isSelected 
                        ? 'border-accent bg-blue-50/50 shadow-sm' 
                        : isDisabled 
                          ? 'border-border bg-slate-50 opacity-40 pointer-events-none' 
                          : 'border-border bg-surface hover:shadow-md'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 text-accent">
                        <CheckCircle2 size={18} />
                      </div>
                    )}
                    <h4 className={`font-bold mb-1.5 pr-6 ${isSelected ? 'text-primary' : 'text-text-main'}`}>
                      {habit.name}
                    </h4>
                    <p className={`text-[13px] leading-relaxed ${isSelected ? 'text-text-main' : 'text-text-muted'}`}>
                      {habit.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTrack = () => {
    if (selectedHabits.length === 0) {
      return (
        <div className="text-center py-20 bg-surface rounded-3xl border border-dashed border-border shadow-sm">
          <div className="bg-bg w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ClipboardList className="text-text-muted" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">Systems Dormant</h2>
          <p className="text-text-muted mb-8 max-w-xs mx-auto">
            Your tracking engine is currently offline. Selection required.
          </p>
          <button 
            onClick={() => setActiveTab('select')}
            className="bg-accent text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-blue-200"
          >
            Configure Core Habits
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4 pb-10">
        <div className="hidden md:grid grid-cols-[1fr_300px] gap-5 mb-2 px-4">
          <div></div>
          <div className="grid grid-cols-7 gap-2 text-center">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">{d}</div>
            ))}
          </div>
        </div>

        {selectedHabits.map(id => {
          const habit = HABITS.find(h => h.id === id);
          return (
            <div key={id} className="flex flex-col md:grid md:grid-cols-[1fr_300px] gap-4 md:gap-5 items-start md:items-center p-4 bg-surface border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-full md:pr-4">
                <h3 className="text-sm md:text-[16px] font-bold text-primary mb-1">{habit?.name}</h3>
                <p className="text-xs md:text-[13px] text-text-muted leading-snug">{habit?.description}</p>
              </div>
              <div className="w-full overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <div className="grid grid-cols-7 gap-2 min-w-[280px]">
                  {[1, 2, 3, 4, 5, 6, 7].map(d => {
                    const complete = tracker[`${id}_${d}`];
                    return (
                      <div key={d} className="flex flex-col items-center gap-1">
                        <span className="md:hidden text-[8px] font-bold text-text-muted uppercase">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][d-1]}</span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleTrack(id, d)}
                          className={`h-8 w-8 md:h-9 md:w-9 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                            complete 
                              ? 'bg-success border-success text-white shadow-sm' 
                              : 'border-border text-text-muted hover:border-text-muted bg-white'
                          }`}
                        >
                          {complete ? '✓' : ['M', 'T', 'W', 'T', 'F', 'S', 'S'][d-1]}
                        </motion.button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderReflect = () => {
    return (
      <div className="flex flex-col gap-6 pb-10">
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-accent" />
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-text-muted">Ten X Impact Analysis</h3>
          </div>
          <p className="text-text-main text-sm font-medium mb-4">
            "What's ONE habit that, if done daily for a year, would 10x results?"
          </p>
          <textarea
            value={reflections.tenX}
            onChange={(e) => setReflections(prev => ({ ...prev, tenX: e.target.value }))}
            placeholder="Identity high-leverage bottlenecks..."
            className="w-full h-32 bg-bg border border-border rounded-lg p-4 text-sm focus:ring-1 focus:ring-accent outline-none resize-none"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="bg-[#F1F5F9] rounded-full px-3 py-1.5 text-[12px] font-semibold text-text-main italic">Strategy focus</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-amber-500" />
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-text-muted">Energy Accounting</h3>
          </div>
          <p className="text-text-main text-sm font-medium mb-4">
            "What gave you energy and what drained you today?"
          </p>
          <textarea
            value={reflections.energy}
            onChange={(e) => setReflections(prev => ({ ...prev, energy: e.target.value }))}
            placeholder="Audit your vitality sources..."
            className="w-full h-32 bg-bg border border-border rounded-lg p-4 text-sm focus:ring-1 focus:ring-accent outline-none resize-none"
          />
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={16} className="text-success" />
            <h3 className="text-[12px] font-bold uppercase tracking-widest text-text-muted">Idea Factory Repository</h3>
          </div>
          <p className="text-text-main text-sm font-medium mb-4">
            "Document 5 new ideas for morning execution."
          </p>
          <textarea
            value={reflections.ideas}
            onChange={(e) => setReflections(prev => ({ ...prev, ideas: e.target.value }))}
            placeholder="1. ...&#10;2. ...&#10;3. ...&#10;4. ...&#10;5. ..."
            className="w-full h-32 bg-bg border border-border rounded-lg p-4 text-sm focus:ring-1 focus:ring-accent outline-none resize-none font-mono"
          />
        </div>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-muted font-bold text-xs uppercase tracking-widest">Calibrating Neural Net...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:h-screen w-full flex flex-col bg-bg font-sans text-text-main overflow-x-hidden md:overflow-hidden">
      {renderAuthModal()}
      
      {/* -- Header -- */}
      <header className="py-4 md:h-20 bg-surface border-b border-border flex flex-col md:flex-row items-center justify-between px-6 md:px-10 shrink-0 gap-4">
        <div className="flex items-baseline gap-2">
          <span className="font-extrabold text-lg md:text-xl tracking-tight text-primary uppercase">Wealth Engineer</span>
          <span className="font-light text-lg md:text-xl text-text-muted italic">Habits</span>
        </div>
        
        <div className="flex gap-4 md:gap-8 items-center w-full md:w-auto justify-between md:justify-end overflow-hidden">
          <div className="text-right">
            <div className="text-[9px] md:text-[11px] uppercase tracking-widest text-text-muted font-bold whitespace-nowrap">Current Streak</div>
            <div className="font-mono text-sm md:text-lg font-bold text-primary">{streak} Days</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] md:text-[11px] uppercase tracking-widest text-text-muted font-bold whitespace-nowrap">Engineering Level</div>
            <div className="font-mono text-sm md:text-lg font-bold text-primary">Lvl {level < 10 ? `0${level}` : level}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] md:text-[11px] uppercase tracking-widest text-text-muted font-bold whitespace-nowrap">Total XP</div>
            <div className="font-mono text-sm md:text-lg font-bold text-primary">{xp.toLocaleString()}</div>
          </div>

          <div className="h-8 w-px bg-border hidden md:block ml-2"></div>

          <button 
            onClick={() => user ? handleSignOut() : setIsAuthModalOpen(true)}
            className="flex items-center gap-3 p-1 pr-3 rounded-full border border-border bg-bg hover:border-accent group transition-all shrink-0"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 ${user ? 'bg-success' : 'bg-text-muted group-hover:bg-accent'}`}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User" referrerPolicy="no-referrer" className="w-full h-full rounded-full" />
              ) : (
                <UserIcon size={14} />
              )}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-tighter leading-none mb-1 text-nowrap">
                {user ? 'Cloud Active' : 'Offline Mode'}
              </div>
              <div className="text-[11px] font-bold text-primary leading-none text-nowrap">
                {user ? (user.displayName || user.email?.split('@')[0]) : 'Sign In'}
              </div>
            </div>
          </button>
        </div>
      </header>

      {/* -- Navigation -- */}
      <nav className="h-[60px] bg-surface border-b border-border flex justify-start md:justify-center items-center gap-4 md:gap-10 px-4 md:px-0 shrink-0 overflow-x-auto no-scrollbar">
        {[
          { id: 'select', name: 'Select Habits' },
          { id: 'track', name: 'Tracker' },
          { id: 'reflect', name: 'Reflection' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`text-xs md:text-sm font-semibold cursor-pointer px-3 md:px-4 py-2 rounded-md transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'text-accent bg-[#EFF6FF]' 
                : 'text-text-muted hover:text-text-main hover:bg-slate-50'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </nav>

      {/* -- Main Layout -- */}
      <main className="flex-1 flex flex-col md:grid md:grid-cols-[320px_1fr] gap-6 p-4 md:p-6 md:px-10 overflow-y-auto md:overflow-hidden custom-scrollbar">
        {/* Sidebar */}
        <aside className="flex flex-col gap-4 md:gap-6 shrink-0">
          {activeTab === 'track' && (
            <>
              <div className="bg-surface border border-border rounded-xl p-4 md:p-5 shadow-sm">
                <div className="text-[10px] md:text-[12px] font-bold uppercase tracking-widest text-text-muted mb-3 md:mb-4 flex justify-between">
                  <span>Performance</span>
                  <span className="text-accent">{xpProgress}%</span>
                </div>
                <div className="mb-4 md:mb-5">
                  <div className="flex justify-between text-[11px] md:text-[13px] mb-2 font-medium">
                    <span className="text-text-main">Level {level + 1}</span>
                    <span className="text-text-muted">{100 - xpProgress} XP left</span>
                  </div>
                  <div className="h-1.5 md:h-2 bg-border rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${xpProgress}%` }}
                      className="h-full bg-accent rounded-full"
                    />
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 bg-[#F1F5F9] rounded-full px-3 py-1 text-[10px] md:text-[12px] font-semibold text-text-main">
                  💡 Daily Efficiency: +{((xp / (totalCompletions || 1)) / 10).toFixed(1)}%
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl p-4 md:p-5 shadow-sm order-last md:order-none">
                <div className="text-[10px] md:text-[12px] font-bold uppercase tracking-widest text-text-muted mb-4 flex justify-between">
                  <span>Badges Earned</span>
                  <span className="text-success">{badges.length} / {BADGE_DEFINITIONS.length}</span>
                </div>
                <div className="grid grid-cols-5 md:grid-cols-3 gap-3">
                  {BADGE_DEFINITIONS.map(badge => {
                    const isUnlocked = badges.includes(badge.id);
                    return (
                      <div 
                        key={badge.id}
                        title={`${badge.name}: ${badge.description}`}
                        className={`aspect-square rounded-full flex items-center justify-center text-sm md:text-lg border-2 transition-all group relative ${
                          isUnlocked 
                            ? 'bg-[#ECFDF5] border-success text-success' 
                            : 'bg-[#F1F5F9] border-border text-text-muted opacity-40'
                        }`}
                      >
                        {isUnlocked ? '✓' : '?'}
                        <div className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 bg-primary text-white text-[8px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                          {badge.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="bg-surface border border-border rounded-xl p-4 md:p-5 shadow-sm mt-auto hidden md:block">
            <div className="text-[12px] font-bold uppercase tracking-widest text-text-muted mb-3">Daily Quote</div>
            <p className="text-[13px] text-text-main italic leading-relaxed">
              "Wealth is the ability to fully experience life. Your systems determine your capacity for that experience."
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 flex flex-col gap-4 md:overflow-y-auto md:pr-2 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'select' && renderSelect()}
              {activeTab === 'track' && renderTrack()}
              {activeTab === 'reflect' && renderReflect()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* -- Chatbot -- */}
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute bottom-16 right-0 w-[calc(100vw-2rem)] md:w-96 h-[400px] md:h-[450px] bg-white rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden"
            >
              <div className="p-4 bg-primary text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <Brain size={16} />
                  <span className="font-bold text-sm">Engineer Advisor</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="hover:opacity-70">
                  <X size={18} />
                </button>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg/30 text-sm">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-accent text-white' 
                        : 'bg-white border border-border text-text-main shadow-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border bg-surface flex gap-2 shrink-0">
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="System query..."
                  className="flex-1 bg-bg border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-accent"
                />
                <button 
                  onClick={handleSendMessage}
                  className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                >
                  Send
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
        >
          {isChatOpen ? <Settings size={20} className="md:size-24 animate-spin-slow" /> : <MessageSquare size={20} className="md:size-24" />}
        </button>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
      `}</style>
    </div>
  );
}
