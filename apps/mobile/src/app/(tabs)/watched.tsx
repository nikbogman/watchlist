import { EmptyList } from '@/components/empty-list'
import { ScreenHeader } from '@/components/screen-header'

export default function Watched() {
  return (
    <>
      <ScreenHeader title="Watched" logout />
      <EmptyList text="Nothing watched yet." />
    </>
  )
}
