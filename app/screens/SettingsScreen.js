import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { logout, changeDisplayName, changePassword } from '../services/authService';

function Avatar({ name }) {
  const initials = (name || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      {title && <Text style={styles.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

function RowItem({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, danger && styles.dangerText]}>{label}</Text>
      <Text style={styles.rowArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const user = useAuth();

  const [nameModal, setNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameLoading, setNameLoading] = useState(false);

  const [passModal, setPassModal] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  const handleChangeName = async () => {
    if (!newName.trim()) return;
    setNameLoading(true);
    try {
      await changeDisplayName(newName.trim());
      setNameModal(false);
      setNewName('');
      Alert.alert('✓', t('nameSaved'));
    } catch (e) {
      Alert.alert(t('authError'), e.message);
    } finally {
      setNameLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPass || !newPass || !confirmPass) {
      Alert.alert(t('authError'), t('fillAllFields'));
      return;
    }
    if (newPass !== confirmPass) {
      Alert.alert(t('authError'), t('passwordMismatch'));
      return;
    }
    if (newPass.length < 6) {
      Alert.alert(t('authError'), t('passwordTooShort'));
      return;
    }
    setPassLoading(true);
    try {
      await changePassword(currentPass, newPass);
      setPassModal(false);
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      Alert.alert('✓', t('passwordSaved'));
    } catch (e) {
      const msg = e.code === 'auth/wrong-password' ? t('wrongPassword') : e.message;
      Alert.alert(t('authError'), msg);
    } finally {
      setPassLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('logout'), t('logoutConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileSection}>
        <Avatar name={user?.displayName} />
        <Text style={styles.profileName}>{user?.displayName || '—'}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
      </View>

      {/* Profile settings */}
      <SectionCard title={t('profileSettings')}>
        <RowItem icon="✏️" label={t('changeName')} onPress={() => { setNewName(user?.displayName || ''); setNameModal(true); }} />
        <View style={styles.divider} />
        <RowItem icon="🔒" label={t('changePassword')} onPress={() => setPassModal(true)} />
      </SectionCard>

      {/* App settings */}
      <SectionCard title={t('appSettings')}>
        <Text style={styles.rowLabel2}>{t('language')}</Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langBtn, i18n.language === 'uk' && styles.langBtnActive]}
            onPress={() => i18n.changeLanguage('uk')}
          >
            <Text style={[styles.langBtnText, i18n.language === 'uk' && styles.langBtnTextActive]}>
              🇺🇦 {t('ukrainian')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, i18n.language === 'en' && styles.langBtnActive]}
            onPress={() => i18n.changeLanguage('en')}
          >
            <Text style={[styles.langBtnText, i18n.language === 'en' && styles.langBtnTextActive]}>
              🇬🇧 {t('english')}
            </Text>
          </TouchableOpacity>
        </View>
      </SectionCard>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 {t('logout')}</Text>
      </TouchableOpacity>

      {/* Change Name Modal */}
      <Modal visible={nameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('changeName')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('displayName')}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setNameModal(false)}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, nameLoading && { opacity: 0.6 }]}
                onPress={handleChangeName}
                disabled={nameLoading}
              >
                {nameLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalSaveText}>{t('save')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={passModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('changePassword')}</Text>
            <TextInput
              style={styles.modalInput}
              value={currentPass}
              onChangeText={setCurrentPass}
              placeholder={t('currentPassword')}
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              value={newPass}
              onChangeText={setNewPass}
              placeholder={t('newPassword')}
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              value={confirmPass}
              onChangeText={setConfirmPass}
              placeholder={t('confirmPassword')}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setPassModal(false); setCurrentPass(''); setNewPass(''); setConfirmPass(''); }}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, passLoading && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={passLoading}
              >
                {passLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalSaveText}>{t('save')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7f4' },
  content: { paddingBottom: 40 },

  profileSection: {
    alignItems: 'center', paddingVertical: 32,
    backgroundColor: '#2d6a4f',
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    marginBottom: 20,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#52b788', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  profileEmail: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, marginBottom: 14,
    paddingVertical: 6, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase',
    letterSpacing: 0.8, paddingTop: 12, paddingBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowIcon: { fontSize: 20, marginRight: 14 },
  rowLabel: { flex: 1, fontSize: 16, color: '#1a3c2d', fontWeight: '500' },
  rowLabel2: { fontSize: 15, color: '#555', paddingTop: 12, marginBottom: 10 },
  rowArrow: { fontSize: 22, color: '#bbb', fontWeight: '300' },
  dangerText: { color: '#e63946' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginLeft: 36 },

  langRow: { flexDirection: 'row', gap: 10, paddingBottom: 14 },
  langBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#f0f7f4', borderWidth: 1, borderColor: '#d4e8dd',
  },
  langBtnActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  langBtnText: { fontSize: 14, fontWeight: '600', color: '#555' },
  langBtnTextActive: { color: '#fff' },

  logoutBtn: {
    marginHorizontal: 16, marginTop: 4, paddingVertical: 16, borderRadius: 16,
    backgroundColor: '#fff', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ffcdd2',
    shadowColor: '#e63946', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#e63946' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    width: '85%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a3c2d', marginBottom: 16 },
  modalInput: {
    borderWidth: 1, borderColor: '#d4e8dd', borderRadius: 10,
    paddingHorizontal: 14, height: 48, fontSize: 15, color: '#1a3c2d',
    marginBottom: 10, backgroundColor: '#f8fcfa',
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancel: {
    flex: 1, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#555' },
  modalSave: {
    flex: 1, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2d6a4f',
  },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
