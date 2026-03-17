import { useState } from "react";
import { login } from "../services/authSevice";

function Login() {
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");

    const handleGoogleLogin = () => {
        window.location.href = "http://localhost:8000/accounts/google/login/";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const data = await login({ email, password });

            localStorage.setItem("access", data.access);
            localStorage.setItem("refresh", data.refresh);

            alert("Login successful");
        } catch (error) {
            console.error(error);
            alert("Login failed");
        }

    };

    return (
        <form onSubmit={handleSubmit}>
            <input type="email"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)} 
            />

            <input type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            />

            <button type="submit">Login</button>

            <div>
                <button onClick={handleGoogleLogin}>
                    Login with Google
                </button>
            </div>
        </form>
    );
}

export default Login;