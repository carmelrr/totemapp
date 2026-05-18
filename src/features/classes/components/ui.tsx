/**
 * @fileoverview Minimal shared UI helpers (theme-aware) used by the
 * class-planning screens. Kept inline-light — no animations.
 */

import React from "react";
import { Pressable, Text, TextInput, View, type ViewStyle } from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        color: theme.text,
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 8,
        writingDirection: "rtl",
      }}
    >
      {children}
    </Text>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        color: theme.textSecondary,
        fontSize: 12,
        marginBottom: 4,
        writingDirection: "rtl",
      }}
    >
      {children}
    </Text>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  numeric?: boolean;
  multiline?: boolean;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline,
}: FieldProps) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      <Label>{label}</Label>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          backgroundColor: theme.inputBackground,
          color: theme.text,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: theme.border,
          minHeight: multiline ? 60 : undefined,
          textAlign: "right",
          writingDirection: "rtl",
        }}
      />
    </View>
  );
}

interface BtnProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  style?: ViewStyle;
  disabled?: boolean;
}

export function Btn({ label, onPress, variant = "primary", style, disabled }: BtnProps) {
  const { theme } = useTheme();
  const bg =
    disabled
      ? theme.surface
      : variant === "primary"
        ? theme.buttonPrimary
        : variant === "danger"
          ? theme.error
          : "transparent";
  const fg =
    variant === "ghost"
      ? theme.text
      : "#FFFFFF";
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: bg,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: theme.border,
          alignItems: "center",
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: "600", writingDirection: "rtl" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
