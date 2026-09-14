import { createRoot } from 'react-dom/client'
import { Dice } from 'react-roll-the-dice'
import './social.css'

// The repository's social preview card (GitHub → Settings → Social preview),
// drawn with the real component so it always matches the library. Captured to
// assets/social-preview.png at 1280×640:
//
//   cd examples/vite-react && npm run dev
//   headless Chrome, viewport 1280×640, deviceScaleFactor 1, screenshot of
//   http://localhost:5177/social.html
function Social() {
  return (
    <div className="og">
      <div className="og-copy">
        <p className="og-kicker">React component</p>
        <h1>react-roll-the-dice</h1>
        <p className="og-tagline">A 3D die built from nothing but CSS.</p>
        <ul className="og-facts">
          <li><strong>0</strong> runtime dependencies</li>
          <li><strong>CSS</strong> only</li>
          <li><strong>~6 kB</strong> gzipped</li>
        </ul>
        <p className="og-install">npm install react-roll-the-dice</p>
      </div>
      <div className="og-stage">
        <Dice size={176} defaultValue={5} />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<Social />)
