type LoadErrorProps = {
  message: string;
  onRetry: () => void;
};

export default function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <div className="panel">
      <p className="error">API error: {message}. Start the backend on port 8000.</p>
      <button className="retry-button" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
