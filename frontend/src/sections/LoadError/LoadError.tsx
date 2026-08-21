import { Button } from "../../components/ui/index.ts";

type LoadErrorProps = {
  message: string;
  onRetry: () => void;
};

export default function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <div className="panel">
      <p className="error">API error: {message}. Start the backend on port 8000.</p>
      <Button variant="primary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
