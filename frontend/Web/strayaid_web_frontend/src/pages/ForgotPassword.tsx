import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { authErrorMessage, confirmPasswordReset, requestPasswordReset } from "../services/authSevice";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordInput from "../components/auth/PasswordInput";

type Step = "email" | "code" | "done";

/** Reset a password with a 6-digit emailed code (the same flow as the mobile app). */
function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Enter the email address you signed up with.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setMessage(await requestPasswordReset(email.trim()));
      setStep("code");
    } catch (err) {
      setError(authErrorMessage(err, "Couldn't send a code. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("The code is the 6 digits from the email.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setMessage(await confirmPasswordReset({ email: email.trim(), code, new_password: password }));
      setStep("done");
    } catch (err) {
      setError(authErrorMessage(err, "Couldn't reset your password. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Step, [string, string]> = {
    email: ["Forgot your password?", "Enter your email and we'll send you a 6-digit code."],
    code: ["Check your email", `Enter the code we sent to ${email} and choose a new password.`],
    done: ["Password updated", "You can log in with your new password now."],
  };

  return (
    <AuthLayout title={titles[step][0]} subtitle={titles[step][1]} image="/landing/street-cat.webp">
      <div className="auth-steps" aria-hidden="true">
        <span className="is-done" />
        <span className={step !== "email" ? "is-done" : ""} />
        <span className={step === "done" ? "is-done" : ""} />
      </div>

      {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
      {message && step !== "email" ? <p className="alert alert-success" role="status">{message}</p> : null}

      {step === "email" ? (
        <form className="auth-form" onSubmit={sendCode} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="reset-email">Email</label>
            <input id="reset-email" className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={busy}>{busy ? "Sending…" : "Send code"}</button>
        </form>
      ) : null}

      {step === "code" ? (
        <form className="auth-form" onSubmit={reset} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="reset-code">6-digit code</label>
            <input
              id="reset-code"
              className="input code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="reset-password">New password</label>
            <PasswordInput id="reset-password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={busy}>{busy ? "Saving…" : "Reset password"}</button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => sendCode()} disabled={busy}>Send a new code</button>
        </form>
      ) : null}

      {step === "done" ? <Link to="/login" className="btn btn-primary btn-block auth-submit">Log in</Link> : null}

      <p className="auth-foot"><Link to="/login">Back to log in</Link></p>
    </AuthLayout>
  );
}

export default ForgotPassword;
