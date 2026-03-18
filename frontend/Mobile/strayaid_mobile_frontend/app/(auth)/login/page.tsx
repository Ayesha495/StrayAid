import { View, Text, TextInput, Button, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { loginUser } from '../../../services/authService';
import { router } from "expo-router";
import { useGoogleAuth } from '../../../services/googleAuthService';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { request, promptAsync } = useGoogleAuth(); // 👈 changed from { signIn }

  const handleLogin = async () => {
    try {
      await loginUser({ email, password });
      Alert.alert('Success', 'Logged in!');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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
          disabled={!request} // 👈 disable until request is ready
          onPress={() => promptAsync()} // 👈 changed from signIn
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