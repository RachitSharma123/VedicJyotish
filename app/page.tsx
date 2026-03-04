'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, fetchJson } from './lib/fetch-json';

type AIProvider = 'deepseek' | 'openrouter' | 'zai' | 'kimi';

type PrashnaSnapshot = {
  lagnaSign: string;
  lagnaLord: string;
  moonSign: string;
  relevanceHouses: string[];
  obstacleHouses: string[];
  localSiderealTime: string;
  rawAscendantDegrees: number;
  rawMoonDegrees: number;
  calculationNote: string;
};

type BirthChartResponse = { ok: true; interpretation: string; prashna: PrashnaSnapshot };
type ModelsResponse = { ok: true; models: string[]; defaultModel: string };

const PROVIDER_LABELS: Record<AIProvider, string> = {
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  zai: 'Z.ai (Zhipu)',
  kimi: 'Kimi (Moonshot)',
};

export default function Page() {
  const [isDark, setIsDark] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [direction, setDirection] = useState('North');
  const [question, setQuestion] = useState('');

  const [provider, setProvider] = useState<AIProvider>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);

  const [result, setResult] = useState('');
  const [prashna, setPrashna] = useState<PrashnaSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = window.localStorage.getItem('theme');
    const initialDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(initialDark);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    window.localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const canSubmit = useMemo(
    () => !!birthDate && !!birthTime && !!birthPlace && !!question.trim() && !!provider && !!model,
    [birthDate, birthTime, birthPlace, question, provider, model]
  );

  async function loadModels() {
    setModelsLoading(true);
    setError('');

    try {
      const data = await fetchJson<ModelsResponse>(
        '/api/models',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, apiKey }),
        },
        { retries: 1, timeoutMs: 12000 }
      );

      setModels(data.models);
      setModel((current) => current || data.defaultModel || data.models[0] || '');
    } catch (err) {
      setModels([]);
      if (err instanceof ApiError) {
        setError(`Model fetch failed: ${err.message}`);
      } else {
        setError('Unable to load models from provider.');
      }
    } finally {
      setModelsLoading(false);
    }
  }

  useEffect(() => {
    setModels([]);
    setModel('');
  }, [provider]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await fetchJson<BirthChartResponse>(
        '/api/birth-chart',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, birthDate, birthTime, birthPlace, direction, question, provider, apiKey, model }),
        },
        { retries: 2, timeoutMs: 20000 }
      );

      setResult(data.interpretation);
      setPrashna(data.prashna);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message}${err.requestId ? ` (requestId: ${err.requestId})` : ''}`);
      } else {
        setError('Unable to generate chart right now. Please retry in a few seconds.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="hero">
        <div>
          <h1 className="title">🔮 VedicJyotish · Cosmic Prashna Console</h1>
          <p className="subtitle">Modern interface, traditional logic: Lagna, Moon, houses, timing & remedies.</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => setIsDark((v) => !v)}>
          {isDark ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>

      <div className="layout-grid">
        <form className="card card-strong form-grid" onSubmit={onSubmit}>
          <h3 className="section-title">AI Provider Access</h3>
          <label>
            Provider
            <select value={provider} onChange={(e) => setProvider(e.target.value as AIProvider)}>
              {Object.entries(PROVIDER_LABELS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label>
            API key (session only)
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Paste ${PROVIDER_LABELS[provider]} key`}
            />
          </label>

          <div className="row">
            <label style={{ flex: 1 }}>
              Model (live list)
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">{modelsLoading ? 'Loading models…' : 'Select model'}</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-secondary" type="button" onClick={loadModels} disabled={modelsLoading}>
              {modelsLoading ? 'Refreshing…' : 'Fetch Models'}
            </button>
          </div>

          <hr />

          <h3 className="section-title">Prashna Inputs</h3>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
          </label>
          <div className="row" style={{ alignItems: 'stretch' }}>
            <label style={{ flex: 1 }}>
              Date
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </label>
            <label style={{ flex: 1 }}>
              Time
              <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
            </label>
          </div>

          <label>
            Location
            <input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} placeholder="City, Country" />
          </label>

          <label>
            Direction faced
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option>North</option>
              <option>East</option>
              <option>South</option>
              <option>West</option>
              <option>North-East</option>
              <option>North-West</option>
              <option>South-East</option>
              <option>South-West</option>
            </select>
          </label>

          <label>
            PrashnaKundali Question
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Write your exact question (e.g., Will this relationship progress to marriage?)"
              rows={4}
            />
          </label>
          <p className="muted">You can edit any field above before submit — latest changes are accepted.</p>

          <button className="btn" type="submit" disabled={!canSubmit || loading}>
            {loading ? 'Running ephemeris…' : 'Generate Prashna Chart Reading'}
          </button>

          {error ? <p className="error">{error}</p> : <p className="muted">Tip: fetch models first, then run chart.</p>}
        </form>

        <div className="form-grid">
          <section className="card card-strong result">{result || 'Your prashna interpretation will appear here.'}</section>

          {prashna ? (
            <section className="card">
              <h3 className="section-title">Calculated Prashna Snapshot</h3>
              <div className="stat-grid">
                <div className="stat">
                  <div className="k">Lagna</div>
                  <div className="v">
                    {prashna.lagnaSign} · {prashna.lagnaLord}
                  </div>
                </div>
                <div className="stat">
                  <div className="k">Moon Sign</div>
                  <div className="v">{prashna.moonSign}</div>
                </div>
                <div className="stat">
                  <div className="k">Sidereal Time</div>
                  <div className="v">{prashna.localSiderealTime}</div>
                </div>
                <div className="stat">
                  <div className="k">Asc / Moon°</div>
                  <div className="v">
                    {prashna.rawAscendantDegrees}° / {prashna.rawMoonDegrees}°
                  </div>
                </div>
                <div className="stat" style={{ gridColumn: '1 / -1' }}>
                  <div className="k">Relevant Houses</div>
                  <div className="v">{prashna.relevanceHouses.join(', ')}</div>
                </div>
                <div className="stat" style={{ gridColumn: '1 / -1' }}>
                  <div className="k">Obstacle Houses</div>
                  <div className="v">{prashna.obstacleHouses.join(', ')}</div>
                </div>
                <div className="stat" style={{ gridColumn: '1 / -1' }}>
                  <div className="k">Calculation Note</div>
                  <div className="v">{prashna.calculationNote}</div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
