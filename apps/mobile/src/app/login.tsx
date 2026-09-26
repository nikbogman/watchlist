import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { authClient } from '@/auth-client'
import { colors, fonts } from '@/theme'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  async function logIn() {
    setPending(true)
    setError(undefined)
    // On success the session updates and the root layout's guard swaps in the tabs.
    const { error } = await authClient.signIn.email({ email: email.trim(), password })
    setPending(false)
    if (error) setError(error.status === 401 ? 'Wrong email or password.' : (error.message ?? "Couldn't log in."))
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.brand}>
        <Text style={styles.name}>Watcher</Text>
        <Text style={styles.tagline}>Your private movie log.</Text>
      </View>
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            accessibilityLabel="Email"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={logIn}
            accessibilityLabel="Password"
          />
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          style={[styles.button, pending && { opacity: 0.6 }]}
          onPress={logIn}
          disabled={pending || !email || !password}
          accessibilityRole="button">
          <Text style={styles.buttonText}>Log in</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', gap: 48, paddingHorizontal: 28, backgroundColor: colors.background },
  brand: { gap: 8 },
  name: { fontFamily: fonts.title, fontSize: 48, letterSpacing: -0.5, color: colors.text },
  tagline: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  input: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.accent },
  button: { height: 52, marginTop: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.background },
})
