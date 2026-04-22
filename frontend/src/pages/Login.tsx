import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/button';
import { Shield, Activity, Lock, ArrowRight } from 'lucide-react';
import { authApi } from '../api/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth, user } = useAuthStore();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    try {
      const { access_token, user } = await authApi.login(email, password, rememberMe);
      setAuth(user, access_token);
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      // Reliably format error object to string
      const serverData = err.response?.data;
      let finalMessage = 'An unexpected error occurred during login. Please try again.';
      
      if (serverData) {
        if (Array.isArray(serverData.message)) {
          finalMessage = serverData.message[0];
        } else if (typeof serverData.message === 'string') {
          finalMessage = serverData.message;
        } else if (typeof serverData === 'string') {
          finalMessage = serverData;
        }
      }
      
      setError(finalMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-950">
      {/* Left Column - Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:w-[480px] xl:w-[560px] border-r border-zinc-800/60 bg-zinc-950 z-10 shadow-[8px_0_24px_rgba(0,0,0,0.5)]">
        <div className="mx-auto w-full max-w-sm lg:w-[400px]">
          
          <div className="flex items-center gap-3 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 border border-blue-500/20 shadow-inner">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-white">DORA Platform</span>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Log in to your account</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Access the Regulatory Compliance & Resilience Hub.
            </p>
          </div>

          <div className="mt-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-500">{error}</h3>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium leading-6 text-zinc-300">
                  Email address
                </label>
                <div className="mt-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="block w-full rounded-md border-0 bg-zinc-900/50 py-2.5 px-3 text-white shadow-sm ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:opacity-50 sm:text-sm sm:leading-6 transition-all"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium leading-6 text-zinc-300">
                  Password
                </label>
                <div className="mt-2">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="block w-full rounded-md border-0 bg-zinc-900/50 py-2.5 px-3 text-white shadow-sm ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:opacity-50 sm:text-sm sm:leading-6 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="h-4 w-4 rounded border-zinc-800 bg-zinc-900/50 text-blue-600 focus:ring-blue-600 focus:ring-offset-zinc-950 disabled:opacity-50"
                  />
                  <label htmlFor="remember-me" className="ml-3 block text-sm leading-6 text-zinc-400">
                    Remember me
                  </label>
                </div>

                <div className="text-sm leading-6">
                  <button 
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="font-medium text-blue-500 hover:text-blue-400 transition-colors bg-transparent border-none p-0 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="flex w-full justify-center rounded-md bg-white px-3 py-6 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
                disabled={loading}
              >
                <span className="flex items-center text-base">
                  {loading ? 'Authenticating...' : 'Sign in'}
                  {!loading && <ArrowRight className="ml-2 h-4 w-4 text-zinc-500 group-hover:text-zinc-900 transition-colors" />}
                </span>
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Right Column - Premium Visual */}
      <div className="relative hidden w-0 flex-1 lg:block bg-zinc-950 overflow-hidden">
        {/* Subtle grid pattern background */}
        <div 
          className="absolute inset-0 z-0 opacity-[0.12]" 
          style={{ 
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, 
            backgroundSize: '32px 32px' 
          }}
        />
        
        {/* Premium ambient glow */}
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

        <div className="absolute inset-0 flex flex-col justify-center items-center p-12 z-10">
          <div className="max-w-xl text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-700/50 backdrop-blur-sm shadow-2xl">
              <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"></span>
              <span className="text-xs font-medium text-zinc-300 tracking-wide uppercase">Enterprise Grade Security</span>
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight drop-shadow-sm">
              Operational Resilience for the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 font-extrabold pb-1">Financial Sector</span>
            </h1>
            
            <p className="text-lg leading-8 text-zinc-400 max-w-lg mx-auto">
              Centralized hub for managing third-party ICT risks, incident reporting, and digital operational resilience testing in compliance with DORA regulations.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap justify-center gap-3 pt-6">
              <div className="flex items-center gap-2 bg-gradient-to-b from-zinc-800/80 to-zinc-900/80 backdrop-blur-md border border-zinc-700/50 px-4 py-2 rounded-lg shadow-lg">
                <Shield className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-zinc-200">Compliance Audits</span>
              </div>
              <div className="flex items-center gap-2 bg-gradient-to-b from-zinc-800/80 to-zinc-900/80 backdrop-blur-md border border-zinc-700/50 px-4 py-2 rounded-lg shadow-lg">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-zinc-200">Real-time Monitoring</span>
              </div>
              <div className="flex items-center gap-2 bg-gradient-to-b from-zinc-800/80 to-zinc-900/80 backdrop-blur-md border border-zinc-700/50 px-4 py-2 rounded-lg shadow-lg">
                <Lock className="h-4 w-4 text-indigo-400" />
                <span className="text-sm font-medium text-zinc-200">ICT Supply Chain</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
