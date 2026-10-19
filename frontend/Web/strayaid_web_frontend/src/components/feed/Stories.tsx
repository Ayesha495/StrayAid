import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { markStorySeen } from "../../services/postService";
import { useShell } from "../../layout/ShellContext";
import Avatar from "../../ui/Avatar";
import { formatRelativeTime } from "../../utils/time";
import type { StoryGroup } from "../../types/api";

// How long each story stays on screen before moving to the next.
const STORY_MS = 6000;

function StoryViewer({ groups, startGroup, onClose, onSeen }: { groups: StoryGroup[]; startGroup: number; onClose: () => void; onSeen: (id: number) => void }) {
  const { user } = useShell();
  const [position, setPosition] = useState({ group: startGroup, story: 0 });
  const group = groups[position.group];
  const story = group?.stories[position.story];

  const next = () => {
    if (!group) return;
    if (position.story < group.stories.length - 1) setPosition({ ...position, story: position.story + 1 });
    else if (position.group < groups.length - 1) setPosition({ group: position.group + 1, story: 0 });
    else onClose();
  };

  const previous = () => {
    if (position.story > 0) setPosition({ ...position, story: position.story - 1 });
    else if (position.group > 0) setPosition({ group: position.group - 1, story: groups[position.group - 1].stories.length - 1 });
  };

  useEffect(() => {
    if (!story) return;
    if (user && !story.seen) {
      markStorySeen(story.id).catch(() => {});
      onSeen(story.id);
    }
    const timer = window.setTimeout(next, STORY_MS);
    return () => window.clearTimeout(timer);
    // Restart the timer for each story.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!story) return null;

  return createPortal(
    <div className="ds story-viewer" role="dialog" aria-modal="true" aria-label={`${group.label} story`}>
      <div className="story-frame">
        <div className="story-progress">
          {group.stories.map((item, index) => (
            <span key={item.id}>
              <span
                className={index < position.story ? "is-done" : index === position.story ? "is-active" : undefined}
                style={index === position.story ? { animationDuration: `${STORY_MS}ms` } : undefined}
              />
            </span>
          ))}
        </div>
        <div className="story-top">
          <Avatar name={story.organization.name} src={story.organization.image} size={32} square />
          <div className="story-top-text">
            <strong>{story.organization.name}</strong>
            <span>{group.label} · {formatRelativeTime(story.created_at)}</span>
          </div>
          <button type="button" className="story-close" aria-label="Close stories" onClick={onClose}><X size={20} /></button>
        </div>
        <img src={story.image} alt={story.headline || group.label} className="story-image" />
        <div className="story-caption">
          {story.headline ? <h3>{story.headline}</h3> : null}
          {story.caption ? <p>{story.caption}</p> : null}
          {story.animal ? (
            <Link to={`/animals/${story.animal.id}`} className="btn btn-primary btn-sm" onClick={onClose}>
              Meet {story.animal.name}
              {story.animal.funding_goal_pkr ? ` · ${Math.min(100, Math.round(((story.animal.raised_pkr ?? 0) / story.animal.funding_goal_pkr) * 100))}% of care funded` : ""}
            </Link>
          ) : null}
        </div>
        <button type="button" className="story-nav story-prev" aria-label="Previous story" onClick={previous}><ChevronLeft size={22} /></button>
        <button type="button" className="story-nav story-next" aria-label="Next story" onClick={next}><ChevronRight size={22} /></button>
      </div>
    </div>,
    document.body,
  );
}

/** The row of story circles above the feed, one per category, and the full-screen viewer. */
function Stories({ groups, onAdd }: { groups: StoryGroup[]; onAdd?: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(new Set());

  if (!groups.length && !onAdd) return null;

  const isSeen = (group: StoryGroup) => group.stories.every((story) => story.seen || seen.has(story.id));

  return (
    <div className="stories" aria-label="Stories">
      {onAdd ? (
        <button type="button" className="story-bubble" onClick={onAdd}>
          <span className="story-ring is-add"><Plus size={22} /></span>
          <span className="story-label">Add story</span>
        </button>
      ) : null}
      {groups.map((group, index) => (
        <button key={group.category} type="button" className="story-bubble" onClick={() => setOpen(index)}>
          <span className={`story-ring${isSeen(group) ? " is-seen" : ""}`}>
            <img src={group.stories[0].image} alt="" />
          </span>
          <span className="story-label">{group.label}</span>
        </button>
      ))}
      {open !== null ? (
        <StoryViewer
          groups={groups}
          startGroup={open}
          onClose={() => setOpen(null)}
          onSeen={(id) => setSeen((current) => new Set(current).add(id))}
        />
      ) : null}
    </div>
  );
}

export default Stories;
