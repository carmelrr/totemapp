import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';

export default function AddRouteModal({ visible, onClose, onSave, initialCoords }) {
  const [grade, setGrade] = useState('');
  const [color, setColor] = useState('');

  useEffect(() => {
    if (visible) {
      setGrade('');
      setColor('');
    }
  }, [visible]);

  const handleSave = () => {
    if (grade && color && initialCoords) {
      onSave({ ...initialCoords, grade, color });
      onClose();
    } else {
      Alert.alert('שגיאה', 'נא למלא את כל השדות');
    }
  };

  return (
    <Modal 
      visible={visible} 
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.fullScreenContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add New Route</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>X</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Grade:</Text>
            <TextInput
              style={styles.input}
              placeholder="V5"
              value={grade}
              onChangeText={setGrade}
              placeholderTextColor="#666"
            />
          </View>
          
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Color:</Text>
            <TextInput
              style={styles.input}
              placeholder="red"
              value={color}
              onChangeText={setColor}
              placeholderTextColor="#666"
            />
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.buttonText}>SAVE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.buttonText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
  },
  cancelButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 5,
    flex: 1,
    marginLeft: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
  },
});

