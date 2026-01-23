import React from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLanguage } from "@/features/language";

export default function EditRouteModal({ visible, onClose, route, onDelete }) {
  const { t } = useLanguage();
  
  if (!route) return null;

  const handleDelete = () => {
    Alert.alert(
      t.routes.deleteRoute,
      t.routes.deleteRouteConfirm,
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.common.delete,
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
          <Text style={styles.title}>{t.editRouteModal.title}</Text>

          <View style={styles.routeInfo}>
            <Text style={styles.label}>{t.editRouteModal.grade}</Text>
            <Text style={styles.value}>{route.grade}</Text>
          </View>

          <View style={styles.routeInfo}>
            <Text style={styles.label}>{t.editRouteModal.color}</Text>
            <View style={[styles.colorBox, { backgroundColor: route.color }]} />
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Text style={styles.deleteButtonText}>{t.editRouteModal.deleteRoute}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>{t.editRouteModal.cancel}</Text>
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
