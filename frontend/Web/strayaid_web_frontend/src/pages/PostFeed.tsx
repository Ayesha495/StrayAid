import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bookmark, ImagePlus, Newspaper, PenSquare, Smartphone } from "lucide-react";
import { getFeed, getSavedPosts, getStories } from "../services/postService";
import { getOrganizationAnimals, getPublicAnimals } from "../services/platformService";
import { useApi } from "../hooks/useApi";
import { useShell } from "../layout/ShellContext";
import { useToast } from "../ui/Toast";
import Avatar from "../ui/Avatar";
import StatusChip from "../ui/StatusChip";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import PostCard from "../components/feed/PostCard";
import Stories from "../components/feed/Stories";
import { PostComposer, StoryComposer } from "../components/feed/Composers";
import { POST_CATEGORIES } from "../data/categories";
import { errorMessage } from "../utils/errors";
import type { Post } from "../types/platform";
import "./PostFeed.css";

const FILTERS = [{ value: "", label: "All" }, ...POST_CATEGORIES, { value: "saved", label: "Saved" }];

function PostFeed() {
  const toast = useToast();
  const { user, isOrganization, organization } = useShell();
  const [params] = useSearchParams();
  const focusPostId = Number(params.get("post")) || null;
  const [filter, setFilter] = useState("");
  const showingSaved = filter === "saved";
  const feed = useApi(() => (showingSaved ? getSavedPosts() : getFeed()), `${showingSaved}:${user?.id ?? "guest"}`);
  const stories = useApi(getStories, String(user?.id ?? "guest"));
  const adoptable = useApi(() => getPublicAnimals({ status: "adoptable" }));
  const myAnimals = useApi(() => (isOrganization ? getOrganizationAnimals() : Promise.resolve([])), String(isOrganization));
  const [composer, setComposer] = useState<"post" | "story" | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);

  const posts = useMemo(
    () => (feed.data ?? []).filter((post) => !filter || showingSaved || post.category === filter),
    [feed.data, filter, showingSaved],
  );

  // A shared link (?post=ID) scrolls to that post with its comments open.
  useEffect(() => {
    if (focusPostId && feed.data) document.getElementById(`post-${focusPostId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusPostId, feed.data]);

  const onPostSaved = (post: Post, created: boolean) => {
    feed.setData((current = []) => (created ? [post, ...current] : current.map((item) => (item.id === post.id ? { ...item, ...post } : item))));
    toast({ title: created ? "Posted to the community feed" : "Post updated" });
    setComposer(null);
    setEditing(null);
  };

  const filters = FILTERS.filter((item) => item.value !== "saved" || user);

  return (
    <div className="page feed-page">
      <div className="feed-main">
        <div className="feed-head">
          <div>
            <h1>Community</h1>
            <p className="muted">Updates from rescue teams about the animals in their care.</p>
          </div>
        </div>

        {stories.data ? (
          <Stories groups={stories.data} onAdd={isOrganization ? () => setComposer("story") : undefined} />
        ) : null}

        {isOrganization ? (
          <div className="card feed-compose">
            <Avatar name={organization?.name} src={organization?.image} size={40} square />
            <button type="button" className="feed-compose-input" onClick={() => setComposer("post")}>
              Share an update about one of your animals…
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setComposer("story")}><ImagePlus size={16} /> Story</button>
            <button type="button" className="btn btn-primary" onClick={() => setComposer("post")}><PenSquare size={16} /> Post</button>
          </div>
        ) : null}

        <div className="filter-row feed-filters" role="group" aria-label="Post type">
          {filters.map((item) => (
            <button key={item.value} type="button" className="filter-pill" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>
              {item.value === "saved" ? <Bookmark size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> : null}
              {item.label}
            </button>
          ))}
        </div>

        {feed.loading && !feed.data ? (
          <div className="stack">{[0, 1].map((key) => <Skeleton key={key} height={420} />)}</div>
        ) : feed.error && !feed.data ? (
          <ErrorState message={errorMessage(feed.error)} onRetry={feed.reload} />
        ) : posts.length ? (
          <div className="stack">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                initiallyOpen={post.id === focusPostId}
                onEdit={setEditing}
                onDeleted={(removed) => feed.setData((current = []) => current.filter((item) => item.id !== removed.id))}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={showingSaved ? <Bookmark size={22} /> : <Newspaper size={22} />}
            title={showingSaved ? "Nothing saved yet" : "No posts here yet"}
            message={showingSaved ? "Tap the bookmark on a post to keep it here." : "Rescue teams share medical updates, adoption news and more."}
          />
        )}
      </div>

      <aside className="feed-rail">
        {!user ? (
          <section className="card card-pad feed-cta">
            <h3>Spotted an injured animal?</h3>
            <p className="small muted">Report it in the StrayAid app. Nearby rescue teams are alerted straight away.</p>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <Link to="/register" className="btn btn-primary btn-sm">Join StrayAid</Link>
              <span className="small muted row"><Smartphone size={14} /> Reporting is in the app</span>
            </div>
          </section>
        ) : null}

        <section className="card">
          <div className="card-header">
            <h3>Ready for a home</h3>
            <Link to="/animals/browse?status=adoptable" className="link small">See all</Link>
          </div>
          {adoptable.data ? (
            adoptable.data.length ? (
              <ul className="feed-rail-list">
                {adoptable.data.slice(0, 4).map((animal) => (
                  <li key={animal.id}>
                    <Link to={`/animals/${animal.id}`} className="feed-rail-item">
                      <span className="feed-rail-photo">{animal.image ? <img src={animal.image} alt="" /> : null}</span>
                      <span className="feed-rail-text">
                        <span className="strong">{animal.name}</span>
                        <span className="small muted truncate">{[animal.species, animal.breed].filter(Boolean).join(" · ")}</span>
                      </span>
                      <StatusChip kind="animal" value={animal.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card-body small muted">No animals are up for adoption right now.</p>
            )
          ) : (
            <div className="card-body"><Skeleton height={160} /></div>
          )}
        </section>
      </aside>

      {composer === "post" || editing ? (
        <PostComposer animals={myAnimals.data ?? []} post={editing} onClose={() => { setComposer(null); setEditing(null); }} onSaved={onPostSaved} />
      ) : null}
      {composer === "story" ? (
        <StoryComposer
          animals={myAnimals.data ?? []}
          onClose={() => setComposer(null)}
          onSaved={() => {
            setComposer(null);
            stories.reload();
            toast({ title: "Story shared", body: "It stays at the top of the feed for 24 hours." });
          }}
        />
      ) : null}
    </div>
  );
}

export default PostFeed;
