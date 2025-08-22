import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const Toolbar = ({
  onConfirm,
  onDelete,
  onToggleTapes,
  onToggleNumbers,
  tapesEnabled = false,
  numbersEnabled = false,
  canConfirm = false,
  canDelete = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <TouchableOpacity
          style={[
            styles.button,
            canConfirm ? styles.activeButton : styles.disabledButton,
          ]}
          onPress={onConfirm}
          disabled={!canConfirm}
        >
          <Ionicons
            name="checkmark"
            size={24}
            color={canConfirm ? "white" : "#ccc"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            canDelete ? styles.deleteButton : styles.disabledButton,
          ]}
          onPress={onDelete}
          disabled={!canDelete}
        >
          <Ionicons
            name="trash"
            size={24}
            color={canDelete ? "white" : "#ccc"}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.rightSection}>
        <TouchableOpacity
          style={[styles.toggleButton, tapesEnabled && styles.activeToggle]}
          onPress={onToggleTapes}
        >
          <Text
            style={[styles.toggleText, tapesEnabled && styles.activeToggleText]}
          >
            Tapes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, numbersEnabled && styles.activeToggle]}
          onPress={onToggleNumbers}
        >
          <Text
            style={[
              styles.toggleText,
              numbersEnabled && styles.activeToggleText,
            ]}
          >
            Numbers
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  leftSection: {
    flexDirection: "row",
    gap: 12,
  },
  rightSection: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  activeButton: {
    backgroundColor: "#4CAF50",
  },
  deleteButton: {
    backgroundColor: "#F44336",
  },
  disabledButton: {
    backgroundColor: "#555",
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  activeToggle: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  toggleText: {
    fontSize: 14,
    color: "#ccc",
  },
  activeToggleText: {
    color: "white",
  },
});

export default Toolbar;
