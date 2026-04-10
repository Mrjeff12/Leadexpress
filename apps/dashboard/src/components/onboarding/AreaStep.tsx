import ServiceAreaSelector, { type SelectedArea } from '../settings/ServiceAreaSelector'

interface Props {
  selectedAreas: SelectedArea[]
  onAddArea: (area: SelectedArea) => void
  onRemoveArea: (state: string, county: string) => void
}

export default function AreaStep({ selectedAreas, onAddArea, onRemoveArea }: Props) {
  return (
    <ServiceAreaSelector
      selectedAreas={selectedAreas}
      onAddArea={onAddArea}
      onRemoveArea={onRemoveArea}
    />
  )
}
