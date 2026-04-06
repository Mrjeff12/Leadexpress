import { AbsoluteFill, Sequence } from 'remotion'
import {
  SCENE_1_START, SCENE_2_START, SCENE_3_START, SCENE_4_START, SCENE_5_START, TOTAL_FRAMES,
} from './explainer/shared/theme'
import { Scene1Hook } from './explainer/Scene1Hook'
import { Scene2GCSide } from './explainer/Scene2GCSide'
import { Scene3SubSide } from './explainer/Scene3SubSide'
import { Scene4Merge } from './explainer/Scene4Merge'
import { Scene5CTA } from './explainer/Scene5CTA'

export const ExplainerAd: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#faf9f6' }}>
      <Sequence from={SCENE_1_START} durationInFrames={SCENE_2_START + 60}>
        <Scene1Hook />
      </Sequence>
      <Sequence from={SCENE_2_START} durationInFrames={SCENE_3_START - SCENE_2_START + 60}>
        <Scene2GCSide />
      </Sequence>
      <Sequence from={SCENE_3_START} durationInFrames={SCENE_4_START - SCENE_3_START + 60}>
        <Scene3SubSide />
      </Sequence>
      <Sequence from={SCENE_4_START} durationInFrames={SCENE_5_START - SCENE_4_START + 60}>
        <Scene4Merge />
      </Sequence>
      <Sequence from={SCENE_5_START} durationInFrames={TOTAL_FRAMES - SCENE_5_START}>
        <Scene5CTA />
      </Sequence>
    </AbsoluteFill>
  )
}

export { FPS as EXPLAINER_FPS, TOTAL_FRAMES as EXPLAINER_DURATION, WIDTH as EXPLAINER_WIDTH, HEIGHT as EXPLAINER_HEIGHT } from './explainer/shared/theme'
