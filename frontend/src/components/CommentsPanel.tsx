import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsApi } from '../api/comments';
import { useAuthStore } from '../store/authStore';
import { useToast } from './ToastProvider';
import { MessageSquare, Send, Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface CommentsPanelProps {
  entityType: string;
  entityId: string;
}

export default function CommentsPanel({ entityType, entityId }: CommentsPanelProps) {
  const { user } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');

  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', entityType, entityId],
    queryFn: () => commentsApi.getByEntity(entityType, entityId),
    enabled: !!entityId,
  });

  const createMutation = useMutation({
    mutationFn: () => commentsApi.create(entityType, entityId, newComment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
      setNewComment('');
      toast?.success('Comment posted successfully');
    },
    onError: (err: any) => {
      console.error(err);
      toast?.error(err.response?.data?.message || 'Failed to post comment');
    }
  });

  const createFlagMutation = useMutation({
    mutationFn: () => commentsApi.create(entityType, entityId, '🚨 **[ACTION REQUIRED] Flagged for Review**\n\nPlease evaluate this record for compliance or corrections.'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
      toast?.success('Flagged for review successfully');
    },
    onError: (err: any) => {
      console.error(err);
      toast?.error(err.response?.data?.message || 'Failed to flag');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => commentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] });
      toast?.success('Comment deleted');
    },
    onError: (err: any) => {
      toast?.error('Failed to delete comment');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (newComment.trim()) {
      createMutation.mutate();
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[400px]">
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-white">Discussions & Notes</h3>
        </div>
        <button
          type="button"
          onClick={() => createFlagMutation.mutate()}
          disabled={createFlagMutation.isPending}
          className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded text-xs font-medium transition-colors flex items-center gap-1 shrink-0"
        >
          {createFlagMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin"/> : <AlertTriangle className="w-3 h-3" />}
          Flag for Review
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
          </div>
        ) : comments?.length === 0 ? (
          <div className="text-center text-sm text-zinc-500 italic py-8">
            No comments yet. Start the discussion.
          </div>
        ) : (
          comments?.map((comment) => (
            <div key={comment.id} className="flex gap-3 items-start group">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 text-xs font-semibold text-zinc-300">
                {(comment.author.fullName || comment.author.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-200">
                      {comment.author.fullName || comment.author.email}
                    </span>
                    <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                      {comment.author.role.roleName}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 whitespace-pre-wrap">{comment.content}</p>
                
                {(user?.id === comment.author.id || user?.role === 'ADMIN') && (
                  <button
                    onClick={() => { if(confirm('Delete message?')) deleteMutation.mutate(comment.id); }}
                    className="absolute top-2 right-2 p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-800 bg-zinc-900/30 shrink-0 flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a note, question, or approval..."
          disabled={createMutation.isPending}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || createMutation.isPending}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center shrink-0"
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
