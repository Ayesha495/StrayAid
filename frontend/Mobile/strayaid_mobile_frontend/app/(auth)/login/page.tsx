import { View, Text, TextInput, Button, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { loginUser } from '../../../services/authService';
import { router } from "expo-router";
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
  clientId: "998658289609-9afrhr6aesljjbf2o9kdbc10k6vlq1ac.apps.googleusercontent.com",
});

useEffect(() => {
  if (response?.type === "success") {
    const idToken = response.params.id_token;

    console.log("Google ID Token:", idToken);

    // send token to Django backend here
  }
}, [response]);

<Button
  title="Login with Google"
  disabled={!request}
  onPress={() => promptAsync()}
/>

  const handleLogin = async () => {
    try {
      await loginUser({ email, password });
      Alert.alert('Success', 'Logged in!');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // Handle Google response
  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token;

      // Send token to your Django backend
      console.log("Google ID Token:", idToken);

      // Example:
      // fetch("http://YOUR_BACKEND/auth/google/", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ token: idToken })
      // })
    }
  }, [response]);

  return (
  <KeyboardAvoidingView style={{ flex: 1}}
  behavior={Platform.OS === "ios" ? "padding" : "height" }>
    <View>
      <Text>Login</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button title="Login" onPress={handleLogin} />

      <Button
        title="Login with Google"
        disabled={!request}
        onPress={() => promptAsync()}
      />
      <Text>New to StrayAid? </Text>
      <Button
  title="Create an account"
  onPress={() => router.push("/(auth)/register/page")}
/>
    </View>
    </KeyboardAvoidingView>
  );
}