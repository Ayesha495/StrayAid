import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginWithGoogle, register } from "../services/authSevice";
import AuthLayout from "../components/AuthLayout";
import GoogleIcon from "../components/GoogleIcon";
import authImage from "../assets/Group2.jpg";

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    re_password: "",
  });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [formError, setFormError] = useState("");

  const getRegisterErrorMessage = (error: unknown) => {
    const responseData = (error as {
      response?: {
        data?: Record<string, string[] | string> & {
          detail?: string;
          non_field_errors?: string[];
        };
      };
    })?.response?.data;

    if (!responseData) {
      return "Registration failed. Please try again.";
    }

    if (responseData.detail) {
      return responseData.detail;
    }

    if (Array.isArray(responseData.non_field_errors) && responseData.non_field_errors.length) {
      return responseData.non_field_errors[0];
    }

    const firstFieldError = Object.entries(responseData).find(
      ([key, value]) => key !== "detail" && key !== "non_field_errors" && value
    )?.[1];

    if (Array.isArray(firstFieldError)) {
      return firstFieldError[0] || "Registration failed. Please check your input.";
    }

    if (typeof firstFieldError === "string") {
      return firstFieldError;
    }

    return "Registration failed. Please check your input.";
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError("");

    if (errors[name as keyof typeof form]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const nextErrors: Partial<typeof form> = {};

    if (!form.username.trim()) {
      nextErrors.username = "Username is required";
    }

    if (!form.email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      nextErrors.email = "Please enter a valid email address";
    }

    if (!form.password) {
      nextErrors.password = "Password is required";
    } else if (form.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters";
    }

    if (!form.re_password) {
      nextErrors.re_password = "Please confirm your password";
    } else if (form.password !== form.re_password) {
      nextErrors.re_password = "Passwords do not match";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleGoogleLogin = () => {
    loginWithGoogle()
      .then((data) => {
        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);
        navigate("/dashboard", { replace: true });
      })
      .catch((error) => {
        console.error(error);
        setFormError("Google login failed. Please try again.");
      });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }
    setFormError("");

    try {
      await register(form);
      navigate("/login", { replace: true });
    } catch (error: unknown) {
      console.error(error);
      setFormError(getRegisterErrorMessage(error));
    }
  };

  return (
    <AuthLayout
      image={authImage}
      headline="Join the mission."
      highlight="Rescue. Protect. Rehome."
      tagline="Follow rescue stories, support organizations, and be part of StrayAid."
    >
      <header>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Sign up to follow rescue stories, support organizations, and be part of StrayAid.</p>
      </header>

      {formError && <p className="alert" role="alert">{formError}</p>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field-label" htmlFor="username">Username</label>
          <input
            className="field-input"
            id="username"
            name="username"
            autoComplete="username"
            value={form.username}
            onChange={handleChange}
            placeholder="Choose a username"
            aria-invalid={Boolean(errors.username)}
          />
          {errors.username && <span className="field-error">{errors.username}</span>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="email">Email Address</label>
          <input
            className="field-input"
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter your email"
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">Password</label>
          <input
            className="field-input"
            id="password"
            type="password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            placeholder="Create a password"
            aria-invalid={Boolean(errors.password)}
          />
          {errors.password && <span className="field-error">{errors.password}</span>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="re_password">Confirm Password</label>
          <input
            className="field-input"
            id="re_password"
            type="password"
            name="re_password"
            autoComplete="new-password"
            value={form.re_password}
            onChange={handleChange}
            placeholder="Re-enter your password"
            aria-invalid={Boolean(errors.re_password)}
          />
          {errors.re_password && <span className="field-error">{errors.re_password}</span>}
        </div>

        <button type="submit" className="btn btn-primary btn-block">
          Register
        </button>

        <div className="divider">OR</div>

        <button type="button" className="btn btn-secondary btn-block" onClick={handleGoogleLogin}>
          <GoogleIcon />
          Continue with Google
        </button>
      </form>

      <p className="auth-footer">
        Already have an account? <Link className="link" to="/login">Login</Link>
      </p>
    </AuthLayout>
  );
}

export default Register;
