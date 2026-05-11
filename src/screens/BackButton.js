// src/screens/BackButton.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BackButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Ionicons name="arrow-back" size={24} color="white" />
      <Text style={styles.text}>Voltar</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#525659',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  text: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 19,
    marginLeft: 5,
  },
});

