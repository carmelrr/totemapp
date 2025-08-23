import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";

export default function RouteEditPanel({
  route,
  isMovingRoute,
  onStartMove,
  onStopMove,
  onDelete,
  onClose,
}) {
  if (!route) {
    return null;
  }

  const handleDelete = () => {
    Alert.alert(
      "מחיקת מסלול",
      `האם אתה בטוח שברצונך למחוק את המסלול ${route.grade}?`,
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "מחק",
          style: "destructive",
          onPress: () => onDelete(),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>עריכת מסלול {route.grade}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.routeInfo}>
          <Text style={styles.infoText}>צבע: {route.color}</Text>
          <Text style={styles.infoText}>דרגה: {route.grade}</Text>
          <Text style={styles.infoText}>קושי: {route.difficulty}</Text>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.moveButton,
              isMovingRoute && styles.moveButtonActive,
            ]}
            onPress={isMovingRoute ? onStopMove : onStartMove}
          >
            <Text
              style={[
                styles.buttonText,
                isMovingRoute && styles.moveButtonTextActive,
              ]}
            >
              {isMovingRoute ? "✓ סיים הזזה" : "🔄 הזז מסלול"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Text style={styles.buttonText}>🗑️ מחק מסלול</Text>
          </TouchableOpacity>
        </View>

        {isMovingRoute && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>
              💡 גרור את העיגול על המפה כדי להזיז את המסלול
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderTopWidth: 2,
    borderTopColor: "#3498db",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#dee2e6",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    textAlign: "right",
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e74c3c",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  content: {
    padding: 15,
  },
  routeInfo: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 16,
    marginBottom: 5,
    color: "#495057",
    textAlign: "right",
  },
  buttonsContainer: {
    gap: 10,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  moveButton: {
    backgroundColor: "#f39c12",
    borderWidth: 2,
    borderColor: "#e67e22",
  },
  moveButtonActive: {
    backgroundColor: "#27ae60",
    borderColor: "#2ecc71",
  },
  deleteButton: {
    backgroundColor: "#e74c3c",
    borderWidth: 2,
    borderColor: "#c0392b",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "right",
  },
  moveButtonTextActive: {
    color: "white",
  },
  instructionsContainer: {
    backgroundColor: "#fff3cd",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#ffc107",
    marginTop: 10,
  },
  instructionsText: {
    fontSize: 14,
    color: "#856404",
    textAlign: "right",
  },
});
