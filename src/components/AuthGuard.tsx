import { useEffect, useState } from 'react';
import { auth, loginWithGoogle } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Leaf, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export function AuthGuard({ children }: { children: (user: User) => React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-theme">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center"
        >
          <Leaf className="text-white w-8 h-8" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-theme p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full card text-center p-12"
        >
          <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-8 mx-auto">
            <Leaf className="text-emerald-500 w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight gradient-text">ZAMOX</h1>
          <p className="text-muted mb-12 text-lg">
            Your Student Career Growth OS. <br/>
            Plant your seeds, nurture your skills, and bloom in your career.
          </p>
          <button 
            onClick={() => loginWithGoogle()}
            className="w-full btn-glass flex items-center justify-center gap-3 py-4 text-lg"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return <>{children(user)}</>;
}
