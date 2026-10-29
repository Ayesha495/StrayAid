import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle } from "lucide-react";
import Modal from "../ui/Modal";
import PostCard from "./feed/PostCard";
import type { Post } from "../types/platform";
import { formatRelativeTime } from "../utils/time";
import "./UpdateGrid.css";
import "../pages/PostFeed.css";

/** Posts as an Instagram-style photo grid. Opening one shows the full post with comments,
 *  in a dialog, or on its own page when `hrefFor` gives each post a link. `compact` makes
 *  smaller, square-cornered tiles with a caption (used on animal profiles). */
function UpdateGrid({ posts, hrefFor, compact = false }: { posts: Post[]; hrefFor?: (post: Post) => string; compact?: boolean }) {
  const [open, setOpen] = useState<Post | null>(null);

  const tileContent = (post: Post) => (
    <>
      <span className="update-tile-media">
        {post.image ? <img src={post.image} alt="" loading="lazy" /> : <span className="update-tile-text">{post.title}</span>}
        <span className="update-tile-overlay" aria-hidden="true">
          <span><Heart size={16} fill="currentColor" /> {post.like_count ?? 0}</span>
          <span><MessageCircle size={16} fill="currentColor" /> {post.comment_count ?? 0}</span>
        </span>
      </span>
      {compact ? (
        <span className="update-tile-caption">
          <span className="update-tile-title">{post.title}</span>
          <span className="update-tile-date">{formatRelativeTime(post.created_at)}</span>
        </span>
      ) : null}
    </>
  );

  return (
    <>
      <div className={`update-grid${compact ? " is-compact" : ""}`}>
        {posts.map((post) =>
          hrefFor ? (
            <Link key={post.id} to={hrefFor(post)} className="update-tile" aria-label={`Open update: ${post.title}`}>
              {tileContent(post)}
            </Link>
          ) : (
            <button key={post.id} type="button" className="update-tile" onClick={() => setOpen(post)} aria-label={`Open update: ${post.title}`}>
              {tileContent(post)}
            </button>
          ),
        )}
      </div>
      {open ? (
        <Modal title={open.title} onClose={() => setOpen(null)} wide>
          <PostCard post={open} initiallyOpen />
        </Modal>
      ) : null}
    </>
  );
}

export default UpdateGrid;
