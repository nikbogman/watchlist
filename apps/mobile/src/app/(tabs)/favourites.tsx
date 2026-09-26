import { EmptyList } from '@/components/empty-list'
import { ScreenHeader } from '@/components/screen-header'

export default function Favourites() {
  return (
    <>
      <ScreenHeader title="Favourites" logout />
      <EmptyList text="No favourites yet." />
    </>
  )
}
