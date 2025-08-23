import React from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";

export default function EditRouteModal({ visible, onClose, route, onDelete }) {
  if (!route) return null;

  const handleDelete = () => {
    Alert.alert(
      "מחיקת מסלול",
      `האם אתה בטוח שברצונך למחוק את המסלול ${route.grade}?`,
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "מחק",
          style: "destructive",
          onPress: onDelete,
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>עריכת מסלול</Text>

          <View style={styles.routeInfo}>
            <Text style={styles.label}>דירוג:</Text>
            <Text style={styles.value}>{route.grade}</Text>
          </View>

          <View style={styles.routeInfo}>
            <Text style={styles.label}>צבע:</Text>
            <View style={[styles.colorBox, { backgroundColor: route.color }]} />
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Text style={styles.deleteButtonText}>מחק מסלול</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    maxWidth: 300,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "right",
    marginBottom: 20,
  },
  routeInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 10,
    width: 60,
  },
  value: {
    fontSize: 16,
    color: "#34495e",
  },
  colorBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  deleteButton: {
    backgroundColor: "#e74c3c",
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  deleteButtonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "right",
  },
  cancelButton: {
    backgroundColor: "#95a5a6",
    padding: 12,
    borderRadius: 8,
    flex: 1,
  },
  cancelButtonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "right",
  },
});
