import { useRouter } from 'next/router'

const ShowSheetMusic = () => {
  const router = useRouter()
  const { id } = router.query

  return <p>Sheet Music: {id}</p>
}

export default ShowSheetMusic;