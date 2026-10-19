import { useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import Modal from "../ui/Modal";
import PostCard from "./feed/PostCard";
import type { Post } from "../types/platform";
import "./UpdateGrid.css";
import "../pages/PostFeed.css";

/** Posts as an Instagram-style photo grid; opening one shows the full post with comments. */
function UpdateGrid({ posts }: { posts: Post[] }) {
  const [open, setOpen] = useState<Post | null>(null);
  return (
    <>
      <div className="update-grid">
        {posts.map((post) => (
          <button key={post.id} type="button" className="update-tile" onClick={() => setOpen(post)} aria-label={`Open update: ${post.title}`}>
            {post.image ? <img src={post.image} alt="" loading="lazy" /> : <span className="update-tile-text">{post.title}</span>}
            <span className="update-tile-overlay" aria-hidden="true">
              <span><Heart size={16} fill="currentColor" /> {post.like_count ?? 0}</span>
              <span><MessageCircle size={16} fill="currentColor" /> {post.comment_count ?? 0}</span>
            </span>
          </button>
        ))}
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
