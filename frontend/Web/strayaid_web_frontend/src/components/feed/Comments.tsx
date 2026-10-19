import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Pin, Trash2 } from "lucide-react";
import { addComment, deleteComment, getComments, setCommentLiked, togglePinComment } from "../../services/postService";
import { useApi } from "../../hooks/useApi";
import { useShell } from "../../layout/ShellContext";
import { useToast } from "../../ui/Toast";
import Avatar from "../../ui/Avatar";
import { LoadingRows } from "../../ui/States";
import { formatRelativeTime } from "../../utils/time";
import { errorMessage } from "../../utils/errors";
import type { PostComment } from "../../types/api";

type CommentProps = {
  comment: PostComment;
  isReply?: boolean;
  onReply: (comment: PostComment) => void;
  onChanged: () => void;
};

function Comment({ comment, isReply = false, onReply, onChanged }: CommentProps) {
  const toast = useToast();
  const { user } = useShell();
  const [liked, setLiked] = useState(comment.liked_by_me);
  const [likes, setLikes] = useState(comment.like_count);

  const like = async () => {
    if (!user) return;
    const next = !liked;
    setLiked(next);
    setLikes((count) => count + (next ? 1 : -1));
    try {
      const result = await setCommentLiked(comment.id, next);
      setLikes(result.like_count);
    } catch {
      setLiked(!next);
      setLikes(comment.like_count);
    }
  };

  const act = async (action: () => Promise<unknown>, failure: string) => {
    try {
      await action();
      onChanged();
    } catch (error) {
      toast({ title: failure, body: errorMessage(error), tone: "error" });
    }
  };

  return (
    <li className={`comment${isReply ? " is-reply" : ""}${comment.is_pinned ? " is-pinned" : ""}`}>
      <Avatar name={comment.author.name} src={comment.author.avatar} size={isReply ? 26 : 32} square={comment.author.is_organization} />
      <div className="comment-main">
        <div className="comment-bubble">
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="strong small">{comment.author.name}</span>
            {comment.author.badge ? <span className="chip chip-green">{comment.author.badge}</span> : null}
            {comment.is_pinned ? <span className="chip chip-navy"><Pin size={10} /> Pinned</span> : null}
          </div>
          <p className="small">{comment.body}</p>
        </div>
        <div className="comment-actions">
          <span className="subtle">{formatRelativeTime(comment.created_at)}</span>
          <button type="button" className={liked ? "is-on" : undefined} onClick={like} disabled={!user} aria-pressed={liked}>
            <Heart size={12} fill={liked ? "currentColor" : "none"} /> {likes || ""} Like
          </button>
          {user && !isReply ? <button type="button" onClick={() => onReply(comment)}>Reply</button> : null}
          {comment.can_pin && !isReply ? (
            <button type="button" onClick={() => act(() => togglePinComment(comment.id), "Couldn't pin the comment")}>
              <Pin size={12} /> {comment.is_pinned ? "Unpin" : "Pin"}
            </button>
          ) : null}
          {comment.can_delete ? (
            <button type="button" className="is-danger" onClick={() => act(() => deleteComment(comment.id), "Couldn't delete the comment")}>
              <Trash2 size={12} /> Delete
            </button>
          ) : null}
        </div>
        {comment.replies.length ? (
          <ul className="comment-list">
            {comment.replies.map((reply) => <Comment key={reply.id} comment={reply} isReply onReply={onReply} onChanged={onChanged} />)}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/** The comments under a post: read for everyone, write, like and reply when signed in;
 *  the post's organization can also pin and delete. */
function Comments({ postId, onCountChange }: { postId: number; onCountChange: (count: number) => void }) {
  const toast = useToast();
  const { user } = useShell();
  const comments = useApi(() => getComments(postId), String(postId));
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const [sending, setSending] = useState(false);

  const refresh = () => comments.reload();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      await addComment(postId, body.trim(), replyTo?.id);
      setBody("");
      setReplyTo(null);
      onCountChange((comments.data?.count ?? 0) + 1);
      refresh();
    } catch (error) {
      toast({ title: "Comment not posted", body: errorMessage(error), tone: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="comments">
      {comments.data ? (
        comments.data.results.length ? (
          <ul className="comment-list">
            {comments.data.results.map((comment) => (
              <Comment key={comment.id} comment={comment} onReply={setReplyTo} onChanged={refresh} />
            ))}
          </ul>
        ) : (
          <p className="small muted">No comments yet.</p>
        )
      ) : (
        <LoadingRows rows={2} height={40} />
      )}

      {user ? (
        <form className="comment-form" onSubmit={submit}>
          {replyTo ? (
            <div className="small muted">
              Replying to <strong>{replyTo.author.name}</strong>{" "}
              <button type="button" className="link small" style={{ border: 0, background: "none", padding: 0 }} onClick={() => setReplyTo(null)}>Cancel</button>
            </div>
          ) : null}
          <div className="row">
            <input
              className="input"
              value={body}
              maxLength={1000}
              onChange={(event) => setBody(event.target.value)}
              placeholder={replyTo ? "Write a reply…" : "Write a comment…"}
              aria-label="Comment"
            />
            <button type="submit" className="btn btn-primary" disabled={sending || !body.trim()}>Post</button>
          </div>
        </form>
      ) : (
        <p className="small muted"><Link to="/login" className="link">Log in</Link> to comment.</p>
      )}
    </div>
  );
}

export default Comments;
