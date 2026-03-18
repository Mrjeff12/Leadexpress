import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[LeadExpress] Uncaught error:', error)
    console.error('[LeadExpress] Component stack:', info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fafaf8',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              maxWidth: 400,
              padding: 32,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#fe5b25',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 16,
                marginBottom: 24,
              }}
            >
              LE
            </div>

            <h1
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: '#1a1a1a',
                margin: '0 0 8px 0',
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                fontSize: 14,
                color: '#6b6b6b',
                margin: '0 0 24px 0',
                lineHeight: 1.5,
              }}
            >
              An unexpected error occurred. Please reload the page to try again.
            </p>

            <button
              onClick={this.handleReload}
              style={{
                background: '#fe5b25',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '10px 28px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
