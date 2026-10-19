import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, Bookmark, Heart, MessageCircle, MoreHorizontal, Share2 } from "lucide-react";
import { deletePost, setPostLiked, setPostSaved, sharePost } from "../../services/postService";
import { useShell } from "../../layout/ShellContext";
import { useToast } from "../../ui/Toast";
import Avatar from "../../ui/Avatar";
import StatusChip from "../../ui/StatusChip";
import Comments from "./Comments";
import { formatRelativeTime } from "../../utils/time";
import { errorMessage } from "../../utils/errors";
import type { Post } from "../../types/platform";
import { POST_CATEGORY_LABEL } from "../../data/categories";

type PostCardProps = {
  post: Post;
  initiallyOpen?: boolean;
  onEdit?: (post: Post) => void;
  onDeleted?: (post: Post) => void;
};

function PostCard({ post, initiallyOpen = false, onEdit, onDeleted }: PostCardProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, organization } = useShell();
  const [liked, setLiked] = useState(Boolean(post.liked_by_me));
  const [likes, setLikes] = useState(post.like_count ?? 0);
  const [saved, setSaved] = useState(Boolean(post.saved_by_me));
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);
  const [showComments, setShowComments] = useState(initiallyOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const own = Boolean(organization && post.organization?.id === organization.id);

  const needLogin = () => {
    toast({ title: "Log in to do that", body: "Create a free account to like, save and comment.", link: { to: "/login", label: "Log in" } });
  };

  const like = async () => {
    if (!user) return needLogin();
    const next = !liked;
    setLiked(next);
    setLikes((count) => count + (next ? 1 : -1));
    try {
      const result = await setPostLiked(post.id, next);
      setLikes(result.like_count);
    } catch {
      setLiked(!next);
      setLikes(post.like_count ?? 0);
    }
  };

  const save = async () => {
    if (!user) return needLogin();
    const next = !saved;
    setSaved(next);
    try {
      await setPostSaved(post.id, next);
      toast({ title: next ? "Saved" : "Removed from saved" });
    } catch {
      setSaved(!next);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/feed?post=${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", body: "Share it anywhere to help this animal." });
    } catch {
      toast({ title: "Share this link", body: url });
    }
    sharePost(post.id).catch(() => {});
  };

  const remove = async () => {
    setMenuOpen(false);
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    try {
      await deletePost(post.id);
      onDeleted?.(post);
      toast({ title: "Post deleted" });
    } catch (error) {
      toast({ title: "Couldn't delete the post", body: errorMessage(error), tone: "error" });
    }
  };

  return (
    <article className="card post" id={`post-${post.id}`}>
      <header className="post-head">
        <Link to={`/organizations/${post.organization.id}`}>
          <Avatar name={post.organization.name} src={post.organization.image} size={40} square />
        </Link>
        <div className="post-head-text">
          <Link to={`/organizations/${post.organization.id}`} className="strong row" style={{ gap: 4 }}>
            {post.organization.name}
            {post.organization.is_verified ? <BadgeCheck size={15} color="var(--green-700)" aria-label="Verified" /> : null}
          </Link>
          <span className="small muted">
            {formatRelativeTime(post.created_at)}
            {post.category ? ` · ${POST_CATEGORY_LABEL[post.category] ?? post.category}` : ""}
          </span>
        </div>
        {own ? (
          <div className="panel-anchor">
            <button type="button" className="sa-icon-btn" aria-label="Post options" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              <MoreHorizontal size={18} />
            </button>
            {menuOpen ? (
              <div className="dropdown" style={{ width: 160, padding: 4 }} role="menu">
                <button type="button" role="menuitem" className="shell-menu-item" onClick={() => { setMenuOpen(false); onEdit?.(post); }}>Edit</button>
                <button type="button" role="menuitem" className="shell-menu-item" style={{ color: "var(--color-danger-ink)" }} onClick={remove}>Delete</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="post-body">
        <h3 className="post-title">{post.title}</h3>
        {post.content && post.content !== post.title ? <p className="post-text">{post.content}</p> : null}
      </div>

      {post.image ? <img src={post.image} alt={post.title} className="post-image" loading="lazy" /> : null}

      {post.animal ? (
        <button type="button" className="post-animal" onClick={() => navigate(`/animals/${post.animal.id}`)}>
          <span className="post-animal-photo">{post.animal.image ? <img src={post.animal.image} alt="" /> : null}</span>
          <span className="post-animal-text">
            <span className="strong small">{post.animal.name}</span>
            <span className="small muted">{[post.animal.species, post.animal.breed].filter(Boolean).join(" · ")}</span>
          </span>
          <StatusChip kind="animal" value={post.animal.status} />
        </button>
      ) : null}

      <div className="post-actions">
        <button type="button" className={liked ? "is-on" : undefined} aria-pressed={liked} onClick={like}>
          <Heart size={17} fill={liked ? "currentColor" : "none"} /> {likes || ""} <span className="sr-only">likes</span>
        </button>
        <button type="button" aria-expanded={showComments} onClick={() => setShowComments(!showComments)}>
          <MessageCircle size={17} /> {commentCount || ""} <span className="post-action-label">Comment</span>
        </button>
        <button type="button" onClick={share}>
          <Share2 size={17} /> <span className="post-action-label">Share</span>
        </button>
        <button type="button" className={`post-save${saved ? " is-on" : ""}`} aria-pressed={saved} aria-label={saved ? "Saved" : "Save"} onClick={save}>
          <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>

      {showComments ? <Comments postId={post.id} onCountChange={setCommentCount} /> : null}
    </article>
  );
}

export default PostCard;
