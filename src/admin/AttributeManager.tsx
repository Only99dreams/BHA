import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Plus, Pencil, Trash2, AlertTriangle, Check, Settings2 } from 'lucide-react'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

interface Category {
  id: string
  name: string
  slug: string
}

interface CategoryAttribute {
  id: string
  category_id: string
  subcategory_id: string | null
  key: string
  label: string
  data_type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'MULTI_ENUM' | 'RANGE'
  allowed_values: string[] | null
  is_searchable: boolean
  is_required: boolean
  sort_order: number
  is_active: boolean
  category_name?: string
}

const DATA_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'ENUM', 'MULTI_ENUM', 'RANGE'] as const

export function AttributeManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [attributes, setAttributes] = useState<CategoryAttribute[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [editing, setEditing] = useState<CategoryAttribute | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!supabaseUrl || !supabaseAnonKey) return
    setLoading(true)
    try {
      const client = createClient(supabaseUrl, supabaseAnonKey)

      const { data: cats } = await client.from('categories').select('id, name, slug').eq('is_active', true).order('sort_order')
      setCategories(cats || [])

      const { data: attrs, error: attrError } = await client
        .from('category_attributes')
        .select('*, categories!inner(name)')
        .order('sort_order')

      if (attrError) throw attrError
      setAttributes((attrs || []).map((a: any) => ({
        ...a,
        category_name: a.categories?.name,
      })))
    } catch (err: any) {
      setError(err.message || 'Failed to load attributes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredAttributes = selectedCategory
    ? attributes.filter((a) => a.category_id === selectedCategory)
    : attributes

  const handleSave = async (attr: CategoryAttribute) => {
    if (!supabaseUrl || !supabaseAnonKey) return
    const client = createClient(supabaseUrl, supabaseAnonKey)
    const isNew = !attr.id

    const payload = {
      category_id: attr.category_id,
      subcategory_id: attr.subcategory_id,
      key: attr.key,
      label: attr.label,
      data_type: attr.data_type,
      allowed_values: attr.allowed_values,
      is_searchable: attr.is_searchable,
      is_required: attr.is_required,
      sort_order: attr.sort_order,
      is_active: attr.is_active,
    }

    const { error } = isNew
      ? await client.from('category_attributes').insert(payload)
      : await client.from('category_attributes').update(payload).eq('id', attr.id)

    if (error) {
      setError(`Failed to save attribute: ${error.message}`)
    } else {
      setSuccess(`Attribute "${attr.label}" ${isNew ? 'created' : 'updated'}`)
      setEditing(null)
      setShowNew(false)
      fetchData()
    }
  }

  const handleDelete = async (attr: CategoryAttribute) => {
    if (!supabaseUrl || !supabaseAnonKey) return
    if (!confirm(`Delete attribute "${attr.label}"? This will remove all associated filter values.`)) return

    const client = createClient(supabaseUrl, supabaseAnonKey)
    const { error } = await client.from('category_attributes').delete().eq('id', attr.id)

    if (error) {
      setError(`Failed to delete: ${error.message}`)
    } else {
      setSuccess(`Attribute "${attr.label}" deleted`)
      fetchData()
    }
  }

  if (loading) return <div className="taxonomy-loading">Loading attributes...</div>

  return (
    <div className="attribute-manager">
      <div className="taxonomy-header">
        <h2><Settings2 size={18} /> Attribute & Filter Management</h2>
        <p>Define structured filters for each category. These power the contextual search filters on category pages.</p>
      </div>

      {error && <div className="taxonomy-alert taxonomy-error" onClick={() => setError(null)}><AlertTriangle size={16} /> {error}</div>}
      {success && <div className="taxonomy-alert taxonomy-success" onClick={() => setSuccess(null)}><Check size={16} /> {success}</div>}

      <div className="attr-toolbar">
        <label className="attr-filter-label">
          Category:
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="">All Categories ({attributes.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({attributes.filter((a) => a.category_id === c.id).length})</option>
            ))}
          </select>
        </label>
        <button className="primary-button" onClick={() => setShowNew(true)}><Plus size={16} /> New Attribute</button>
      </div>

      {showNew && (
        <AttributeForm
          attribute={null}
          categories={categories}
          defaultCategoryId={selectedCategory}
          onSave={handleSave}
          onCancel={() => setShowNew(false)}
        />
      )}

      <div className="attribute-list">
        {filteredAttributes.length === 0 && (
          <div className="empty-state">No attributes defined yet. Create your first filter for this category.</div>
        )}
        {filteredAttributes.map((attr) => (
          <div key={attr.id} className={`attribute-item ${!attr.is_active ? 'inactive' : ''}`}>
            <div className="attribute-row">
              <div className="attribute-info">
                <span className="attribute-label">{attr.label}</span>
                <span className="attribute-key">{attr.key}</span>
                <span className="attribute-type">{attr.data_type}</span>
                <span className="attribute-category">{attr.category_name}</span>
                {attr.is_searchable && <span className="badge badge-searchable">Searchable</span>}
                {attr.is_required && <span className="badge badge-required">Required</span>}
              </div>
              <div className="attribute-actions">
                <button className="icon-btn" onClick={() => setEditing(attr)}><Pencil size={14} /></button>
                <button className="icon-btn danger" onClick={() => handleDelete(attr)}><Trash2 size={14} /></button>
              </div>
            </div>
            {attr.allowed_values && attr.allowed_values.length > 0 && (
              <div className="attribute-values">
                {attr.allowed_values.map((v) => <span key={v} className="value-tag">{v}</span>)}
              </div>
            )}
            {editing?.id === attr.id && (
              <AttributeForm
                attribute={attr}
                categories={categories}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function AttributeForm({ attribute, categories, defaultCategoryId, onSave, onCancel }: {
  attribute: CategoryAttribute | null
  categories: Category[]
  defaultCategoryId?: string
  onSave: (attr: CategoryAttribute) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<CategoryAttribute>(attribute || {
    id: '',
    category_id: defaultCategoryId || '',
    subcategory_id: null,
    key: '',
    label: '',
    data_type: 'STRING',
    allowed_values: null,
    is_searchable: true,
    is_required: false,
    sort_order: 0,
    is_active: true,
  })
  const [allowedValuesText, setAllowedValuesText] = useState(
    attribute?.allowed_values?.join(', ') || ''
  )

  const needsValues = form.data_type === 'ENUM' || form.data_type === 'MULTI_ENUM'

  return (
    <div className="taxonomy-form attribute-form">
      <h4>{attribute ? 'Edit Attribute' : 'New Attribute'}</h4>
      <div className="form-grid">
        <label>
          Category *
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Select category...</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          Label *
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Equipment Type" />
        </label>
        <label>
          Key *
          <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_') })} placeholder="e.g. equipment_type" />
        </label>
        <label>
          Data Type *
          <select value={form.data_type} onChange={(e) => setForm({ ...form, data_type: e.target.value as any })}>
            {DATA_TYPES.map((dt) => <option key={dt} value={dt}>{dt}</option>)}
          </select>
        </label>
        {needsValues && (
          <label className="full-width">
            Allowed Values (comma-separated)
            <input value={allowedValuesText} onChange={(e) => setAllowedValuesText(e.target.value)} placeholder="e.g. Tractor, Harvester, Irrigation System" />
          </label>
        )}
        <label>
          Sort Order
          <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={form.is_searchable} onChange={(e) => setForm({ ...form, is_searchable: e.target.checked })} />
          Searchable
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={form.is_required} onChange={(e) => setForm({ ...form, is_required: e.target.checked })} />
          Required
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>
      </div>
      <div className="form-actions">
        <button className="primary-button" onClick={() => {
          const finalForm = { ...form }
          if (needsValues) {
            finalForm.allowed_values = allowedValuesText.split(',').map((v) => v.trim()).filter(Boolean)
          }
          onSave(finalForm)
        }}>Save</button>
        <button className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
