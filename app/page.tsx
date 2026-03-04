'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, fetchJson } from './lib/fetch-json';

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

export default function Page() {
  const [isDark, setIsDark] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [direction, setDirection] = useState('North');
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

  const canSubmit = useMemo(() => !!birthDate && !!birthTime && !!birthPlace, [birthDate, birthTime, birthPlace]);

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
          body: JSON.stringify({ name, birthDate, birthTime, birthPlace, direction }),
        },
        { retries: 2, timeoutMs: 12000 }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>VedicJyotish · Prashna Flow</h1>
        <button type="button" onClick={() => setIsDark((v) => !v)}>
          {isDark ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      <form className="card" onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" style={{ width: '100%' }} />
        </label>
        <label>
          Date
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          Time
          <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} style={{ width: '100%' }} />
        </label>
        <label>
          Location
          <input
            value={birthPlace}
            onChange={(e) => setBirthPlace(e.target.value)}
            placeholder="City, Country"
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Direction faced
          <select value={direction} onChange={(e) => setDirection(e.target.value)} style={{ width: '100%' }}>
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

        <button type="submit" disabled={!canSubmit || loading}>
          {loading ? 'Running ephemeris…' : 'Generate Prashna Chart Reading'}
        </button>

        {error ? <p style={{ color: '#ef4444', margin: 0 }}>{error}</p> : null}
      </form>

      <section className="card" style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', minHeight: 160 }}>
        {result || 'Your prashna interpretation will appear here.'}
      </section>

      {prashna ? (
        <section className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Calculated Prashna Snapshot</h3>
          <ul style={{ marginBottom: 0 }}>
            <li>Lagna: {prashna.lagnaSign} (lord: {prashna.lagnaLord})</li>
            <li>Moon sign: {prashna.moonSign}</li>
            <li>Local sidereal time: {prashna.localSiderealTime}</li>
            <li>Ascendant longitude: {prashna.rawAscendantDegrees}°</li>
            <li>Moon longitude: {prashna.rawMoonDegrees}°</li>
            <li>Relevant houses: {prashna.relevanceHouses.join(', ')}</li>
            <li>Obstacle houses: {prashna.obstacleHouses.join(', ')}</li>
            <li>{prashna.calculationNote}</li>
          </ul>
        </section>
      ) : null}
    </main>
  );
}
