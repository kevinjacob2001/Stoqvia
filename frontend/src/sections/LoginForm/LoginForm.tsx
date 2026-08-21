import "./LoginForm.css";
type LoginFormProps = {
  error: string | null;
  submitting: boolean;
  onSubmit: (username: string, password: string) => void;
};

export default function LoginForm({ error, submitting, onSubmit }: LoginFormProps) {
  return (
    <form
      className="panel login-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit(String(data.get("username") ?? ""), String(data.get("password") ?? ""));
      }}
    >
      <h2>Store admin login</h2>
      <label>
        Username
        <input name="username" autoComplete="username" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="retry-button" disabled={submitting} type="submit">
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
