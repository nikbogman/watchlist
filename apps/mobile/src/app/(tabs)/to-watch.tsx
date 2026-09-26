import { EmptyList } from '@/components/empty-list'
import { ScreenHeader } from '@/components/screen-header'

export default function ToWatch() {
  return (
    <>
      <ScreenHeader title="To watch" logout />
      <EmptyList text="Nothing to watch yet." />
    </>
  )
}
