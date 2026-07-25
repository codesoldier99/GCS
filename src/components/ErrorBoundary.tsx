import { Component, type ReactNode } from 'react'
import { Icon } from './Icon'

interface Props {
  children: ReactNode
  onReset: () => void
}
interface State {
  error: Error | null
}

/** 兜底错误边界：渲染树内任何未捕获异常（如卸载竞态）都落在这里，避免整屏黑屏/卡死无法恢复。 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error): void {
    console.error('[ErrorBoundary]', error)
  }

  private reset = (): void => {
    this.props.onReset()
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 200 }}>
        <div className="panel" style={{ padding: '28px 32px', textAlign: 'center', maxWidth: 380 }}>
          <Icon name="unlink" size={30} style={{ color: 'var(--danger)' }} />
          <div style={{ marginTop: 12, fontSize: 16, fontWeight: 700 }}>界面出现异常</div>
          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-mid)', lineHeight: 1.6 }}>
            {this.state.error.message || '未知错误'}
          </div>
          <button className="btn primary" style={{ marginTop: 18, width: '100%' }} onClick={this.reset}>
            <Icon name="home" size={16} /> 返回主菜单
          </button>
        </div>
      </div>
    )
  }
}
