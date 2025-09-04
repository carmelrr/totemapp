import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console for debugging
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <View style={styles.container}>
          <Text style={styles.title}>🚫 שגיאה בטעינת האפליקציה</Text>
          <Text style={styles.message}>
            אירעה שגיאה בלתי צפויה. אנא נסה שוב.
          </Text>
          {this.state.error && (
            <Text style={styles.errorText}>{this.state.error.toString()}</Text>
          )}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleRetry}
          >
            <Text style={styles.retryButtonText}>נסה שוב</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f8f9fa",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#dc3545",
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#6c757d",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
  },
  errorText: {
    fontSize: 12,
    color: "#dc3545",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "monospace",
    backgroundColor: "#f8f9fa",
    padding: 10,
    borderRadius: 8,
  },
  retryButton: {
    backgroundColor: "#007bff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ErrorBoundary;
