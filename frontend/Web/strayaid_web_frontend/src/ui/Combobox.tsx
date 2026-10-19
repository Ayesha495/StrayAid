import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import "./Combobox.css";

type ComboboxProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  /** Just the input and its suggestions, for forms that bring their own label and input style. */
  bare?: boolean;
};

const MAX_SHOWN = 60;

/**
 * A text field with a searchable dropdown of suggestions (e.g. breeds). Typing filters the
 * list; anything typed is still allowed, so unusual breeds can be entered.
 */
function Combobox({ label, value, options, onChange, placeholder, hint, bare = false }: ComboboxProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const needle = value.trim().toLowerCase();
    const filtered = needle ? options.filter((option) => option.toLowerCase().includes(needle)) : options;
    return filtered.slice(0, MAX_SHOWN);
  }, [options, value]);

  const choose = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!options.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => Math.min(current + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && open && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && options.length > 0 && matches.length > 0;

  const input = (
    <input
      id={id}
      className={bare ? undefined : "input"}
      aria-label={bare ? label : undefined}
      role="combobox"
      aria-expanded={showList}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={showList ? `${listId}-${active}` : undefined}
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      onChange={(event) => {
        onChange(event.target.value);
        setOpen(true);
        setActive(0);
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={onKeyDown}
    />
  );

  const list = showList ? (
    <ul className="combobox-list" id={listId} role="listbox" aria-label={label}>
      {matches.map((option, index) => (
        <li
          key={option}
          id={`${listId}-${index}`}
          role="option"
          aria-selected={index === active}
          className={option === value ? "is-chosen" : undefined}
          onMouseDown={(event) => {
            event.preventDefault();
            choose(option);
          }}
          onMouseEnter={() => setActive(index)}
        >
          {option}
        </li>
      ))}
    </ul>
      ) : null;

  if (bare) {
    return (
      <span className="combobox combobox-bare">
        {input}
        {list}
      </span>
    );
  }

  return (
    <div className="field combobox">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="combobox-control">
        {input}
        {options.length ? <ChevronDown size={16} className="combobox-chevron" aria-hidden="true" /> : null}
      </div>
      {list}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export default Combobox;
