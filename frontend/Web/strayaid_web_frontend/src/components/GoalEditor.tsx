import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

/** Lets the animal's organization set or change the care funding goal in place. */
function GoalEditor({ goal, onSave }: { goal: number; onSave: (value: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(goal || ""));
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Opening the editor moves the cursor into it, for keyboard and screen reader users alike.
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <button type="button" className="btn btn-ghost btn-sm goal-edit" onClick={() => setEditing(true)}>
        <Pencil size={14} aria-hidden="true" /> {goal ? "Edit care goal" : "Set a care goal"}
      </button>
    );
  }
  return (
    <form
      className="goal-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSave(Math.max(0, Number(value) || 0));
          setEditing(false);
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="sr-only" htmlFor="goal-input">Care funding goal in rupees</label>
      <input id="goal-input" className="input" type="number" min={0} step={500} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Rs" ref={input} />
      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>Save</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}

export default GoalEditor;
