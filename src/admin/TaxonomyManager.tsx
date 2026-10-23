import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, GripVertical, Eye, EyeOff, ArrowLeft, Check, X, AlertTriangle, Settings2 } from 'lucide-react'
import { AttributeManager } from './AttributeManager'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

interface Category {
  id: string
  name: string
  slug: string
  description: string
  seo_title: string | null
  seo_description: string | null
  icon_url: string | null
  sort_order: number
  is_active: boolean
  legacy_industry_id: string | null
  subcategories?: Subcategory[]
  _count?: number
}

interface Subcategory {
  id: string
  category_id: string
  name: string
  slug: string
  description: string
  sort_order: number
  is_active: boolean
}

interface BusinessType {
  id: string
  name: string
  slug: string
  sort_order: number
  is_active: boolean
}

type View = 'categories' | 'subcategories' | 'attributes' | 'business-types'

export function TaxonomyManager() {
  const [view, setView] = useState<View>('categories')
  const [categories, setCategories] = useState<Category[]>([])
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null)
  const [editingBusinessType, setEditingBusinessType] = useState<BusinessType | null>(null)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [showNewSubcategory, setShowNewSubcategory] = useState<string | null>(null)
  const [showNewBusinessType, setShowNewBusinessType] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!supabaseUrl || !supabaseAnonKey) return
    setLoading(true)
    try {
      const client = createClient(supabaseUrl, supabaseAnonKey)

      const { data: cats, error: catError } = await client
        .from('categories')
        .select('*, subcategories(*)')
        .order('sort_order')

      if (catError) throw catError
      setCategories(cats || [])

      const { data: bts, error: btError } = await client
        .from('business_type_vocabulary')
        .select('*')
        .order('sort_order')

      if (btError) throw btError
      setBusinessTypes(bts || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load taxonomy data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleToggleCategory = async (cat: Category) => {
    if (!supabaseUrl || !supabaseAnonKey) return
    const client = createClient(supabaseUrl, supabaseAnonKey)
    const { error } = await client
      .from('categories')
      .update({ is_active: !cat.is_active, updated_at: new Date().toISOString() })
      .eq('id', cat.id)

    if (error) {
      setError(`Failed to update category: ${error.message}`)
    } else {
      setSuccess(`Category "${cat.name}" ${cat.is_active ? 'deactivated' : 'activated'}`)
      fetchData()
    }
  }

  const handleDeleteCategory = async (cat: Category) => {
    if (!supabaseUrl || !supabaseAnonKey) return
    if (!confirm(`Are you sure you want to delete "${cat.name}"? This cannot be undone if no businesses are associated.`)) return

    const client = createClient(supabaseUrl, supabaseAnonKey)
    const { error } = await client
      .from('categories')
      .delete()
      .eq('id', cat.id)

    if (error) {
      setError(`Cannot delete: ${error.message}. Category may have associated businesses.`)
    } else {
      setSuccess(`Category "${cat.name}" deleted`)
      fetchData()
    }
  }

  const handleSaveCategory = async (cat: Category) => {
    if (!supabaseUrl || !supabaseAnonKey) return
    const client = createClient(supabaseUrl, supabaseAnonKey)
    const isNew = !cat.id

    const payload = {
      name: cat.name,
      slug: cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: cat.description,
      seo_title: cat.seo_title,
      seo_description: cat.seo_description,
      icon_url: cat.icon_url,
      sort_order: cat.sort_order,
      is_active: cat.is_active,
      updated_at: new Date().toISOString(),
    }

    const { error } = isNew
      ? await client.from('categories').insert(payload)
      : await client.from('categories').update(payload).eq('id', cat.id)

    if (error) {
      setError(`Failed to save category: ${error.message}`)
    } else {
      setSuccess(`Category "${cat.name}" ${isNew ? 'created' : 'updated'}`)
      setEditingCategory(null)
      setShowNewCategory(false)
      fetchData()
    }
  }

  const handleSaveSubcategory = async (sub: Subcategory) => {
    if (!supabaseUrl || !supabaseAnonKey) return
    const client = createClient(supabaseUrl, supabaseAnonKey)
    const isNew = !sub.id

    const payload = {
      category_id: sub.category_id,
      name: sub.name,
      slug: sub.slug || sub.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: sub.description,
      sort_order: sub.sort_order,
      is_active: sub.is_active,
      updated_at: new Date().toISOString(),
    }

    const { error } = isNew
      ? await client.from('subcategories').insert(payload)
      : await client.from('subcategories').update(payload).eq('id', sub.id)

    if (error) {
      setError(`Failed to save subcategory: ${error.message}`)
    } else {
      setSuccess(`Subcategory "${sub.name}" ${isNew ? 'created' : 'updated'}`)
      setEditingSubcategory(null)
      setShowNewSubcategory(null)
      fetchData()
    }
  }

  const handleSaveBusinessType = async (bt: BusinessType) => {
    if (!supabaseUrl || !supabaseAnonKey) return
    const client = createClient(supabaseUrl, supabaseAnonKey)
    const isNew = !bt.id

    const payload = {
      name: bt.name,
      slug: bt.slug || bt.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      sort_order: bt.sort_order,
      is_active: bt.is_active,
    }

    const { error } = isNew
      ? await client.from('business_type_vocabulary').insert(payload)
      : await client.from('business_type_vocabulary').update(payload).eq('id', bt.id)

    if (error) {
      setError(`Failed to save business type: ${error.message}`)
    } else {
      setSuccess(`Business type "${bt.name}" ${isNew ? 'created' : 'updated'}`)
      setEditingBusinessType(null)
      setShowNewBusinessType(false)
      fetchData()
    }
  }

  if (loading) {
    return <div className="taxonomy-loading">Loading taxonomy data...</div>
  }

  return (
    <div className="taxonomy-manager">
      <div className="taxonomy-header">
        <h2>Taxonomy Management</h2>
        <p>Manage the 22 master categories, subcategories, and business type vocabulary.</p>
      </div>

      {error && (
        <div className="taxonomy-alert taxonomy-error" onClick={() => setError(null)}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="taxonomy-alert taxonomy-success" onClick={() => setSuccess(null)}>
          <Check size={16} /> {success}
        </div>
      )}

      <div className="taxonomy-tabs">
        <button className={view === 'categories' ? 'active' : ''} onClick={() => setView('categories')}>
          Categories ({categories.length})
        </button>
        <button className={view === 'attributes' ? 'active' : ''} onClick={() => setView('attributes')}>
          Filters & Attributes
        </button>
        <button className={view === 'business-types' ? 'active' : ''} onClick={() => setView('business-types')}>
          Business Types ({businessTypes.length})
        </button>
      </div>

      {view === 'categories' && (
        <div className="taxonomy-content">
          <div className="taxonomy-toolbar">
            <button className="primary-button" onClick={() => setShowNewCategory(true)}>
              <Plus size={16} /> New Category
            </button>
          </div>

          {showNewCategory && (
            <CategoryForm
              category={null}
              onSave={handleSaveCategory}
              onCancel={() => setShowNewCategory(false)}
            />
          )}

          <div className="category-list">
            {categories.map((cat) => (
              <div key={cat.id} className={`category-item ${!cat.is_active ? 'inactive' : ''}`}>
                <div className="category-row">
                  <button
                    className="expand-btn"
                    onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                  >
                    {expandedCategory === cat.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <GripVertical size={14} className="drag-handle" />
                  <div className="category-info">
                    <span className="category-name">{cat.name}</span>
                    <span className="category-slug">/{cat.slug}</span>
                    {cat.subcategories && (
                      <span className="category-count">{cat.subcategories.length} subcategories</span>
                    )}
                  </div>
                  <div className="category-actions">
                    <button
                      className="icon-btn"
                      title={cat.is_active ? 'Deactivate' : 'Activate'}
                      onClick={() => handleToggleCategory(cat)}
                    >
                      {cat.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button
                      className="icon-btn"
                      title="Edit"
                      onClick={() => setEditingCategory(cat)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-btn danger"
                      title="Delete"
                      onClick={() => handleDeleteCategory(cat)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {expandedCategory === cat.id && (
                  <div className="subcategory-panel">
                    <div className="subcategory-header">
                      <h4>Subcategories</h4>
                      <button
                        className="secondary-button small"
                        onClick={() => setShowNewSubcategory(cat.id)}
                      >
                        <Plus size={14} /> Add Subcategory
                      </button>
                    </div>

                    {showNewSubcategory === cat.id && (
                      <SubcategoryForm
                        subcategory={null}
                        categoryId={cat.id}
                        onSave={handleSaveSubcategory}
                        onCancel={() => setShowNewSubcategory(null)}
                      />
                    )}

                    {cat.subcategories && cat.subcategories.length > 0 ? (
                      <div className="subcategory-list">
                        {cat.subcategories
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((sub) => (
                            <div key={sub.id} className={`subcategory-item ${!sub.is_active ? 'inactive' : ''}`}>
                              <span className="subcategory-name">{sub.name}</span>
                              <span className="subcategory-slug">/{sub.slug}</span>
                              <div className="subcategory-actions">
                                <button
                                  className="icon-btn"
                                  title="Edit"
                                  onClick={() => setEditingSubcategory(sub)}
                                >
                                  <Pencil size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="empty-state">No subcategories yet. Add one to organize this category.</div>
                    )}
                  </div>
                )}

                {editingCategory?.id === cat.id && (
                  <CategoryForm
                    category={cat}
                    onSave={handleSaveCategory}
                    onCancel={() => setEditingCategory(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'attributes' && (
        <div className="taxonomy-content">
          <AttributeManager />
        </div>
      )}

      {view === 'business-types' && (
        <div className="taxonomy-content">
          <div className="taxonomy-toolbar">
            <button className="primary-button" onClick={() => setShowNewBusinessType(true)}>
              <Plus size={16} /> New Business Type
            </button>
          </div>

          {showNewBusinessType && (
            <BusinessTypeForm
              businessType={null}
              onSave={handleSaveBusinessType}
              onCancel={() => setShowNewBusinessType(false)}
            />
          )}

          <div className="business-type-list">
            {businessTypes.map((bt) => (
              <div key={bt.id} className={`business-type-item ${!bt.is_active ? 'inactive' : ''}`}>
                <span className="business-type-name">{bt.name}</span>
                <span className="business-type-slug">/{bt.slug}</span>
                <div className="business-type-actions">
                  <button
                    className="icon-btn"
                    title="Edit"
                    onClick={() => setEditingBusinessType(bt)}
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {editingBusinessType && (
            <BusinessTypeForm
              businessType={editingBusinessType}
              onSave={handleSaveBusinessType}
              onCancel={() => setEditingBusinessType(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Category Form Component
function CategoryForm({ category, onSave, onCancel }: { category: Category | null; onSave: (cat: Category) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Category>(category || {
    id: '',
    name: '',
    slug: '',
    description: '',
    seo_title: '',
    seo_description: '',
    icon_url: '',
    sort_order: 0,
    is_active: true,
    legacy_industry_id: null,
  })

  return (
    <div className="taxonomy-form">
      <h4>{category ? 'Edit Category' : 'New Category'}</h4>
      <div className="form-grid">
        <label>
          Name *
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Agriculture, Agribusiness & Agricultural Technology" />
        </label>
        <label>
          Slug
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated if empty" />
        </label>
        <label className="full-width">
          Description
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </label>
        <label>
          SEO Title
          <input value={form.seo_title || ''} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} />
        </label>
        <label>
          SEO Description
          <input value={form.seo_description || ''} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} />
        </label>
        <label>
          Sort Order
          <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
        </label>
        <label>
          Icon URL
          <input value={form.icon_url || ''} onChange={(e) => setForm({ ...form, icon_url: e.target.value })} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>
      </div>
      <div className="form-actions">
        <button className="primary-button" onClick={() => onSave(form)}>Save</button>
        <button className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// Subcategory Form Component
function SubcategoryForm({ subcategory, categoryId, onSave, onCancel }: { subcategory: Subcategory | null; categoryId: string; onSave: (sub: Subcategory) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Subcategory>(subcategory || {
    id: '',
    category_id: categoryId,
    name: '',
    slug: '',
    description: '',
    sort_order: 0,
    is_active: true,
  })

  return (
    <div className="taxonomy-form subcategory-form">
      <div className="form-grid">
        <label>
          Name *
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          Slug
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated if empty" />
        </label>
        <label>
          Sort Order
          <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
        </label>
        <label>
          Description
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
      </div>
      <div className="form-actions">
        <button className="primary-button" onClick={() => onSave(form)}>Save</button>
        <button className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// Business Type Form Component
function BusinessTypeForm({ businessType, onSave, onCancel }: { businessType: BusinessType | null; onSave: (bt: BusinessType) => void; onCancel: () => void }) {
  const [form, setForm] = useState<BusinessType>(businessType || {
    id: '',
    name: '',
    slug: '',
    sort_order: 0,
    is_active: true,
  })

  return (
    <div className="taxonomy-form">
      <div className="form-grid">
        <label>
          Name *
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          Slug
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated if empty" />
        </label>
        <label>
          Sort Order
          <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>
      </div>
      <div className="form-actions">
        <button className="primary-button" onClick={() => onSave(form)}>Save</button>
        <button className="secondary-button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
