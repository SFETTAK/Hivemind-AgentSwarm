// Settings - Configuration panel for API keys, model profiles, endpoints, and costs
import { useState, useEffect, useCallback, memo } from 'react'

// ============================================================================
// Types
// ============================================================================

interface ModelOption {
  id: string
  name: string
  provider: string
  cost: string
}

interface Profile {
  name: string
  icon: string
  color: string
  description: string
  FORGE: string
  SENTINEL: string
  ORACLE: string
  NEXUS: string
  SCRIBE: string
}

interface CostBreakdown {
  sessionId?: string
  agent: string
  formatted: string
}

interface Costs {
  total: string
  breakdown: CostBreakdown[]
}

interface SettingsData {
  [key: string]: string | boolean | undefined
}

export interface SettingsProps {
  onClose: () => void
  apiBase: string
}

// ============================================================================
// Constants
// ============================================================================

// Available models by provider (NATO-friendly only)
const AVAILABLE_MODELS: ModelOption[] = [
  // --- OpenRouter (aggregator) ---
  { id: 'openrouter/anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'OpenRouter', cost: '$$' },
  { id: 'openrouter/anthropic/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'OpenRouter', cost: '$$' },
  { id: 'openrouter/anthropic/claude-3-5-haiku', name: 'Claude 3.5 Haiku', provider: 'OpenRouter', cost: '$' },
  { id: 'openrouter/google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', provider: 'OpenRouter', cost: '$$' },
  { id: 'openrouter/google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'OpenRouter', cost: '$' },
  { id: 'openrouter/openai/gpt-4o', name: 'GPT-4o', provider: 'OpenRouter', cost: '$$' },
  { id: 'openrouter/openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenRouter', cost: '$' },
  { id: 'openrouter/meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'OpenRouter', cost: '$' },
  { id: 'openrouter/mistralai/mistral-large-2411', name: 'Mistral Large', provider: 'OpenRouter', cost: '$$' },
  { id: 'openrouter/mistralai/codestral-2501', name: 'Codestral', provider: 'OpenRouter', cost: '$' },
  { id: 'openrouter/deepseek/deepseek-chat-v3.1', name: 'DeepSeek V3.1', provider: 'OpenRouter', cost: '$' },
  
  // --- Anthropic Direct ---
  { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic', cost: '$$' },
  { id: 'anthropic/claude-opus-4.5-20250514', name: 'Claude Opus 4.5', provider: 'Anthropic', cost: '$$' },
  { id: 'anthropic/claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'Anthropic', cost: '$' },
  
  // --- OpenAI Direct ---
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', cost: '$$' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', cost: '$' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', cost: '$$' },
  { id: 'openai/o1-preview', name: 'o1 Preview', provider: 'OpenAI', cost: '$$$' },
  { id: 'openai/o1-mini', name: 'o1 Mini', provider: 'OpenAI', cost: '$$' },
  
  // --- Google/Gemini Direct ---
  { id: 'gemini/gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro', provider: 'Gemini', cost: '$$' },
  { id: 'gemini/gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Gemini', cost: '$' },
  { id: 'gemini/gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Gemini', cost: '$$' },
  
  // --- Ollama (Local) ---
  { id: 'ollama/llama3.3:70b', name: 'Llama 3.3 70B', provider: 'Ollama', cost: 'FREE' },
  { id: 'ollama/llama3:8b', name: 'Llama 3 8B', provider: 'Ollama', cost: 'FREE' },
  { id: 'ollama/codellama:34b', name: 'CodeLlama 34B', provider: 'Ollama', cost: 'FREE' },
  { id: 'ollama/codellama:13b', name: 'CodeLlama 13B', provider: 'Ollama', cost: 'FREE' },
  { id: 'ollama/mistral-nemo', name: 'Mistral Nemo', provider: 'Ollama', cost: 'FREE' },
  { id: 'ollama/mistral:7b', name: 'Mistral 7B', provider: 'Ollama', cost: 'FREE' },
  { id: 'ollama/gemma2:27b', name: 'Gemma 2 27B', provider: 'Ollama', cost: 'FREE' },
  
  // --- LocalAI (Custom) ---
  { id: 'localai/gpt-4', name: 'LocalAI GPT-4', provider: 'LocalAI', cost: 'FREE' },
  { id: 'localai/mistral-nemo', name: 'LocalAI Mistral', provider: 'LocalAI', cost: 'FREE' },
]

// Group models by provider for the dropdown
const PROVIDERS = ['OpenRouter', 'Anthropic', 'OpenAI', 'Gemini', 'Ollama', 'LocalAI']

// Default speed profiles (NATO-friendly)
const DEFAULT_PROFILES: Record<number, Profile> = {
  1: { // Cruise
    name: 'Cruise',
    icon: '🐢',
    color: '#00ff88',
    description: 'Budget mode - Haiku & GPT-4o Mini',
    FORGE: 'openrouter/anthropic/claude-3-5-haiku',
    SENTINEL: 'openrouter/anthropic/claude-3-5-haiku',
    ORACLE: 'openrouter/openai/gpt-4o-mini',
    NEXUS: 'openrouter/openai/gpt-4o-mini',
    SCRIBE: 'openrouter/google/gemini-2.0-flash-001',
  },
  2: { // Fast
    name: 'Fast',
    icon: '🐇',
    color: '#ffcc00',
    description: 'Balanced - Sonnet for code, Haiku for support',
    FORGE: 'openrouter/anthropic/claude-sonnet-4',
    SENTINEL: 'openrouter/anthropic/claude-sonnet-4',
    ORACLE: 'openrouter/anthropic/claude-3-5-haiku',
    NEXUS: 'openrouter/anthropic/claude-3-5-haiku',
    SCRIBE: 'openrouter/anthropic/claude-3-5-haiku',
  },
  3: { // Turbo
    name: 'Turbo',
    icon: '🚀',
    color: '#ff6b6b',
    description: 'Power mode - Opus 4.5 lead, Sonnet support',
    FORGE: 'openrouter/anthropic/claude-opus-4.5',
    SENTINEL: 'openrouter/anthropic/claude-sonnet-4',
    ORACLE: 'openrouter/anthropic/claude-sonnet-4',
    NEXUS: 'openrouter/anthropic/claude-sonnet-4',
    SCRIBE: 'openrouter/anthropic/claude-sonnet-4',
  },
  4: { // Cosmic
    name: 'Cosmic',
    icon: '💎',
    color: '#a855f7',
    description: 'Maximum power - all Opus 4.5',
    FORGE: 'openrouter/anthropic/claude-opus-4.5',
    SENTINEL: 'openrouter/anthropic/claude-opus-4.5',
    ORACLE: 'openrouter/anthropic/claude-opus-4.5',
    NEXUS: 'openrouter/anthropic/claude-opus-4.5',
    SCRIBE: 'openrouter/anthropic/claude-opus-4.5',
  },
}

const AGENTS = ['FORGE', 'SENTINEL', 'ORACLE', 'NEXUS', 'SCRIBE'] as const

// ============================================================================
// Component
// ============================================================================

function SettingsComponent({ onClose, apiBase }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsData>({})
  const [profiles, setProfiles] = useState<Record<number, Profile>>(DEFAULT_PROFILES)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profiles')
  const [editingProfile, setEditingProfile] = useState<number | null>(null)
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})
  const [costs, setCosts] = useState<Costs>({ total: '$0.00', breakdown: [] })

  // Load settings and profiles
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${apiBase}/api/settings`).then(r => r.json()),
      fetch(`${apiBase}/api/costs`).then(r => r.json()),
    ]).then(([settingsData, costsData]) => {
      if (settingsData.settings) {
        setSettings(settingsData.settings)
        // Load saved profiles if they exist
        if (settingsData.settings.SPEED_PROFILES) {
          try {
            const savedProfiles = JSON.parse(settingsData.settings.SPEED_PROFILES as string)
            setProfiles(prev => ({ ...prev, ...savedProfiles }))
          } catch (e) { /* ignore parse errors */ }
        }
      }
      if (costsData) setCosts(costsData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [apiBase])

  const handleSettingChange = useCallback((key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  const handleProfileChange = useCallback((level: number, agent: string, model: string) => {
    setProfiles(prev => ({
      ...prev,
      [level]: { ...prev[level], [agent]: model }
    }))
    setSaved(false)
  }, [])

  const saveAll = useCallback(async () => {
    setSaving(true)
    try {
      // Save settings with profiles embedded
      const toSave = {
        ...settings,
        SPEED_PROFILES: JSON.stringify(profiles)
      }
      await fetch(`${apiBase}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: toSave })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error('Save failed:', e)
    }
    setSaving(false)
  }, [settings, profiles, apiBase])

  const resetCosts = useCallback(async () => {
    if (confirm('Reset all cost tracking?')) {
      await fetch(`${apiBase}/api/costs/reset`, { method: 'POST' })
      setCosts({ total: '$0.00', breakdown: [] })
    }
  }, [apiBase])

  const tabs = [
    { id: 'profiles', label: '🎚️ Speed Profiles', icon: '🎚️' },
    { id: 'api', label: '🔑 API Keys', icon: '🔑' },
    { id: 'endpoints', label: '🌐 Endpoints', icon: '🌐' },
    { id: 'costs', label: '💰 Costs', icon: '💰' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl" style={{ backgroundColor: '#131920', border: '1px solid #2d3748' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2d3748' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <span className="text-lg font-semibold text-white">Settings</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2" style={{ borderBottom: '1px solid #2d3748', background: '#0d1117' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                activeTab === tab.id ? 'bg-[#00d4ff22] text-[#00d4ff]' : 'text-zinc-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
          {loading ? (
            <div className="text-center py-12 text-zinc-500">Loading...</div>
          ) : (
            <>
              {/* PROFILES TAB */}
              {activeTab === 'profiles' && (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-500 mb-4">
                    Customize what models each speed level uses. Click a profile to edit.
                  </p>
                  
                  {[1, 2, 3, 4].map(level => {
                    const profile = profiles[level]
                    const isEditing = editingProfile === level
                    
                    return (
                      <div
                        key={level}
                        className="rounded-lg overflow-hidden"
                        style={{ border: `1px solid ${isEditing ? profile.color : '#2d3748'}` }}
                      >
                        {/* Profile Header - Clickable */}
                        <button
                          onClick={() => setEditingProfile(isEditing ? null : level)}
                          className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-white/5"
                          style={{ background: isEditing ? `${profile.color}11` : '#0d1117' }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                              style={{ backgroundColor: `${profile.color}22`, border: `1px solid ${profile.color}44` }}
                            >
                              {profile.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{level}. {profile.name}</span>
                                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: `${profile.color}22`, color: profile.color }}>
                                  Speed {level}
                                </span>
                              </div>
                              <div className="text-xs text-zinc-500">{profile.description}</div>
                            </div>
                          </div>
                          <span className="text-zinc-500">{isEditing ? '▼' : '▶'}</span>
                        </button>
                        
                        {/* Expanded Editor */}
                        {isEditing && (
                          <div className="p-4 space-y-3" style={{ background: '#0a0e14', borderTop: `1px solid ${profile.color}33` }}>
                            {/* Quick info */}
                            <div className="flex gap-4 text-xs text-zinc-500 mb-3">
                              <input
                                type="text"
                                value={profile.description}
                                onChange={e => setProfiles(prev => ({
                                  ...prev,
                                  [level]: { ...prev[level], description: e.target.value }
                                }))}
                                className="flex-1 bg-transparent border-b border-zinc-700 focus:border-[#00d4ff] outline-none text-zinc-400 pb-1"
                                placeholder="Profile description..."
                              />
                            </div>
                            
                            {/* Agent Model Selectors - Compact Grid */}
                            <div className="grid grid-cols-5 gap-2">
                              {AGENTS.map(agent => (
                                <div key={agent} className="text-center">
                                  <div className="text-xs text-zinc-500 mb-1">{agent}</div>
                                  <select
                                    value={profile[agent]}
                                    onChange={e => handleProfileChange(level, agent, e.target.value)}
                                    className="w-full text-xs p-2 rounded bg-[#131920] border border-zinc-700 text-white outline-none focus:border-[#00d4ff]"
                                    style={{ fontSize: '10px' }}
                                  >
                                    {PROVIDERS.map(provider => (
                                      <optgroup key={provider} label={`── ${provider} ──`}>
                                        {AVAILABLE_MODELS.filter(m => m.provider === provider).map(m => (
                                          <option key={m.id} value={m.id}>
                                            {m.name} {m.cost}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* API KEYS TAB */}
              {activeTab === 'api' && (
                <div className="space-y-4">
                  {[
                    { key: 'OPENROUTER_API_KEY', label: 'OpenRouter', placeholder: 'sk-or-v1-...', help: 'openrouter.ai/keys' },
                    { key: 'ANTHROPIC_API_KEY', label: 'Anthropic', placeholder: 'sk-ant-...', help: 'console.anthropic.com' },
                    { key: 'OPENAI_API_KEY', label: 'OpenAI', placeholder: 'sk-...', help: 'platform.openai.com' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-sm text-zinc-400 mb-1">{field.label}</label>
                      <div className="flex gap-2">
                        <input
                          type={showPassword[field.key] ? 'text' : 'password'}
                          value={(settings[field.key] as string) || ''}
                          onChange={e => handleSettingChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="flex-1 px-3 py-2 rounded-lg bg-[#0d1117] border border-zinc-700 text-white text-sm outline-none focus:border-[#00d4ff]"
                        />
                        <button
                          onClick={() => setShowPassword(p => ({ ...p, [field.key]: !p[field.key] }))}
                          className="px-3 py-2 rounded-lg bg-[#0d1117] border border-zinc-700 text-zinc-500 hover:text-white"
                        >
                          {showPassword[field.key] ? '🙈' : '👁️'}
                        </button>
                      </div>
                      <div className="text-xs text-zinc-600 mt-1">{field.help}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ENDPOINTS TAB */}
              {activeTab === 'endpoints' && (
                <div className="space-y-4">
                  {[
                    { key: 'MCP_SERVER_URL', label: 'Hivemind MCP Server', placeholder: 'http://127.0.0.1:8000' },
                    { key: 'API_SERVER_URL', label: 'Dashboard API', placeholder: 'http://localhost:3001' },
                    { key: 'OLLAMA_ENDPOINT', label: 'Ollama (Local Models)', placeholder: 'http://localhost:11434' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-sm text-zinc-400 mb-1">{field.label}</label>
                      <input
                        type="text"
                        value={(settings[field.key] as string) || ''}
                        onChange={e => handleSettingChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-zinc-700 text-white text-sm outline-none focus:border-[#00d4ff]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* COSTS TAB */}
              {activeTab === 'costs' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg" style={{ background: '#0d1117', border: '1px solid #2d3748' }}>
                    <div className="text-sm text-zinc-500 mb-1">Total Session Cost</div>
                    <div className="text-3xl font-bold" style={{ color: '#ffcc00' }}>{costs.total}</div>
                  </div>
                  
                  {costs.breakdown && costs.breakdown.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm text-zinc-500">By Agent</div>
                      {costs.breakdown.map((item, i) => (
                        <div key={item.sessionId || i} className="flex justify-between p-3 rounded-lg" style={{ background: '#0d1117', border: '1px solid #2d3748' }}>
                          <span className="text-zinc-400">{item.agent}</span>
                          <span style={{ color: '#00ff88' }}>{item.formatted}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <button
                    onClick={resetCosts}
                    className="px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    🗑️ Reset Costs
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid #2d3748', background: '#0d1117' }}>
          <div className="text-sm">
            {saved && <span className="text-green-400">✓ Saved!</span>}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-zinc-500 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveAll}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'linear-gradient(135deg, #00d4ff 0%, #a855f7 100%)', color: '#fff', opacity: saving ? 0.5 : 1 }}
            >
              {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Settings = memo(SettingsComponent)

