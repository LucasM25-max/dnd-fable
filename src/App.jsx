import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Player from './components/Player.jsx'
import HealthBar from './components/HealthBar.jsx'
import Inventory from './components/Inventory.jsx'

export default function App() {
  // which weapon is in hand, shared between the hotkeys in Player and the
  // inventory panel (null = empty handed)
  const [held, setHeld] = useState(null)
  const [invOpen, setInvOpen] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
        camera={{ fov: 55, near: 0.05, far: 400, position: [0, 1.6, 3.2] }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color('#ffffff')
        }}
      >
        {/* a blank white world */}
        <hemisphereLight args={['#ffffff', '#e9e9e9', 1.15]} />
        <directionalLight position={[-5, 3.5, -5]} intensity={0.6} />
        <directionalLight position={[0, 2, -6]} intensity={0.35} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
        </mesh>

        <Player
          held={held}
          setHeld={setHeld}
          invOpen={invOpen}
          setInvOpen={setInvOpen}
        />
      </Canvas>

      {/* flat UI, drawn over the canvas and tracked to a point above his head */}
      <HealthBar />

      {/* the satchel button and the parchment panel it folds out */}
      <Inventory held={held} setHeld={setHeld} open={invOpen} setOpen={setInvOpen} />
    </div>
  )
}
