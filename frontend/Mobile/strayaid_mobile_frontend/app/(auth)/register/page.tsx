import { View, Text, TextInput, Button, Alert } from 'react-native';
import { useState } from 'react';
import { registerUser } from '../../../services/authService';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rePassword, setRePassword] = useState('');

  const handleRegister = async () => {
    try {
      const result = await registerUser({
        username,
        email,
        password,
        re_password: rePassword,
      });
      if (result.id) {
        Alert.alert('Success', 'Account created!');
      } else {
        Alert.alert('Error', JSON.stringify(result));
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View>
      <Text>Register</Text>
    <TextInput placeholder="Username" value={username} onChangeText={setUsername} />
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput placeholder="Confirm Password" value={rePassword} onChangeText={setRePassword} secureTextEntry />
      <Button title="Register" onPress={handleRegister} />
    </View>
  );
}