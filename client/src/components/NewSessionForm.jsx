import { useRef, useState } from 'react'
import { createSession, scrapeUrl, analyzeImage } from '../lib/api'

export default function NewSessionForm({ onCreated, onBack }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // URL enrichment
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapedContent, setScrapedContent] = useState(null)
  const [scrapeError, setScrapeError] = useState(null)

  // Screenshot enrichment
  const fileRef = useRef(null)
  const [screenshotFile, setScreenshotFile] = useState(null)
  const [screenshotPreview, setScreenshotPreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [visualAnalysis, setVisualAnalysis] = useState(null)
  const [analyzeError, setAnalyzeError] = useState(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleScrape() {
    if (!url.trim()) return
    setScraping(true)
    setScrapeError(null)
    setScrapedContent(null)
    try {
      const { scraped_content } = await scrapeUrl(url.trim())
      setScrapedContent(scraped_content)
    } catch (err) {
      setScrapeError(err.message)
    } finally {
      setScraping(false)
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshotFile(file)
    setScreenshotPreview(URL.createObjectURL(file))
    setVisualAnalysis(null)
    setAnalyzeError(null)
  }

  async function handleAnalyze() {
    if (!screenshotFile) return
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const { visual_analysis } = await analyzeImage(screenshotFile, description)
      setVisualAnalysis(visual_analysis)
    } catch (err) {
      setAnalyzeError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !description.trim()) return
    setLoading(true)
    setError(null)
    try {
      const session = await createSession(name.trim(), description.trim(), {
        url: url.trim() || undefined,
        scraped_content: scrapedContent || undefined,
        visual_analysis: visualAnalysis || undefined,
      })
      onCreated(session)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = name.trim() && description.trim() && !loading

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 overflow-y-auto">
      <div className="w-full max-w-lg mx-auto">
        <button onClick={onBack} className="text-slate-500 hover:text-white text-sm mb-6 transition-colors">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-white mb-2">New Review Session</h1>
        <p className="text-slate-400 text-sm mb-8">
          The board will independently analyze your idea, debate it, and vote.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Project name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Project Name
            </label>
            <input
              type="text"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 text-sm"
              placeholder="e.g. TripPal"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          {/* Idea */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Your Idea
            </label>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 text-sm resize-none"
              rows={5}
              placeholder="Describe your product idea in detail. What problem does it solve? Who is it for? What makes it different?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-600 uppercase tracking-widest">Optional Context</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          {/* URL scraping */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Reference URL <span className="text-slate-600 normal-case font-normal">(competitor site, landing page, article)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 text-sm"
                placeholder="https://competitor.com"
                value={url}
                onChange={e => { setUrl(e.target.value); setScrapedContent(null); setScrapeError(null) }}
              />
              <button
                type="button"
                onClick={handleScrape}
                disabled={!url.trim() || scraping}
                className="px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
              >
                {scraping ? 'Scraping…' : 'Scrape'}
              </button>
            </div>
            {scrapeError && <p className="text-red-400 text-xs mt-2">{scrapeError}</p>}
            {scrapedContent && (
              <div className="mt-2 bg-slate-900 border border-slate-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-emerald-400 text-xs font-semibold">✓ Scraped</span>
                  <span className="text-slate-500 text-xs">{scrapedContent.length.toLocaleString()} chars — will be shared with the board</span>
                </div>
                <p className="text-slate-500 text-xs line-clamp-2">{scrapedContent.slice(0, 200)}…</p>
              </div>
            )}
          </div>

          {/* Screenshot upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Screenshots <span className="text-slate-600 normal-case font-normal">(mockups, competitor UI, wireframes)</span>
            </label>
            <div
              className="relative border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl p-5 text-center cursor-pointer transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
              {screenshotPreview ? (
                <img src={screenshotPreview} alt="preview" className="max-h-40 mx-auto rounded-lg object-contain" />
              ) : (
                <div className="text-slate-500">
                  <div className="text-2xl mb-1">🖼</div>
                  <p className="text-sm">Click to upload a screenshot</p>
                  <p className="text-xs mt-1">PNG, JPG, WebP — max 10 MB</p>
                </div>
              )}
            </div>

            {screenshotFile && !visualAnalysis && (
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="mt-2 w-full py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
              >
                {analyzing ? '🔍 Analyzing with Visual Analyst…' : '🔍 Analyze Screenshot'}
              </button>
            )}
            {analyzeError && <p className="text-red-400 text-xs mt-2">{analyzeError}</p>}
            {visualAnalysis && (
              <div className="mt-2 bg-slate-900 border border-pink-900 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-pink-400 text-xs font-semibold">🖼 Visual Analyst</span>
                  <span className="text-slate-500 text-xs">Analysis saved — will be shared with the board</span>
                </div>
                <p className="text-slate-400 text-xs line-clamp-3">{visualAnalysis.slice(0, 300)}…</p>
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
          >
            {loading ? 'Creating…' : 'Convene the Board →'}
          </button>
        </form>
      </div>
    </div>
  )
}
