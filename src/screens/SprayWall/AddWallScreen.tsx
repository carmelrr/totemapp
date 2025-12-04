// src/screens/SprayWall/AddWallScreen.tsx
// Screen for admins to add a new climbing wall

import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { WallForm } from "@/components/spray/WallForm";
import { useAdmin } from "@/context/AdminContext";
import { addWall } from "@/features/walls/wallsService";

export const AddWallScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isAdmin } = useAdmin();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: {
    name: string;
    width: number;
    height: number;
    isPublic: boolean;
    imageUri: string;
  }) => {
    if (!isAdmin) {
      Alert.alert("שגיאה", "אין לך הרשאה להוסיף קיר");
      return;
    }

    setLoading(true);
    try {
      await addWall(data);
      Alert.alert("הצלחה", "הקיר נוסף בהצלחה!", [
        {
          text: "אישור",
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert("שגיאה", error.message || "הוספת הקיר נכשלה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <WallForm onSubmit={handleSubmit} loading={loading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
});

export default AddWallScreen;
