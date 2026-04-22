import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Shield, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { authApi } from '../api/auth';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Invalid or missing reset token.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      console.error('Reset error:', err);
      const serverMessage = err.response?.data?.message;
      const finalMessage = Array.isArray(serverMessage) 
        ? serverMessage[0] 
        : (typeof serverMessage === 'string' ? serverMessage : (serverMessage?.message || 'Failed to reset password. The link may have expired.'));
      
      setError(typeof finalMessage === 'string' ? finalMessage : JSON.stringify(finalMessage));
    } finally {
      setLoading(false);
    }
  };

  if (!token && !success) {
    return (
      <div className="min-h-screen flex bg-zinc-950 items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Invalid Reset Link</h2>
          <p className="text-zinc-400">This password reset link is invalid or has expired.</p>
          <Button onClick={() => navigate('/forgot-password')}>Request a new link</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-zinc-950 items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800 shadow-2xl backdrop-blur-sm">
        <div className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 mx-auto mb-6">
            <Shield className="h-6 w-6 text-blue-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Set new password</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {success ? 'Your password has been successfully reset.' : 'Please enter your new password below.'}
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            </div>
            <p className="text-zinc-300">Redirecting to login page...</p>
            <Button onClick={() => navigate('/login')} className="w-full">Go to Login</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-sm font-medium text-red-500">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium leading-6 text-zinc-300">
                  New Password
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border-0 bg-zinc-900 py-2.5 pl-10 pr-3 text-white shadow-sm ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium leading-6 text-zinc-300">
                  Confirm Password
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded-lg border-0 bg-zinc-900 py-2.5 pl-10 pr-3 text-white shadow-sm ring-1 ring-inset ring-zinc-800 placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-6 text-base font-semibold group"
              disabled={loading}
            >
              <span className="flex items-center">
                {loading ? 'Updating password...' : 'Reset password'}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </span>
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
