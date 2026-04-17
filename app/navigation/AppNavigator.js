import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import PlotsListScreen from '../screens/PlotsListScreen';
import AddPlotChoiceScreen from '../screens/AddPlotChoiceScreen';
import MapScreen from '../screens/MapScreen';
import ManualPlotScreen from '../screens/ManualPlotScreen';
import PlotDetailScreen from '../screens/PlotDetailScreen';
import BedDetailScreen from '../screens/BedDetailScreen';
import AddCropScreen from '../screens/AddCropScreen';
import PlantsListScreen from '../screens/PlantsListScreen';
import AddPlantScreen from '../screens/AddPlantScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function PlantsDictStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#2d6a4f' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="PlantsList" component={PlantsListScreen} options={{ title: t('myPlants') }} />
      <Stack.Screen name="AddPlant" component={AddPlantScreen} options={{ title: t('addPlant') }} />
    </Stack.Navigator>
  );
}

function PlotsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#2d6a4f' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="PlotsList" component={PlotsListScreen} options={{ title: 'GardenMap' }} />
      <Stack.Screen name="AddPlotChoice" component={AddPlotChoiceScreen} />
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="ManualPlot" component={ManualPlotScreen} />
      <Stack.Screen name="PlotDetail" component={PlotDetailScreen} />
      <Stack.Screen name="BedDetail" component={BedDetailScreen} />
      <Stack.Screen name="AddCrop" component={AddCropScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { t } = useTranslation();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#2d6a4f',
          tabBarInactiveTintColor: '#999',
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Plots"
          component={PlotsStack}
          options={{ title: t('plots'), tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🌱</Text> }}
        />
        <Tab.Screen
          name="Plants"
          component={PlantsDictStack}
          options={{ title: t('plants'), tabBarIcon: () => <Text style={{ fontSize: 20 }}>🌿</Text> }}
        />
        <Tab.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{ title: t('analytics'), tabBarIcon: () => <Text style={{ fontSize: 20 }}>📊</Text>, headerShown: true, headerStyle: { backgroundColor: '#2d6a4f' }, headerTintColor: '#fff' }}
        />
        <Tab.Screen
          name="Archive"
          component={ArchiveScreen}
          options={{ title: t('archive'), tabBarIcon: () => <Text style={{ fontSize: 20 }}>📦</Text>, headerShown: true, headerStyle: { backgroundColor: '#2d6a4f' }, headerTintColor: '#fff' }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: t('settings'), tabBarIcon: () => <Text style={{ fontSize: 20 }}>⚙️</Text>, headerShown: true, headerStyle: { backgroundColor: '#2d6a4f' }, headerTintColor: '#fff' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
