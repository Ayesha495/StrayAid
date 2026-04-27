import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginWithGoogle, register } from "../services/authSevice";
import "../styles/Register.css";

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
    <div className="register-container">
      <div className="register-left-image">
        <div className="image-overlay">
          <div className="inspirational-text">
            Join the mission.<br />Help rescue, protect, and rehome stray animals.
          </div>
        </div>
      </div>

      <div className="right-container">
        <div className="register-card">
          <div className="register-header">
            <h2>Create Account</h2>
            <p>Sign up to follow rescue stories, support organizations, and be part of StrayAid.</p>
          </div>
          {formError && <p className="auth-error">{formError}</p>}

          <form className="register-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Choose a username"
              />
              {errors.username && <span>{errors.username}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Enter your email"
              />
              {errors.email && <span>{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Create a password"
              />
              {errors.password && <span>{errors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="re_password">Confirm Password</label>
              <input
                id="re_password"
                type="password"
                name="re_password"
                value={form.re_password}
                onChange={handleChange}
                placeholder="Re-enter your password"
              />
              {errors.re_password && <span>{errors.re_password}</span>}
            </div>

            <button type="submit" className="register-btn">
              Register
            </button>

            <div className="or-divider">
              <span>OR</span>
            </div>

            <button type="button" className="google-btn" onClick={handleGoogleLogin}>
              <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </form>

          <div className="register-footer">
            Already have an account? <Link to="/login">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
