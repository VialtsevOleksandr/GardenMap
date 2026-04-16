import 'react-native-gesture-handler';
import './app/i18n';
import React, { Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { enableScreens } from 'react-native-screens';
import AppNavigator from './app/navigation/AppNavigator';

enableScreens();

function LoadingFallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#2d6a4f" />
    </View>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AppNavigator />
    </Suspense>
  );
}
