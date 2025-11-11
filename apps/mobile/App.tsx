import React from 'react';
import { View } from 'react-native';
import { Hello } from '@truebpm/ui';
import { User } from '@truebpm/types';
import { API_URL } from '@truebpm/config';

export default function App() {
  const user: User = { id: '1', name: 'Arnaud', email: 'arnaud@example.com' };
  console.log('API_URL:', API_URL);
  console.log('User:', user);

  return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Hello />
      </View>
  );
}