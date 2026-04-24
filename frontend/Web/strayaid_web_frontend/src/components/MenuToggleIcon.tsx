type MenuToggleIconProps = {
  isOpen: boolean;
};

function MenuToggleIcon({ isOpen }: MenuToggleIconProps) {
  if (isOpen) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="menu-toggle-icon">
        <path
          d="M6 6L18 18M18 6L6 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="menu-toggle-icon">
      <path
        d="M4 7H20M4 12H20M4 17H20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default MenuToggleIcon;
