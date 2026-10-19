import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Heart } from "lucide-react";
import { authErrorMessage, login, register, signInWithGoogle, syncCurrentUser } from "../services/authSevice";
import AuthLayout from "../components/auth/AuthLayout";
import GoogleButton from "../components/auth/GoogleButton";
import PasswordInput from "../components/auth/PasswordInput";

type Role = "person" | "organization";

const registerErrorMessage = (error: unknown) => {
  const data = (error as { response?: { data?: Record<string, string[] | string> } })?.response?.data;
  if (!data) return authErrorMessage(error, "Sign-up failed. Please try again.");
  const first = data.detail || data.non_field_errors || Object.values(data).find(Boolean);
  return (Array.isArray(first) ? first[0] : first) || "Sign-up failed. Please check your details.";
};

function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role>(params.get("as") === "organization" ? "organization" : "person");
  const [form, setForm] = useState({ email: "", username: "", password: "", re_password: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (name: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setFormError("");
  };

  // A rescue team continues straight into the organization form; people go to the feed.
  const next = () => navigate(role === "organization" ? "/organization/register" : "/feed", { replace: true });

  const handleGoogle = async () => {
    setFormError("");
    try {
      const user = await signInWithGoogle();
      if (user.role === "organization") navigate("/dashboard", { replace: true });
      else next();
    } catch (error) {
      setFormError(authErrorMessage(error, "Google sign-up failed. Please try again."));
    }
  };

  const validate = () => {
    const nextErrors: Partial<typeof form> = {};
    if (!form.username.trim()) nextErrors.username = "Choose a username.";
    if (!form.email.trim()) nextErrors.email = "Enter your email address.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) nextErrors.email = "That doesn't look like an email address.";
    if (form.password.length < 8) nextErrors.password = "Use at least 8 characters.";
    if (form.password !== form.re_password) nextErrors.re_password = "The passwords don't match.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register({ ...form, email: form.email.trim(), username: form.username.trim() });
      // Sign straight in, so nobody has to type the same details twice.
      const session = await login({ email: form.email.trim(), password: form.password });
      await syncCurrentUser(session);
      next();
    } catch (error) {
      setFormError(registerErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const field = (name: keyof typeof form, label: string, input: React.ReactNode) => (
    <div className="field">
      <label className="field-label" htmlFor={name}>{label}</label>
      {input}
      {errors[name] ? <span id={`${name}-error`} className="field-error">{errors[name]}</span> : null}
    </div>
  );

  const aria = (name: keyof typeof form) => ({
    id: name,
    value: form[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => update(name, event.target.value),
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <AuthLayout
      mode="register"
      title="Join StrayAid"
      subtitle="Free for everyone. Follow rescues, adopt, sponsor, or bring your rescue team on board."
      image="/landing/home.webp"
      quote={<><strong>One photo can start a rescue.</strong>Reports reach the nearest team with space, ranked by urgency.</>}
    >
      {formError ? <p className="alert alert-error" role="alert">{formError}</p> : null}

      <fieldset className="auth-roles">
        <legend>I'm joining as</legend>
        <label className="auth-role is-person">
          <input type="radio" name="role" value="person" checked={role === "person"} onChange={() => setRole("person")} />
          <strong><Heart size={16} aria-hidden="true" /> A person</strong>
          <span>Follow, adopt, sponsor</span>
        </label>
        <label className="auth-role is-org">
          <input type="radio" name="role" value="organization" checked={role === "organization"} onChange={() => setRole("organization")} />
          <strong><Building2 size={16} aria-hidden="true" /> A rescue team</strong>
          <span>Shelter, rescue or vet</span>
        </label>
      </fieldset>

      <GoogleButton onClick={handleGoogle} label="Sign up with Google" />
      <div className="auth-divider">or with your email</div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {field("username", "Username", <input className="input" autoComplete="username" {...aria("username")} />)}
        {field("email", "Email", <input className="input" type="email" autoComplete="email" {...aria("email")} />)}
        {field("password", "Password", <PasswordInput autoComplete="new-password" {...aria("password")} />)}
        {field("re_password", "Confirm password", <PasswordInput autoComplete="new-password" {...aria("re_password")} />)}

        <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={submitting}>
          {submitting ? "Creating your account…" : role === "organization" ? "Continue to team details" : "Create account"}
        </button>
      </form>

      <p className="auth-foot">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthLayout>
  );
}

export default Register;
