import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { register } from '../services/authService';

export default function RegisterScreen({ navigation }) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!displayName.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert(t('authError'), t('fillAllFields'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('authError'), t('passwordMismatch'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('authError'), t('passwordTooShort'));
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, displayName.trim());
    } catch (e) {
      const codeMap = {
        'auth/email-already-in-use': t('emailInUse'),
        'auth/invalid-email': t('invalidEmail'),
        'auth/weak-password': t('passwordTooShort'),
        'auth/network-request-failed': t('networkError'),
        'auth/operation-not-allowed': 'Email/Password auth is disabled in Firebase Console',
      };
      const msg = codeMap[e.code] || `${t('registerFailed')}\n(${e.code || e.message})`;
      Alert.alert(t('authError'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>🌱</Text>
          <Text style={styles.appName}>GardenMap</Text>
          <Text style={styles.subtitle}>{t('createAccount')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>👤</Text>
            <TextInput
              style={styles.input}
              placeholder={t('displayName')}
              placeholderTextColor="#aaa"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.input}
              placeholder={t('email')}
              placeholderTextColor="#aaa"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder={t('password')}
              placeholderTextColor="#aaa"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.inputIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder={t('confirmPassword')}
              placeholderTextColor="#aaa"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>{t('register')}</Text>
            }
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('haveAccount')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.switchLink}>{t('login')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f7f4' },
  scroll: { flexGrow: 1 },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 32 },
  logo: { fontSize: 56 },
  appName: { fontSize: 30, fontWeight: '800', color: '#1a3c2d', marginTop: 8 },
  subtitle: { fontSize: 16, color: '#555', marginTop: 6 },
  form: { paddingHorizontal: 28, gap: 14, paddingBottom: 40 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#d4e8dd',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  inputIcon: { fontSize: 18, marginRight: 8 },
  input: { flex: 1, height: 52, fontSize: 16, color: '#1a3c2d' },
  primaryBtn: {
    backgroundColor: '#2d6a4f', borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: '#2d6a4f', shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  switchText: { color: '#666', fontSize: 15 },
  switchLink: { color: '#2d6a4f', fontSize: 15, fontWeight: '700' },
});
