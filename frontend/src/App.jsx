import { useEffect, useRef, useState } from 'react'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const GOOD_NAME = /\.(jpe?g|png|webp)$/i

export default function App() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState(null)
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

  return (
    <div className="app">
      <header className="site-header">
        <div className="wrap header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">🌿</span>
            <span>LeafSense<span className="brand-dot">.AI</span></span>
          </div>
          <div className={'status ' + (offline ? 'status-bad' : health ? 'status-good' : 'status-wait')}>
            <span className="status-dot" />
            {health === null
              ? 'Checking model…'
              : offline
                ? 'Analysis server offline'
                : 'Local AI model ready'}
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <p className="eyebrow">AI-powered leaf disease detection</p>
          <h1>Identify Plant Diseases. Protect Your Plants.</h1>
          <p className="hero-sub">
            Upload a clear photo of a single leaf and get a prediction from a real,
            locally running plant-disease model. No data leaves your computer.
          </p>
        </section>

        <div className="grid">
          <section className="card">
            <h2>1. Choose a leaf photo</h2>
            <label
              className={'dropzone' + (preview ? ' has-image' : '')}
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
                  <span className="upload-icon" aria-hidden="true">⬆</span>
                  <strong>Click to browse or drop an image here</strong>
                  <span>JPG, JPEG, PNG or WEBP · max 10 MB</span>
                </div>
              )}
            </label>

            {file && (
              <div className="file-row">
                <span className="file-name" title={file.name}>{file.name}</span>
                <span className="file-size">{(file.size / 1024).toFixed(0)} KB</span>
              </div>
            )}

            <div className="actions">
              <button className="btn btn-primary" onClick={analyze} disabled={!file || loading}>
                {loading ? 'Analyzing…' : 'Analyze Leaf'}
              </button>
              <button className="btn btn-secondary" onClick={reset} disabled={loading || !file}>
                Clear image
              </button>
            </div>

            {loading && (
              <div className="loading" role="status">
                <span className="spinner" aria-hidden="true" />
                Running local AI inference on your photo…
              </div>
            )}
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            {offline && (
              <p className="hint">
                The model service is not running. In a terminal, start the backend with
                <code>python -m uvicorn app:app --app-dir backend --port 8000</code>.
              </p>
            )}
            <p className="hint">
              For best results use one leaf, in focus, in daylight, on a plain background.
            </p>
          </section>

          <section className="card">
            <h2>2. Analysis result</h2>
            {!result && !loading && (
              <div className="empty-result">
                <span className="empty-icon" aria-hidden="true">🔬</span>
                <p>Your result will appear here after you analyze a leaf.</p>
                <p className="coverage-note">
                  This model covers <strong>Spotted Leaf</strong>, <strong>Rust</strong> and{' '}
                  <strong>Powdery Mildew</strong>. <strong>Gray Mold</strong> is not among its
                  training labels and is reported as unsupported.
                </p>
              </div>
            )}
            {loading && (
              <div className="empty-result">
                <span className="spinner big" aria-hidden="true" />
                <p>Analyzing your image…</p>
              </div>
            )}
            {result && !loading && <Result data={result} />}
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          LeafSense.AI · College demo project · For educational use only. Predictions are not a
          professional diagnosis — confirm with a local plant expert before taking action.
        </div>
      </footer>
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
        <p className="small">
          Closest trained class (not a diagnosis): {data.plant} — {data.condition} ({pct}%).
        </p>
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
        <p className="small">
          LeafSense.AI only reports Spotted Leaf, Rust and Powdery Mildew. Gray Mold is not
          supported by this model. If your plant is unwell, consult a local expert.
        </p>
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
      <ul>
        {data.care.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <Disclaimer />
    </div>
  )
}

function ConfidenceBar({ value, muted }) {
  return (
    <div className={'confidence' + (muted ? ' confidence-muted' : '')}>
      <div className="confidence-head">
        <span>Model confidence</span>
        <strong>{(value * 100).toFixed(1)}%</strong>
      </div>
      <div className="bar"><div className="bar-fill" style={{ width: `${Math.min(100, value * 100)}%` }} /></div>
      <p className="small">
        A softmax score from the model, not a guarantee of diagnostic accuracy.
      </p>
    </div>
  )
}

function Disclaimer() {
  return (
    <p className="disclaimer">
      Educational use only. This is an AI estimate, not a confirmed diagnosis. Consult a
      qualified plant pathologist or local agricultural service before treatment.
    </p>
  )
}
