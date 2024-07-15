import dynamic from 'next/dynamic'
const SVGTo3DConverter = dynamic(() => import('../components/SVGTo3DConverter'), {
  loading: () => <p>Loading...</p>,
  ssr: false,
})

export default function Home() {
  return <SVGTo3DConverter />
}