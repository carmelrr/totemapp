import React, { useState } from 'react';
import { Modal, View, TextInput, Button, StyleSheet } from 'react-native';

export default function AddRouteModal({ visible, onClose, onSave, initialCoords }) {
  const [grade, setGrade] = useState('');
  const [color, setColor] = useState('');

  const handleSave = () => {
    if (grade && color) {
      onSave({ ...initialCoords, grade, color });
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TextInput placeholder="Grade (e.g. 5)" value={grade} onChangeText={setGrade} style={styles.input} />
          <TextInput placeholder="Color" value={color} onChangeText={setColor} style={styles.input} />
          <Button title="Save Route" onPress={handleSave} />
          <Button title="Cancel" onPress={onClose} color="gray" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  input: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    marginBottom: 10,
    padding: 5,
  },
});

