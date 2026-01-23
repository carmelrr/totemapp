// src/screens/SprayWall/AddWallScreen.tsx
// Screen for admins to add a new climbing wall

import React, { useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { WallForm } from "@/components/spray/WallForm";
import { useAdmin } from "@/context/AdminContext";
import { useLanguage } from "@/features/language";
import { addWall } from "@/features/walls/wallsService";

export const AddWallScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isAdmin } = useAdmin();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: {
    name: string;
    width: number;
    height: number;
    isPublic: boolean;
    imageUri: string;
  }) => {
    if (!isAdmin) {
      Alert.alert(t.common.error, t.spray.noPermissionToAddWall);
      return;
    }

    setLoading(true);
    try {
      await addWall(data);
      Alert.alert(t.common.success, t.spray.wallAddedSuccess, [
        {
          text: t.common.ok,
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert(t.common.error, error.message || t.spray.failedToAddWall);
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
