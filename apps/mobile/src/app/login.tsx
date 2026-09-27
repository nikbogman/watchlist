import { Image } from 'expo-image'
import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { authClient } from '@/auth-client'
import { colors, fonts } from '@/theme'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const passwordRef = useRef<TextInput>(null)

  async function logIn() {
    setPending(true)
    setError(undefined)
    // On success the session updates and the root layout's guard swaps in the tabs.
    const { error } = await authClient.signIn.email({ email: email.trim(), password })
    setPending(false)
    if (error) setError(error.status === 401 ? 'Wrong email or password.' : (error.message ?? "Couldn't log in."))
  }

  return (
    // Edge-to-edge Android no longer resizes the window for the keyboard, so pad on both platforms.
    <KeyboardAvoidingView style={styles.fill} behavior="padding">
      <Image source={require('../../assets/images/logo-halftone.png')} style={styles.logo} />
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Image
            source={require('../../assets/images/wordmark.png')}
            style={styles.wordmark}
            accessibilityRole="header"
            accessibilityLabel="popcorn"
          />
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
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
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
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  logo: { position: 'absolute', top: -135, right: -160, width: 560, height: 560 },
  screen: { flexGrow: 1, justifyContent: 'flex-end', gap: 40, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 56 },
  brand: { gap: 8 },
  wordmark: { width: 250, aspectRatio: 2721 / 536 },
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
