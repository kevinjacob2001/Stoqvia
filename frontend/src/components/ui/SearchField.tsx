type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function SearchField({
  value,
  onChange,
  placeholder = "Search…",
}: SearchFieldProps) {
  return (
    <label className="search-field">
      <span className="search-icon" aria-hidden="true">
        ⌕
      </span>
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
