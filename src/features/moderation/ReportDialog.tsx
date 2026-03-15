import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/features/theme/ThemeContext";
import { useLanguage } from "@/features/language";
import { ReportService, ReportContentType, ReportReason } from "./ReportService";

interface ReportDialogProps {
  visible: boolean;
  onClose: () => void;
  contentId: string;
  contentType: ReportContentType;
}

const REASONS: ReportReason[] = ["offensive", "spam", "inappropriate", "other"];

export const ReportDialog: React.FC<ReportDialogProps> = ({
  visible,
  onClose,
  contentId,
  contentType,
}) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);

  const reasonLabels: Record<ReportReason, string> = {
    offensive: t.moderation.reasonOffensive,
    spam: t.moderation.reasonSpam,
    inappropriate: t.moderation.reasonInappropriate,
    other: t.moderation.reasonOther,
  };

  const handleReport = async (reason: ReportReason) => {
    setSubmitting(true);
    try {
      await ReportService.reportContent({ contentId, contentType, reason });
      Alert.alert(t.moderation.reportSubmitted, t.moderation.reportSubmittedMessage);
      onClose();
    } catch (error) {
      Alert.alert(t.common.error, t.moderation.reportFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.container, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.text }]}>{t.moderation.reportTitle}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t.moderation.selectReason}
          </Text>

          {submitting ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 24 }} />
          ) : (
            REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonButton, { borderColor: theme.border }]}
                onPress={() => handleReport(reason)}
              >
                <Text style={[styles.reasonText, { color: theme.text }]}>{reasonLabels[reason]}</Text>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={[styles.cancelText, { color: theme.textSecondary }]}>{t.common.cancel}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "85%",
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  reasonButton: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  reasonText: {
    fontSize: 16,
    textAlign: "center",
  },
  cancelButton: {
    padding: 12,
    marginTop: 4,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
  },
});
