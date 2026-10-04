import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, loginWithGoogle, syncCurrentUser } from "../services/authSevice";
import AuthLayout from "../components/AuthLayout";
import GoogleIcon from "../components/GoogleIcon";
import authImage from "../assets/Group1.jpg";

function Login() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [errors, setErrors] = useState<Partial<typeof formData>>({});
    const [authError, setAuthError] = useState("");

    const getLoginErrorMessage = (error: unknown) => {
        const response = (error as {
            response?: {
                status?: number;
                data?: { detail?: string; non_field_errors?: string[] };
            };
        })?.response;

        const detail = response?.data?.detail || response?.data?.non_field_errors?.[0] || "";
        const normalizedDetail = String(detail).toLowerCase();

        if (response?.status === 401 || normalizedDetail.includes("no active account")) {
            return "The username/email or password is incorrect.";
        }

        return detail || "Login failed. Please try again.";
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        setAuthError("");

        if (errors[name as keyof typeof formData]) {
            setErrors((prev) => ({
                ...prev,
                [name]: "",
            }));
        }
    };

    const validateForm = () => {
        const newErrors: Partial<typeof formData> = {};

        if (!formData.email.trim()) {
            newErrors.email = "Email or username is required";
        }

        if (!formData.password) {
            newErrors.password = "Password is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleGoogleLogin = () => {
        loginWithGoogle()
            .then(async (data) => {
                await syncCurrentUser(data);
                navigate("/dashboard", { replace: true });
            })
            .catch((error) => {
                console.error(error);
                setAuthError(getLoginErrorMessage(error));
            });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }
        setAuthError("");

        try {
            const data = await login({
                email: formData.email,
                password: formData.password,
            });
            await syncCurrentUser(data);
            navigate("/dashboard", { replace: true });
        } catch (error) {
            console.error(error);
            setAuthError(getLoginErrorMessage(error));
        }

    };

    return (
        <AuthLayout
            image={authImage}
            headline="Every life matters."
            highlight="Make a difference."
            tagline="Track rescues, coordinate your team, and give every stray a second chance."
        >
            <header>
                <h1 className="auth-title">Welcome Back</h1>
                <p className="auth-subtitle">Login to manage and protect stray animals with StrayAid.</p>
            </header>

            {authError && <p className="alert" role="alert">{authError}</p>}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
                <div className="field">
                    <label className="field-label" htmlFor="email">Email or Username</label>
                    <input
                        className="field-input"
                        id="email"
                        type="text"
                        name="email"
                        autoComplete="username"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Enter your email or username"
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
                        autoComplete="current-password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Enter your password"
                        aria-invalid={Boolean(errors.password)}
                    />
                    {errors.password && <span className="field-error">{errors.password}</span>}
                </div>

                <div className="auth-form__aside">
                    <a className="link" href="/forgot-password">Forgot Password?</a>
                </div>

                <button type="submit" className="btn btn-primary btn-block">
                    Login
                </button>

                <div className="divider">OR</div>

                <button type="button" className="btn btn-secondary btn-block" onClick={handleGoogleLogin}>
                    <GoogleIcon />
                    Continue with Google
                </button>
            </form>

            <p className="auth-footer">
                Don't have an account? <Link className="link" to="/register">Sign up</Link>
            </p>
        </AuthLayout>
    );
}

export default Login;
