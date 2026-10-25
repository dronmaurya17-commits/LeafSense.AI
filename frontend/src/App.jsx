import { useEffect, useRef, useState } from 'react'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const GOOD_NAME = /\.(jpe?g|png|webp)$/i

const HERO_SLIDES = [
  { src: '/images/leaf-hero-canopy.jpg', label: 'A closer look at plant health' },
  { src: '/images/leaf-hero-dewdrop.jpg', label: 'Small signs can tell a story' },
  { src: '/images/leaf-hero-garden.jpg', label: 'Care that starts with observation' },
]

const CONDITIONS = [
  {
    number: '01',
    name: 'Spotted Leaf',
    description: 'Leaf-spot classes across crops, including bacterial spot, Septoria and Cercospora leaf spot.',
    plants: 'Peach · Pepper · Tomato · Corn · Grape',
    icon: 'spot',
    supported: true,
  },
  {
    number: '02',
    name: 'Rust',
    description: 'The model includes Cedar apple rust and Common rust classes.',
    plants: 'Apple · Corn',
    icon: 'rust',
    supported: true,
  },
  {
    number: '03',
    name: 'Powdery Mildew',
    description: 'White powdery growth classes are available for Cherry and Squash.',
    plants: 'Cherry · Squash',
    icon: 'mildew',
    supported: true,
  },
  {
    number: '04',
    name: 'Gray Mold',
    description: 'This disease is not among the model’s training labels, so LeafSense will not diagnose it.',
    plants: 'Not supported by this model',
    icon: 'unsupported',
    supported: false,
  },
]

export default function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef(null)
  const urlRef = useRef(null)

  useEffect(() => {
    let alive = true
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('unavailable'))))
      .then((d) => alive && setHealth(d))
      .catch(() => alive && setHealth({ model_loaded: false }))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % HERO_SLIDES.length)
    }, 6500)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  function reset() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    if (inputRef.current) inputRef.current.value = ''
    setFile(null)
    setPreview(null)
    setResult(null)
    setError('')
  }

  function selectFile(chosen) {
    setResult(null)
    setError('')
    if (!chosen) return
    if (!ALLOWED_TYPES.includes(chosen.type) && !GOOD_NAME.test(chosen.name)) {
      reset()
      setError('Please select a JPG, JPEG, PNG or WEBP image.')
      return
    }
    if (chosen.size > MAX_BYTES) {
      reset()
      setError('That image is larger than 10 MB. Please choose a smaller file.')
      return
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(chosen)
    setFile(chosen)
    setPreview(urlRef.current)
  }

  async function analyze() {
    if (!file) {
      setError('Choose a leaf photo first.')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      let data
      try {
        data = await response.json()
      } catch {
        throw new Error('The analysis server returned an unexpected response.')
      }
      if (!response.ok) {
        throw new Error(data.error || `Analysis failed (HTTP ${response.status}).`)
      }
      setResult(data)
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Cannot reach the local analysis server. Start the backend, then try again.'
          : err.message || 'Analysis failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const offline = health !== null && !health.model_loaded
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="app" id="top">
      <header className="site-header">
        <div className="header-inner wrap">
          <a className="brand" href="#top" aria-label="LeafSense.AI home" onClick={closeMenu}>
            <span className="brand-mark"><LeafMark /></span>
            <span>LeafSense<span className="brand-dot">.AI</span></span>
          </a>

          <button
            className={`nav-toggle${menuOpen ? ' is-open' : ''}`}
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span /><span /><span />
          </button>

          <nav className={`primary-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
            <a href="#how-it-works" onClick={closeMenu}>How it works</a>
            <a href="#conditions" onClick={closeMenu}>Conditions</a>
            <a href="#about" onClick={closeMenu}>About</a>
            <div className={`status-pill ${offline ? 'status-bad' : health ? 'status-good' : 'status-wait'}`}>
              <span className="status-dot" />
              {health === null ? 'Checking model' : offline ? 'Model offline' : 'AI model ready'}
            </div>
            <a className="nav-cta" href="#analyze" onClick={closeMenu}>Analyze a leaf <span aria-hidden="true">↗</span></a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-scenes" aria-hidden="true">
            {HERO_SLIDES.map((slide, index) => (
              <img
                key={slide.src}
                className={`hero-scene${activeSlide === index ? ' is-active' : ''}`}
                src={slide.src}
                alt=""
              />
            ))}
            <div className="hero-shade" />
          </div>

          <div className="hero-content wrap">
            <div className="hero-copy">
              <div className="hero-kicker"><span className="kicker-leaf"><LeafMark /></span> A little more insight for every leaf</div>
              <h1 id="hero-title">Identify Plant Diseases.<br /><em>Protect Your Plants.</em></h1>
              <p className="hero-intro">
                A clear leaf photo can be the first step to healthier plants. Get a local AI prediction and simple, practical guidance.
              </p>
              <div className="hero-actions">
                <a className="button button-light" href="#analyze">Analyze a leaf <span aria-hidden="true">↗</span></a>
                <a className="button button-outline" href="#how-it-works">How it works <span aria-hidden="true">↓</span></a>
              </div>
              <div className="hero-assurance">
                <span className="assurance-icon"><ShieldMark /></span>
                <span><strong>Private by design</strong><br />Your photo is analyzed locally on your computer.</span>
              </div>
            </div>
          </div>

          <div className="hero-bottom wrap">
            <div className="hero-caption" aria-live="polite">
              <span className="caption-line" />
              <span>{HERO_SLIDES[activeSlide].label}</span>
            </div>
            <div className="slide-controls" role="group" aria-label="Choose hero background image">
              {HERO_SLIDES.map((slide, index) => (
                <button
                  className={`slide-dot${activeSlide === index ? ' is-active' : ''}`}
                  key={slide.src}
                  type="button"
                  aria-label={`Show background ${index + 1}: ${slide.label}`}
                  aria-pressed={activeSlide === index}
                  onClick={() => setActiveSlide(index)}
                />
              ))}
            </div>
          </div>
          <div className="hero-index" aria-hidden="true">0{activeSlide + 1} <span>/ 0{HERO_SLIDES.length}</span></div>
        </section>

        <section className="quick-facts wrap" aria-label="LeafSense at a glance">
          <div className="fact"><span className="fact-number">38</span><span className="fact-label">PlantVillage<br />model classes</span></div>
          <div className="fact-divider" />
          <div className="fact"><span className="fact-number">14</span><span className="fact-label">crop types in<br />the model</span></div>
          <div className="fact-divider" />
          <div className="fact"><span className="fact-number fact-local"><span className="status-dot" /> Local</span><span className="fact-label">inference on<br />your computer</span></div>
          <p className="facts-note">A thoughtful first look—not a replacement for expert advice.</p>
        </section>

        <section className="section section-how" id="how-it-works">
          <div className="wrap">
            <SectionHeading
              eyebrow="Simple from the start"
              title="Good care begins with a closer look."
              description="LeafSense keeps the process clear: share a photo, let the model look for a match, and use the result as a starting point."
            />
            <div className="steps-grid">
              <article className="step-card">
                <span className="step-number">01</span>
                <span className="step-icon"><CameraMark /></span>
                <h3>Choose a leaf</h3>
                <p>Upload one clear JPG, PNG or WEBP photo. Your image stays on your computer.</p>
              </article>
              <article className="step-card">
                <span className="step-number">02</span>
                <span className="step-icon"><ScanMark /></span>
                <h3>Get a model match</h3>
                <p>A pretrained plant-disease classifier runs locally and returns a class and confidence score.</p>
              </article>
              <article className="step-card">
                <span className="step-number">03</span>
                <span className="step-icon"><CareMark /></span>
                <h3>Take a sensible next step</h3>
                <p>See typical symptoms and general care tips, then check important decisions with a local expert.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section analyze-section" id="analyze">
          <div className="wrap">
            <div className="analyze-heading">
              <div>
                <p className="eyebrow">Your plant health check</p>
                <h2>Let’s take a look at that leaf.</h2>
                <p className="section-description">For best results, use a single leaf in focus, with natural light and a simple background.</p>
              </div>
              <div className="local-note"><span className="status-dot" /><span>Runs locally<br /><small>No cloud upload</small></span></div>
            </div>

            <div className="analysis-grid">
              <section className="card upload-card" aria-labelledby="upload-title">
                <div className="card-heading">
                  <span className="card-step">01</span>
                  <div><p className="card-overline">Start with a photo</p><h3 id="upload-title">Choose a leaf photo</h3></div>
                </div>

                <label
                  className={`dropzone${preview ? ' has-image' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (!loading) selectFile(e.dataTransfer.files?.[0])
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    disabled={loading}
                    onChange={(e) => selectFile(e.target.files?.[0])}
                  />
                  {preview ? (
                    <img
                      src={preview}
                      alt="Selected leaf preview"
                      onError={() => {
                        reset()
                        setError('That file could not be opened as an image.')
                      }}
                    />
                  ) : (
                    <div className="dropzone-empty">
                      <span className="upload-icon"><UploadMark /></span>
                      <strong>Drop your leaf photo here</strong>
                      <span>or <span className="browse-link">browse files</span></span>
                      <small>JPG, JPEG, PNG or WEBP <span>·</span> up to 10 MB</small>
                    </div>
                  )}
                  {preview && <span className="preview-chip">Preview ready</span>}
                </label>

                {file && (
                  <div className="file-row">
                    <span className="file-type-icon"><PhotoMark /></span>
                    <span className="file-name" title={file.name}>{file.name}</span>
                    <span className="file-size">{(file.size / 1024).toFixed(0)} KB</span>
                  </div>
                )}

                <div className="actions">
                  <button className="button button-primary" onClick={analyze} disabled={!file || loading}>
                    {loading ? <><span className="spinner" /> Analyzing</> : <>Analyze leaf <span aria-hidden="true">↗</span></>}
                  </button>
                  <button className="button button-quiet" onClick={reset} disabled={loading || !file}>Clear</button>
                </div>

                {loading && <div className="loading" role="status">Running local AI inference on your photo…</div>}
                {error && <div className="alert alert-error" role="alert">{error}</div>}
                {offline && (
                  <div className="alert alert-soft">
                    <strong>Analysis server unavailable.</strong> Start the backend in a terminal, then try again.
                  </div>
                )}
                <p className="upload-footnote"><ShieldMark /> Your photo is used for this analysis only.</p>
              </section>

              <section className="card result-card" aria-labelledby="result-title">
                <div className="card-heading">
                  <span className="card-step">02</span>
                  <div><p className="card-overline">A helpful starting point</p><h3 id="result-title">Your result</h3></div>
                </div>
                {!result && !loading && (
                  <div className="empty-result">
                    <div className="empty-illustration"><LeafMark /></div>
                    <p className="empty-title">Your result will grow here.</p>
                    <p>Choose a photo and analyze it to see the model’s closest plant-specific match.</p>
                    <div className="scope-note"><span className="scope-dot" /> Spotted Leaf, Rust &amp; Powdery Mildew supported <span className="scope-divider">·</span> Gray Mold not supported</div>
                  </div>
                )}
                {loading && <div className="empty-result loading-result"><span className="spinner large" /><p className="empty-title">Looking closely…</p><p>The model is comparing the leaf with its known classes.</p></div>}
                {result && !loading && <Result data={result} />}
              </section>
            </div>
          </div>
        </section>

        <section className="section conditions-section" id="conditions">
          <div className="wrap">
            <SectionHeading
              eyebrow="Know the model’s scope"
              title="A clear view of what it can—and can’t—spot."
              description="The model recognizes plant-specific PlantVillage classes. We group some into broad categories while keeping the original crop and condition visible."
              align="left"
            />
            <div className="conditions-grid">
              {CONDITIONS.map((condition) => (
                <article className={`condition-card${condition.supported ? '' : ' is-unsupported'}`} key={condition.name}>
                  <div className="condition-topline"><span className="condition-icon"><ConditionMark type={condition.icon} /></span><span className="condition-number">{condition.number}</span></div>
                  <div className={`condition-status${condition.supported ? '' : ' muted'}`}><span />{condition.supported ? 'Model class available' : 'Not in model labels'}</div>
                  <h3>{condition.name}</h3>
                  <p>{condition.description}</p>
                  <div className="plant-list">{condition.plants}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="about-banner" id="about">
          <div className="wrap about-inner">
            <div className="about-mark"><LeafMark /></div>
            <div className="about-copy">
              <p className="eyebrow">Made to help you learn</p>
              <h2>Curiosity is a good place to start.</h2>
              <p>LeafSense.AI is an educational demo. Its predictions are AI estimates, not a confirmed diagnosis. When a plant’s health is at stake, ask a qualified plant pathologist or local agricultural service.</p>
            </div>
            <a className="button button-light about-cta" href="#analyze">Try a leaf photo <span aria-hidden="true">↑</span></a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap footer-inner">
          <a className="brand footer-brand" href="#top"><span className="brand-mark"><LeafMark /></span><span>LeafSense<span className="brand-dot">.AI</span></span></a>
          <p>For educational use only · Predictions are not professional diagnosis.</p>
          <a href="#top" className="back-top">Back to top ↑</a>
        </div>
      </footer>
    </div>
  )
}

function SectionHeading({ eyebrow, title, description, align = 'center' }) {
  return (
    <div className={`section-heading${align === 'left' ? ' align-left' : ''}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

function Result({ data }) {
  const pct = (data.confidence * 100).toFixed(1)
  if (data.status === 'uncertain') {
    return (
      <div className="result result-uncertain">
        <span className="badge badge-amber">Uncertain result</span>
        <h3>The model is not confident enough</h3>
        <p>{data.message}</p>
        <p className="small">Closest trained class (not a diagnosis): {data.plant} — {data.condition} ({pct}%).</p>
        <ConfidenceBar value={data.confidence} muted />
        <Disclaimer />
      </div>
    )
  }
  if (data.status === 'out_of_scope') {
    return (
      <div className="result result-neutral">
        <span className="badge badge-grey">Outside the four target categories</span>
        <h3>{data.plant} — {data.condition}</h3>
        <p>{data.message}</p>
        <ConfidenceBar value={data.confidence} muted />
        <p className="small">LeafSense.AI only reports Spotted Leaf, Rust and Powdery Mildew. Gray Mold is not supported by this model. If your plant is unwell, consult a local expert.</p>
        <Disclaimer />
      </div>
    )
  }
  return (
    <div className="result result-ok">
      <span className="badge badge-green">{data.category}</span>
      <h3>{data.plant} — {data.condition}</h3>
      <p className="small">{data.message}</p>
      <ConfidenceBar value={data.confidence} />
      <h4>Typical symptoms</h4>
      <p>{data.symptoms}</p>
      <h4>General care suggestions</h4>
      <ul>{data.care.map((item) => <li key={item}>{item}</li>)}</ul>
      <Disclaimer />
    </div>
  )
}

function ConfidenceBar({ value, muted }) {
  return (
    <div className={`confidence${muted ? ' confidence-muted' : ''}`}>
      <div className="confidence-head"><span>Model confidence</span><strong>{(value * 100).toFixed(1)}%</strong></div>
      <div className="bar"><div className="bar-fill" style={{ width: `${Math.min(100, value * 100)}%` }} /></div>
      <p className="small">A softmax score from the model, not a guarantee of diagnostic accuracy.</p>
    </div>
  )
}

function Disclaimer() {
  return <p className="disclaimer">Educational use only. This is an AI estimate, not a confirmed diagnosis. Consult a qualified plant pathologist or local agricultural service before treatment.</p>
}

function LeafMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M26.7 4.9c-8.2.1-14.3 1.3-18.2 5.2-4 4-3.8 10.5.2 13.5 3.7 2.8 9.3 1.8 12.6-1.6 3.8-3.8 5.1-10.7 5.4-17.1Z" fill="currentColor" />
      <path d="M5.1 27.2c3.9-6.1 8.3-10.5 14.2-14.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ShieldMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5 19 6v5.8c0 4.3-2.8 7.3-7 9.2-4.2-1.9-7-4.9-7-9.2V6l7-2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m9 12.1 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CameraMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7.5h3l1.4-2h7.2l1.4 2h3v11H4v-11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function ScanMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 4H5a1 1 0 0 0-1 1v3m12-4h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3m12-4v3a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7.5 12h9M12 7.5v9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function CareMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20s-7-3.9-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 6.1-7 10-7 10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 17V9m0 4c-1.5 0-2.5-.7-3.2-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function UploadMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PhotoMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="9" r="1.5" fill="currentColor" />
      <path d="m5 17 4.5-4.5 3 3L16 12l3 5H5Z" fill="currentColor" opacity=".55" />
    </svg>
  )
}

function ConditionMark({ type }) {
  if (type === 'unsupported') return <span className="unsupported-mark" aria-hidden="true">—</span>
  if (type === 'rust') return <span className="condition-glyph rust-glyph" aria-hidden="true">✳</span>
  if (type === 'mildew') return <span className="condition-glyph mildew-glyph" aria-hidden="true">✦</span>
  return <span className="condition-glyph spot-glyph" aria-hidden="true">◉</span>
}
