import { View, Text, TextInput, Button, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { loginUser } from '../../../services/authService';

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Google Auth Request
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: 'YOUR_GOOGLE_CLIENT_ID',   // replace this
  });

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
    </View>
  );
}