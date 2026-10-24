import { useState } from "react";
import { ImagePlus } from "lucide-react";
import Modal from "../../ui/Modal";
import { createPost, createStory, updatePost } from "../../services/postService";
import { POST_CATEGORIES, STORY_CATEGORIES } from "../../data/categories";
import { errorMessage } from "../../utils/errors";
import type { Animal, Post } from "../../types/platform";
import type { Story } from "../../types/api";

function ImageField({ preview, onPick, required = false, hint }: { preview: string | null; onPick: (file: File | null) => void; required?: boolean; hint?: string }) {
  return (
    <div className="animal-photo-field">
      <div className="animal-photo-preview">{preview ? <img src={preview} alt="" /> : <ImagePlus size={24} />}</div>
      <label className="field" style={{ flex: 1 }}>
        <span className="field-label">Photo{required ? "" : " (optional)"}</span>
        <input className="input" type="file" accept="image/*" onChange={(event) => onPick(event.target.files?.[0] ?? null)} />
        {hint ? <span className="field-hint">{hint}</span> : null}
      </label>
    </div>
  );
}

function useImage(initial: string | null = null) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial);
  const pick = (next: File | null) => {
    setFile(next);
    if (next) setPreview(URL.createObjectURL(next));
  };
  return { file, preview, pick };
}

/** Create or edit a feed post about one of the organization's animals. */
export function PostComposer({ animals, post, onClose, onSaved }: { animals: Animal[]; post?: Post | null; onClose: () => void; onSaved: (post: Post, created: boolean) => void }) {
  const editing = Boolean(post);
  const [animal, setAnimal] = useState(String(post?.animal?.id ?? animals[0]?.id ?? ""));
  const [category, setCategory] = useState<string>(post?.category || "medical");
  const [title, setTitle] = useState(post?.title ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const image = useImage(post?.image ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const data = new FormData();
    if (!editing) data.append("animal", animal);
    data.append("category", category);
    data.append("title", title.trim());
    data.append("content", content.trim());
    if (image.file) data.append("image", image.file);
    setSaving(true);
    try {
      const saved = editing && post ? await updatePost(post.id, data) : await createPost(data);
      onSaved(saved, !editing);
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? "Edit post" : "New post"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="post-form" className="btn btn-primary" disabled={saving || (!editing && !animal)}>
            {saving ? "Posting…" : editing ? "Save" : "Post"}
          </button>
        </>
      }
    >
      <form id="post-form" className="stack" onSubmit={submit}>
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        {!editing ? (
          <label className="field">
            <span className="field-label">About</span>
            {animals.length ? (
              <select className="select" value={animal} onChange={(event) => setAnimal(event.target.value)}>
                {animals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            ) : (
              <span className="alert alert-info">Posts are about your animals. Create an animal profile first.</span>
            )}
          </label>
        ) : null}
        <div className="filter-row" role="radiogroup" aria-label="Category">
          {POST_CATEGORIES.map((item) => (
            <button key={item.value} type="button" role="radio" aria-checked={category === item.value} className="filter-pill" onClick={() => setCategory(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="field-label">Headline</span>
          <input className="input" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Sunny is eating on her own again" />
        </label>
        <label className="field">
          <span className="field-label">Update</span>
          <textarea className="textarea" required value={content} onChange={(event) => setContent(event.target.value)} placeholder="What's new? How can people help?" />
        </label>
        <ImageField preview={image.preview} onPick={image.pick} />
      </form>
    </Modal>
  );
}

/** Share a 24-hour story. */
export function StoryComposer({ animals, onClose, onSaved }: { animals: Animal[]; onClose: () => void; onSaved: (story: Story) => void }) {
  const [category, setCategory] = useState("rescue_update");
  const [animal, setAnimal] = useState("");
  const [headline, setHeadline] = useState("");
  const [caption, setCaption] = useState("");
  const image = useImage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!image.file) {
      setError("Add a photo for the story.");
      return;
    }
    const data = new FormData();
    data.append("category", category);
    data.append("headline", headline.trim());
    data.append("caption", caption.trim());
    data.append("image", image.file);
    if (animal) data.append("animal_id", animal);
    setSaving(true);
    try {
      onSaved(await createStory(data));
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="New story"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="story-form" className="btn btn-primary" disabled={saving}>{saving ? "Sharing…" : "Share story"}</button>
        </>
      }
    >
      <form id="story-form" className="stack" onSubmit={submit}>
        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        <p className="small muted">Stories show at the top of the feed for 24 hours.</p>
        <ImageField preview={image.preview} onPick={image.pick} required hint="A tall photo works best." />
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Category</span>
            <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
              {STORY_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">About an animal (optional)</span>
            <select className="select" value={animal} onChange={(event) => setAnimal(event.target.value)}>
              <option value="">No specific animal</option>
              {animals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field-label">Headline</span>
          <input className="input" maxLength={160} value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="e.g. Day 3: Luna is purring again" />
        </label>
        <label className="field">
          <span className="field-label">Caption</span>
          <textarea className="textarea" rows={3} maxLength={280} value={caption} onChange={(event) => setCaption(event.target.value)} />
        </label>
      </form>
    </Modal>
  );
}
