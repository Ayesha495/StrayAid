import { useState } from "react";
import { loginWithGoogle, register } from "../services/authSevice";

function Register() {
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    re_password: "",
  });

  const handleGoogleLogin = () => {
      loginWithGoogle()
        .then((data) => {
          localStorage.setItem("access", data.access);
          localStorage.setItem("refresh", data.refresh);
          alert("Google login successful");
        })
        .catch((error) => {
          console.error(error);
          alert("Google login failed");
        });
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await register(form);
      alert("User created");
    } catch (error: any) {
      console.error(error.response?.data);
      alert(JSON.stringify(error.response?.data));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        placeholder="Username"
        onChange={(e) =>
          setForm({ ...form, username: e.target.value })
        }
      />

      <input
        placeholder="Email"
        onChange={(e) =>
          setForm({ ...form, email: e.target.value })
        }
      />

      <input
        type="password"
        placeholder="Password"
        onChange={(e) =>
          setForm({ ...form, password: e.target.value })
        }
      />

      <input
        type="password"
        placeholder="Confirm Password"
        onChange={(e) =>
          setForm({ ...form, re_password: e.target.value })
        }
      />

      <button type="submit">Register</button>

      <div>
        <button type="button" onClick={handleGoogleLogin}>
            Login with Google
        </button>
      </div>
    </form>
  );
}

export default Register;
