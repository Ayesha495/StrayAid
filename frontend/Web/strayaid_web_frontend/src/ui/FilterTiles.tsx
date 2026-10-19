import type { ReactNode } from "react";

export type FilterTile<K extends string> = {
  key: K;
  label: string;
  hint?: string;
  count: number | string;
  icon: ReactNode;
  tint: "blue" | "amber" | "green" | "coral" | "purple";
};

/**
 * Tinted count tiles that double as filters, like the dashboard's stat cards: one glance
 * shows where things stand, one click narrows the list. Each colour keeps one meaning.
 */
function FilterTiles<K extends string>({ tiles, value, onChange, label }: { tiles: FilterTile<K>[]; value: K; onChange: (key: K) => void; label: string }) {
  return (
    <div className="filter-tiles" role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          className={`filter-tile tint-${tile.tint}`}
          aria-pressed={value === tile.key}
          onClick={() => onChange(tile.key)}
        >
          <span className="filter-tile-icon" aria-hidden="true">{tile.icon}</span>
          <span className="filter-tile-count">{tile.count}</span>
          <span className="filter-tile-label">
            {tile.label}
            {tile.hint ? <span>{tile.hint}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

export default FilterTiles;
