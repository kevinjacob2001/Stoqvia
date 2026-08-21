type TabItem<T extends string> = {
  key: T;
  label: string;
};

type TabsProps<T extends string> = {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  tabClassName?: string;
};

export default function Tabs<T extends string>({
  items,
  value,
  onChange,
  className = "product-tabs",
  tabClassName = "product-tab",
}: TabsProps<T>) {
  return (
    <div className={className}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={[tabClassName, value === item.key ? "active" : ""].filter(Boolean).join(" ")}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
