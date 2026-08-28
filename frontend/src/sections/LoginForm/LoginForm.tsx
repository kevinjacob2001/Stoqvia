import "./LoginForm.css";
import { Button } from "../../components/ui/index.ts";

type LoginFormProps = {
  error: string | null;
  submitting: boolean;
  onSubmit: (username: string, password: string) => void;
};

export default function LoginForm({ error, submitting, onSubmit }: LoginFormProps) {
  return (
    <form
      className="login-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit(String(data.get("username") ?? ""), String(data.get("password") ?? ""));
      }}
    >
      <div className="login-form__intro">
        <h2>Store admin login</h2>
        <p>Use your store credentials to manage transfers.</p>
      </div>

      <label className="login-field">
        <span>Username</span>
        <input name="username" autoComplete="username" required placeholder="e.g. admin.cbd" />
      </label>
      <label className="login-field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
      </label>

      {error ? (
        <p className="login-error" role="alert">
          {error}
        </p>
      ) : null}

      <Button className="login-submit" variant="primary" disabled={submitting} type="submit">
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
