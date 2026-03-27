import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DesktopFatalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[DesktopFatalErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#e2e8f0",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>💥</div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem", color: "#f8fafc" }}>
            Erro fatal na aplicação
          </h1>
          <p style={{ color: "#94a3b8", lineHeight: 1.6, marginBottom: "1.5rem" }}>
            Ocorreu um erro inesperado que impediu o carregamento da interface.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: "0.6rem 1.5rem",
              borderRadius: 6,
              border: "none",
              background: "#3b82f6",
              color: "#fff",
              fontSize: "0.9rem",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Recarregar
          </button>
          {this.state.error && (
            <pre
              style={{
                marginTop: "1.5rem",
                padding: "1rem",
                background: "#1e293b",
                borderRadius: 6,
                textAlign: "left",
                fontSize: "0.75rem",
                color: "#94a3b8",
                maxHeight: 160,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
