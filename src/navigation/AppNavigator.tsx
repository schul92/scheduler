import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { JoinGroupScreen } from '../screens/JoinGroupScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
import { useAuthContext } from '../lib/AuthContext';

export type RootStackParamList = {
  Welcome: undefined;
  JoinGroup: undefined;
  Auth: undefined;
  ProfileSetup: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { user, initialized } = useAuthContext();

  if (!initialized) {
    // You could show a loading screen here
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? 'ProfileSetup' : 'Welcome'}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {!user ? (
          // Auth flow screens
          <>
            <Stack.Screen name="Welcome">
              {({ navigation }) => (
                <WelcomeScreen
                  onGetStarted={() => navigation.navigate('JoinGroup')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="JoinGroup">
              {({ navigation }) => (
                <JoinGroupScreen
                  onJoinGroup={(code) => {
                    console.log('Joining group with code:', code);
                    // Navigate to Auth if not logged in
                    navigation.navigate('Auth');
                  }}
                  onCreateGroup={() => navigation.navigate('Auth')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Auth">
              {({ navigation }) => (
                <AuthScreen
                  onBack={() => navigation.goBack()}
                  onEmailAuth={() => {
                    console.log('Email auth pressed');
                    // TODO: Implement email auth screen
                  }}
                  onLogin={() => {
                    console.log('Login pressed');
                    // TODO: Navigate to login screen
                  }}
                  onAuthSuccess={() => {
                    // Auth state change will automatically update the navigator
                    console.log('Auth successful!');
                  }}
                />
              )}
            </Stack.Screen>
          </>
        ) : (
          // Authenticated screens
          <>
            <Stack.Screen name="ProfileSetup">
              {({ navigation }) => (
                <ProfileSetupScreen
                  initialData={{
                    name: user?.user_metadata?.full_name || user?.user_metadata?.name || '',
                    email: user?.email,
                    profileImage: user?.user_metadata?.avatar_url || user?.user_metadata?.picture,
                  }}
                  onComplete={(profile) => {
                    console.log('Profile completed:', profile);
                    console.log('Selected roles:', profile.roles);
                    // TODO: Save profile to Supabase
                    navigation.navigate('JoinGroup');
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="JoinGroup">
              {({ navigation }) => (
                <JoinGroupScreen
                  onJoinGroup={(code) => {
                    console.log('Joining group with code:', code);
                    // TODO: Implement group join logic with Supabase
                  }}
                  onCreateGroup={() => {
                    console.log('Creating new group');
                    // TODO: Implement group creation
                  }}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
