import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function App() {
  const [status, setStatus] = useState('Checking API…');

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((body: { status: string; db: string }) => setStatus(`API ${body.status} · DB ${body.db}`))
      .catch(() => setStatus('API unreachable'));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>INSIDE THE GAME</Text>
      <Text style={styles.status}>{status}</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3A0648',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  status: { color: '#82BA03', fontSize: 16 },
});
