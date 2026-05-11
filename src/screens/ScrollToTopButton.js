// src/screens/ScrollToTopButton.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function ScrollToTopButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.text}>↑</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#d3d3d3', // Cor de fundo cinza claro
    padding: 10,
    borderRadius: 50,
    elevation: 5,
  },
  text: {
    color: '#525659',
    fontSize: 24,
    textAlign: 'center',
  },
});

