import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Player from './components/Player.jsx'
import HealthBar from './components/HealthBar.jsx'
import Inventory from './components/Inventory.jsx'
import World from './components/World.jsx'

/* A pale Flanaess morning: soft sky, matched fog dissolving the map's
 * edges, the fighter's warm sun for key light and shadows. */
const SKY = '#e9eef2'

export default function App() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
        camera={{ fov: 55, near: 0.05, far: 400, position: [0, 1.6, 3.2] }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(SKY)
          scene.fog = new THREE.Fog(SKY, 42, 92)
        }}
      >
        <hemisphereLight args={['#f6f9fb', '#b9c2b4', 1.05]} />
        {/* a cool fill off the river, so shadows stay open */}
        <directionalLight position={[6, 4, 8]} intensity={0.5} color="#cfe0ea" />

        {/* the Eryshaw: river, fouled stream, the wood and its dressing */}
        <World />

        <Player />
      </Canvas>

      {/* flat UI, drawn over the canvas and tracked to a point above his head */}
      <HealthBar />

      {/* the inventory: a drawer bolted to the right edge, handle top right */}
      <Inventory />
    </div>
  )
}
