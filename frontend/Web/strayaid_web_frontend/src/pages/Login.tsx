import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authErrorMessage, login, resolvePostLoginRoute, signInWithGoogle, syncCurrentUser } from "../services/authSevice";
import AuthLayout from "../components/auth/AuthLayout";
import GoogleButton from "../components/auth/GoogleButton";
import PasswordInput from "../components/auth/PasswordInput";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (name: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setAuthError("");
  };

  // Organizations land on their dashboard, everyone else on the feed, or back where they were.
  const goHome = (user: Awaited<ReturnType<typeof syncCurrentUser>>) => {
    navigate(resolvePostLoginRoute(user, from), { replace: true });
  };

  const handleGoogle = async () => {
    setAuthError("");
    try {
      goHome(await signInWithGoogle());
    } catch (error) {
      setAuthError(authErrorMessage(error, "Google sign-in failed. Please try again."));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Partial<typeof form> = {};
    if (!form.email.trim()) nextErrors.email = "Enter your email or username.";
    if (!form.password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setAuthError("");
    try {
      const session = await login({ email: form.email.trim(), password: form.password });
      goHome(await syncCurrentUser(session));
    } catch (error) {
      setAuthError(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      mode="login"
      title="Welcome back"
      subtitle="Log in to follow rescues, message rescue teams and manage your work."
      quote={<><strong>Welcome home.</strong>Every rescue on StrayAid started with someone who stopped to help.</>}
    >
      {authError ? <p className="alert alert-error" role="alert">{authError}</p> : null}

      <GoogleButton onClick={handleGoogle} />
      <div className="auth-divider">or with your email</div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="email">Email or username</label>
          <input
            id="email"
            className="input"
            autoComplete="username"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email ? <span id="email-error" className="field-error">{errors.email}</span> : null}
        </div>

        <div className="field">
          <div className="auth-row">
            <label className="field-label" htmlFor="password">Password</label>
            <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => update("password", event.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          {errors.password ? <span id="password-error" className="field-error">{errors.password}</span> : null}
        </div>

        <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="auth-foot">New to StrayAid? <Link to="/register">Create a free account</Link></p>
    </AuthLayout>
  );
}

export default Login;
