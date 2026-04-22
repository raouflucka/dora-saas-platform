import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Shield, ArrowLeft, Mail } from 'lucide-react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(5);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let timer: any;
    if (message && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (message && countdown === 0) {
      navigate('/login');
    }
    return () => clearInterval(timer);
  }, [message, countdown, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await authApi.forgotPassword(normalizedEmail);
      setMessage(response.message || 'A password reset link has been sent to your email.');
    } catch (err: any) {
      console.error('Forgot error:', err);
      if (err.response?.status === 404) {
        setError('No account found with this email.');
      } else {
        const serverMessage = err.response?.data?.message;
        const finalMessage = Array.isArray(serverMessage) 
          ? serverMessage[0] 
          : (typeof serverMessage === 'string' ? serverMessage : (serverMessage?.message || 'Check your internet connection or try again later.'));
        
        setError(typeof finalMessage === 'string' ? finalMessage : JSON.stringify(finalMessage));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-950 items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800 shadow-2xl backdrop-blur-sm">
        <div className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 mx-auto mb-6">
            <Shield className="h-6 w-6 text-blue-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white transition-all">Forgot password?</h2>
          <p className="mt-2 text-sm text-zinc-400">
            No worries, we'll send you reset instructions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4">
              <p className="text-sm font-medium text-red-500">{error}</p>
            </div>
          )}

          {message && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-4">
              <p className="text-sm font-medium text-emerald-500">{message}</p>
              <p className="text-xs text-emerald-500/70 mt-1">Redirecting to login in {countdown}s...</p>
            </div>
          )}

          {!message && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium leading-6 text-zinc-300">
                Email address
              </label>
              <div className="mt-2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-zinc-500" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border-0 bg-zinc-900 py-2.5 pl-10 pr-3 text-white shadow-sm ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 transition-all"
                  placeholder="name@company.com"
                />
              </div>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full py-6 text-base font-semibold transition-all"
            disabled={loading || !!message}
          >
            {loading ? 'Sending link...' : message ? 'Email sent' : 'Reset password'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center text-sm font-medium text-zinc-400 hover:text-white transition-colors gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to log in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
