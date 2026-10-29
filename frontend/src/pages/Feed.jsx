import React, { useCallback, useEffect, useState } from 'react';
import { Heart, ImagePlus, LoaderCircle, MessageCircle, Plus, Tag, X } from 'lucide-react';

const CATEGORIES = ['All', 'Dance', 'Singing', 'Painting', 'Technical', 'Photography', 'Others'];
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'The request could not be completed');
  }
  return result;
}

function initials(username = 'Campus member') {
  return username
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function PostMedia({ post }) {
  if (post.media_type === 'video') {
    return (
      <video
        src={post.media_url}
        controls
        preload="metadata"
        className="max-h-[70vh] w-full bg-black object-contain"
        aria-label={`Video post in ${post.category}`}
      />
    );
  }
  return (
    <img
      src={post.media_url}
      alt={post.caption || `${post.category} talent post`}
      className="max-h-[70vh] w-full bg-slate-100 object-contain"
    />
  );
}

function Modal({ title, onClose, children, size = 'max-w-lg' }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90vh] w-full ${size} overflow-y-auto rounded-2xl bg-white shadow-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function Feed({ user }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showMyPosts, setShowMyPosts] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [category, setCategory] = useState('');
  const [caption, setCaption] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [postError, setPostError] = useState('');
  const [activeCommentsPost, setActiveCommentsPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [likingPostIds, setLikingPostIds] = useState(() => new Set());

  const loadFeed = useCallback(async (signal) => {
    setLoading(true);
    setFeedError('');
    const query = new URLSearchParams({ category: selectedCategory });
    const path = showMyPosts && user?.id
      ? `/posts/profile/${encodeURIComponent(user.id)}?${query}`
      : `/posts?${query}`;
    try {
      const feedPosts = await request(path, { signal });
      setPosts(feedPosts);
    } catch (error) {
      if (error.name !== 'AbortError') setFeedError(error.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [selectedCategory, showMyPosts, user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    loadFeed(controller.signal);
    return () => controller.abort();
  }, [loadFeed]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSelectedFile(null);
    setCategory('');
    setCaption('');
    setPostError('');
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setPostError('');
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      setPostError('Choose a supported image or video file.');
      event.target.value = '';
      setSelectedFile(null);
      return;
    }
    if (isImage && file.size > 10 * 1024 * 1024) {
      setPostError('Images must be 10 MB or smaller.');
      event.target.value = '';
      setSelectedFile(null);
      return;
    }
    if (isVideo && file.size > 50 * 1024 * 1024) {
      setPostError('Videos must be 50 MB or smaller.');
      event.target.value = '';
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleCreatePost = async (event) => {
    event.preventDefault();
    if (!selectedFile || !category) {
      setPostError('Select a photo or video and a category before sharing.');
      return;
    }
    setSubmittingPost(true);
    setPostError('');
    const formData = new FormData();
    formData.append('media', selectedFile);
    formData.append('category', category);
    formData.append('caption', caption);
    try {
      const createdPost = await request('/posts', { method: 'POST', body: formData });
      if (
        (selectedCategory === 'All' || selectedCategory === createdPost.category) &&
        (!showMyPosts || createdPost.user_id === user?.id)
      ) {
        setPosts((current) => [createdPost, ...current]);
      }
      closeCreateModal();
    } catch (error) {
      setPostError(error.message);
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleLike = async (post) => {
    if (likingPostIds.has(post.id)) return;
    setLikingPostIds((current) => new Set(current).add(post.id));
    try {
      const result = await request(`/posts/${encodeURIComponent(post.id)}/like`, { method: 'POST' });
      setPosts((current) => current.map((item) => item.id === post.id
        ? { ...item, user_has_liked: result.liked, likes_count: result.likesCount }
        : item));
    } catch (error) {
      setFeedError(error.message);
    } finally {
      setLikingPostIds((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    }
  };

  const openComments = async (post) => {
    setActiveCommentsPost(post);
    setComments([]);
    setCommentText('');
    setCommentError('');
    setCommentsLoading(true);
    try {
      setComments(await request(`/posts/${encodeURIComponent(post.id)}/comments`));
    } catch (error) {
      setCommentError(error.message);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleCreateComment = async (event) => {
    event.preventDefault();
    if (!activeCommentsPost || !commentText.trim()) return;
    setSubmittingComment(true);
    setCommentError('');
    try {
      const createdComment = await request(
        `/posts/${encodeURIComponent(activeCommentsPost.id)}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: commentText })
        }
      );
      setComments((current) => [...current, createdComment]);
      setCommentText('');
      setPosts((current) => current.map((post) => post.id === activeCommentsPost.id
        ? { ...post, comments_count: Number(post.comments_count || 0) + 1 }
        : post));
    } catch (error) {
      setCommentError(error.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-12">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">CampusConnect</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">Talent feed</h1>
        </div>
        <button
          type="button"
          onClick={() => { setPostError(''); setShowCreateModal(true); }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          Create post
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setShowMyPosts(false)}
          className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
            !showMyPosts ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          For you
        </button>
        <button
          type="button"
          onClick={() => setShowMyPosts(true)}
          className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
            showMyPosts ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          My posts
        </button>
        <span className="mx-1 my-1 w-px shrink-0 bg-slate-200" aria-hidden="true" />
        {CATEGORIES.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => setSelectedCategory(item)}
            aria-pressed={selectedCategory === item}
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
              selectedCategory === item
                ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {feedError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{feedError}</span>
          <button type="button" onClick={() => loadFeed()} className="shrink-0 font-semibold underline">Try again</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-indigo-600" aria-label="Loading posts">
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <ImagePlus className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="mt-3 font-semibold text-slate-900">No posts yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            {showMyPosts ? 'Your talent posts will show up here.' : 'Be the first to share something with your campus.'}
          </p>
          {!showMyPosts && (
            <button type="button" onClick={() => setShowCreateModal(true)} className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              Share your talent
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => (
            <article key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                    {initials(post.username)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{post.username || 'Campus member'}</p>
                    <p className="text-xs text-slate-500">
                      {post.role || 'Campus member'}
                      {post.created_at && ` · ${new Date(post.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                  <Tag className="h-3.5 w-3.5" />{post.category}
                </span>
              </div>

              <PostMedia post={post} />

              <div className="space-y-3 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => handleLike(post)}
                    disabled={likingPostIds.has(post.id)}
                    aria-label={post.user_has_liked ? 'Unlike post' : 'Like post'}
                    aria-pressed={Boolean(post.user_has_liked)}
                    className={`inline-flex items-center gap-2 transition disabled:opacity-60 ${
                      post.user_has_liked ? 'text-rose-600' : 'text-slate-700 hover:text-rose-600'
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${post.user_has_liked ? 'fill-current' : ''}`} />
                    <span className="text-sm font-semibold">{Number(post.likes_count || 0)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openComments(post)}
                    className="inline-flex items-center gap-2 text-slate-600 transition hover:text-indigo-600"
                    aria-label="View comments"
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span className="text-sm font-semibold">{Number(post.comments_count || 0)}</span>
                  </button>
                  <button type="button" onClick={() => openComments(post)} className="ml-auto text-sm font-medium text-slate-500 hover:text-indigo-600">
                    Comment
                  </button>
                </div>
                {post.caption && (
                  <p className="break-words text-sm leading-6 text-slate-700">
                    <span className="mr-1.5 font-semibold text-slate-900">{post.username}</span>
                    {post.caption}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {showCreateModal && (
        <Modal title="Create a talent post" onClose={closeCreateModal}>
          <form onSubmit={handleCreatePost} className="space-y-4 p-5">
            <label className="block cursor-pointer">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Photo or video</span>
              <span className="flex min-h-44 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center hover:border-indigo-400">
                {previewUrl && selectedFile ? (
                  selectedFile.type.startsWith('video/')
                    ? <video src={previewUrl} controls className="max-h-72 w-full object-contain" />
                    : <img src={previewUrl} alt="Selected post preview" className="max-h-72 w-full object-contain" />
                ) : (
                  <>
                    <ImagePlus className="h-8 w-8 text-slate-400" />
                    <span className="mt-2 text-sm font-medium text-slate-700">Choose a file</span>
                    <span className="mt-1 text-xs text-slate-500">Images up to 10 MB · videos up to 50 MB</span>
                  </>
                )}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Category <span className="text-rose-600">*</span></span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="" disabled>Select a talent category</option>
                {CATEGORIES.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Caption</span>
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={2200}
                rows={3}
                placeholder="Tell your campus about it..."
                className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="mt-1 block text-right text-xs text-slate-400">{caption.length}/2200</span>
            </label>

            {postError && <p role="alert" className="text-sm text-rose-700">{postError}</p>}
            <button
              type="submit"
              disabled={submittingPost}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingPost && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {submittingPost ? 'Sharing...' : 'Share post'}
            </button>
          </form>
        </Modal>
      )}

      {activeCommentsPost && (
        <Modal title="Comments" onClose={() => setActiveCommentsPost(null)}>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto px-5 py-4">
            {commentsLoading ? (
              <div className="flex justify-center py-8 text-indigo-600"><LoaderCircle className="h-6 w-6 animate-spin" /></div>
            ) : commentError && comments.length === 0 ? (
              <p role="alert" className="py-5 text-center text-sm text-rose-700">{commentError}</p>
            ) : comments.length === 0 ? (
              <p className="py-5 text-center text-sm text-slate-500">No comments yet. Start the conversation.</p>
            ) : comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {initials(comment.username)}
                </div>
                <p className="min-w-0 break-words rounded-2xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-700">
                  <span className="mr-1.5 font-semibold text-slate-900">{comment.username}</span>
                  {comment.text}
                </p>
              </div>
            ))}
          </div>
          <form onSubmit={handleCreateComment} className="border-t border-slate-100 p-4">
            <div className="flex gap-2">
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                maxLength={1000}
                placeholder="Write a comment..."
                aria-label="Write a comment"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="submit"
                disabled={submittingComment || !commentText.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingComment ? 'Sending' : 'Send'}
              </button>
            </div>
            {commentError && comments.length > 0 && <p role="alert" className="mt-2 text-sm text-rose-700">{commentError}</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
