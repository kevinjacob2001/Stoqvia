type LoadingStateProps = {
  message: string;
};

export default function LoadingState({ message }: LoadingStateProps) {
  return <p className="status">{message}</p>;
}
