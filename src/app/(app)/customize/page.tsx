import { requireMember } from '@/server/auth'
import { readLibraryAppearance } from '@/lib/library-appearance'
import LibraryCustomizer from '@/components/library/LibraryCustomizer'

export default async function CustomizePage() {
  const { member, household } = await requireMember()
  return <LibraryCustomizer key={member.id} householdId={household.id} householdName={household.name} initial={readLibraryAppearance(member.libraryAppearance)} />
}
