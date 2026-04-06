import { Player } from '@remotion/player'
import {
  ExplainerAd,
  EXPLAINER_DURATION,
  EXPLAINER_FPS,
  EXPLAINER_WIDTH,
  EXPLAINER_HEIGHT,
} from '../remotion/ExplainerAd'

export default function PreviewAd() {
  return (
    <div style={{ background: '#111', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: '100%', maxWidth: 1200 }}>
        <Player
          component={ExplainerAd}
          durationInFrames={EXPLAINER_DURATION}
          fps={EXPLAINER_FPS}
          compositionWidth={EXPLAINER_WIDTH}
          compositionHeight={EXPLAINER_HEIGHT}
          controls
          style={{ width: '100%', borderRadius: 12, overflow: 'hidden' }}
          autoPlay
        />
      </div>
    </div>
  )
}
