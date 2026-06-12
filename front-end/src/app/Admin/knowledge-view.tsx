'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
  useRef,
} from 'react';
import {
  DatabaseZap,
  Trash2,
  Search,
  Pencil,
  FileText,
  PlusCircle,
  Save,
  CornerDownLeft,
  Loader2,
  BookOpen,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

// ===== INTERFACES =====
interface KnowledgeItem {
  _id: string;
  tag: string;
  content_text: string;
  last_compiled?: string;
  embedding_provider?: string | null;
  embedding_model?: string | null;
  content_hash?: string | null;
}

interface KnowledgeViewProps {
  onBack: () => void;
}

interface KnowledgeDetailPanelProps {
  item: KnowledgeItem | null;
  mode: 'view' | 'edit' | 'add';
  onSave: (formData: { tag: string; content_text: string }, isNew: boolean) => void;
  onCancel: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}

// ── Markdown Guide Modal ──────────────────────────────────────
const MarkdownGuideModal = ({ onClose }: { onClose: () => void }) => (
  <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
    <div className='bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-white/20 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200'>
      <div className='px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5'>
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg'>
            <BookOpen className='w-5 h-5 text-blue-600 dark:text-blue-400' />
          </div>
          <div>
            <h3 className='font-bold text-lg text-[#13484f]'>Panduan Format Konten</h3>
            <p className='text-xs text-gray-500'>Tips menulis content_text yang baik untuk RAG</p>
          </div>
        </div>
        <button onClick={onClose} className='p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400'>
          <X className='w-5 h-5' />
        </button>
      </div>
      <div className='p-6 overflow-y-auto space-y-6 bg-white/5 text-sm text-gray-700 dark:text-gray-300'>
        <div>
          <h4 className='font-bold text-[#13484f] mb-2'>Format Tag</h4>
          <p>Tag harus unik dan deskriptif. Contoh: <code className='bg-gray-100 px-1 rounded'>biaya_kuliah_s1</code>, <code className='bg-gray-100 px-1 rounded'>dosen_pembimbing</code>, <code className='bg-gray-100 px-1 rounded'>jadwal_sidang_2025</code></p>
        </div>
        <div>
          <h4 className='font-bold text-[#13484f] mb-2'>Format Q&A (Direkomendasikan)</h4>
          <pre className='bg-gray-100 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap'>
{`Tanya: Berapa biaya UKT S1?
Jawab: UKT S1 terdiri dari 8 golongan...

Tanya: Kapan batas herregistrasi?
Jawab: Batas herregistrasi adalah...`}
          </pre>
        </div>
        <div>
          <h4 className='font-bold text-[#13484f] mb-2'>Format Narasi</h4>
          <p>Tulis informasi secara langsung dan padat. Hindari header HTML, cukup gunakan paragraf yang informatif.</p>
        </div>
      </div>
      <div className='p-4 border-t border-white/10 bg-white/5 flex justify-end'>
        <button onClick={onClose} className='px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold'>
          Mengerti
        </button>
      </div>
    </div>
  </div>
);

// ── Input Field ───────────────────────────────────────────────
const InputField = ({
  label, name, value, onChange, isEditing, type = 'text', rows = 5, placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  isEditing: boolean;
  type?: string;
  rows?: number;
  placeholder?: string;
}) => (
  <div className='mb-4'>
    <label className='block text-sm font-medium text-[#13484f] mb-1'>{label}</label>
    {isEditing ? (
      type === 'textarea' ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          rows={rows}
          placeholder={placeholder}
          className='w-full bg-white/5 border border-[#13484f]/40 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#13484f]/30 focus:border-transparent transition-colors font-mono text-black placeholder-gray-400'
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className='w-full bg-white/5 border border-[#13484f]/40 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#13484f]/30 focus:border-transparent transition-colors text-black placeholder-gray-400'
        />
      )
    ) : (
      <div className='bg-white/5 p-4 rounded-lg text-sm leading-relaxed border border-[#13484f]/40 text-black overflow-x-auto backdrop-blur-sm'>
        <span className='whitespace-pre-wrap text-black'>{value}</span>
      </div>
    )}
  </div>
);

// ===== MAIN COMPONENT =====
export default function KnowledgeView({ onBack }: KnowledgeViewProps) {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [mode, setMode] = useState<'view' | 'edit' | 'add'>('view');
  const [isLoading, setIsLoading] = useState({ list: true, save: false });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const rootRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [panelHeight, setPanelHeight] = useState<number | undefined>(undefined);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  const calculatePanelHeight = useCallback(() => {
    if (window.innerWidth < 1024) { setPanelHeight(undefined); return; }
    const rootRect   = rootRef.current?.getBoundingClientRect();
    const headerRect = headerRef.current?.getBoundingClientRect();
    const available  = (rootRect?.height ?? window.innerHeight) - (headerRect?.height ?? 0);
    setPanelHeight(Math.max(360, available - 56));
  }, []);

  useEffect(() => {
    calculatePanelHeight();
    window.addEventListener('resize', calculatePanelHeight);
    const t = setTimeout(calculatePanelHeight, 120);
    return () => { window.removeEventListener('resize', calculatePanelHeight); clearTimeout(t); };
  }, [calculatePanelHeight]);

  // ── FETCH DATA ────────────────────────────────────────────
  const fetchKnowledgeItems = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(prev => ({ ...prev, list: true }));
      const res = await fetch('http://localhost:3000/api/admin/data', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) throw new Error('Gagal memuat data pengetahuan.');
      const data: KnowledgeItem[] = await res.json();
      setKnowledgeItems(data);
      setSelectedItem(prev => prev ?? (data.length > 0 ? data[0] : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan tidak diketahui.');
    } finally {
      if (!silent) setIsLoading(prev => ({ ...prev, list: false }));
    }
  }, []);

  useEffect(() => { fetchKnowledgeItems(); }, [fetchKnowledgeItems]);

  // ── SAVE ITEM ─────────────────────────────────────────────
  const handleSaveItem = useCallback(async (
    formData: { tag: string; content_text: string },
    isNew: boolean
  ) => {
    setIsLoading(prev => ({ ...prev, save: true }));
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew
      ? 'http://localhost:3000/api/admin/data'
      : `http://localhost:3000/api/admin/data/${selectedItem?._id}`;

    try {
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Gagal menyimpan data.');
      }
      const savedItem: KnowledgeItem = await res.json();
      await fetchKnowledgeItems(true);
      setSelectedItem(savedItem);
      toast.success(`"${savedItem.tag}" berhasil ${isNew ? 'dibuat' : 'diperbarui'}.`);
      setMode('view');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setIsLoading(prev => ({ ...prev, save: false }));
    }
  }, [selectedItem, fetchKnowledgeItems]);

  // ── DELETE ITEM ───────────────────────────────────────────
  const executeDeleteItem = useCallback(async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/admin/data/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Gagal menghapus data.');
      await fetchKnowledgeItems(true);
      setSelectedItem(null);
      setMode('view');
      toast.success('Item berhasil dihapus.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    }
  }, [fetchKnowledgeItems]);

  const handleDeleteItem = useCallback((id: string) => {
    if (!selectedItem) return;
    toast('Konfirmasi Hapus', {
      description: `Yakin ingin menghapus "${selectedItem.tag}" secara permanen?`,
      action: { label: 'Ya, Hapus', onClick: () => executeDeleteItem(id) },
      cancel: { label: 'Batal', onClick: () => {} },
      duration: 8000,
    });
  }, [selectedItem, executeDeleteItem]);

  const handleSelectItem    = useCallback((item: KnowledgeItem) => { setSelectedItem(item); setMode('view'); }, []);
  const handleAddInfoClick  = useCallback(() => { setSelectedItem(null); setMode('add'); }, []);
  const handleCancelAction  = useCallback(() => {
    if (mode === 'add' && knowledgeItems.length > 0) setSelectedItem(knowledgeItems[0]);
    setMode('view');
  }, [mode, knowledgeItems]);
  const handleEditClick     = useCallback(() => setMode('edit'), []);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return knowledgeItems;
    const q = searchQuery.toLowerCase();
    return knowledgeItems.filter(item =>
      item.tag.toLowerCase().includes(q) ||
      item.content_text.toLowerCase().includes(q)
    );
  }, [knowledgeItems, searchQuery]);

  return (
    <div ref={rootRef} className='p-4 sm:p-6 lg:p-8 max-h-3/4 flex flex-col'>
      <header ref={headerRef} className='mb-8 flex justify-between items-start glass-card p-6 border border-white/10'>
        <div>
          <h1 className='text-3xl font-bold text-[#13484f] tracking-tight'>Knowledge Base</h1>
          <p className='text-[#13484f] mt-1'>Manajemen basis pengetahuan chatbot prodi.</p>
        </div>
        <div className='flex items-center gap-3'>
          <button
            onClick={handleAddInfoClick}
            disabled={mode !== 'view'}
            className='flex items-center gap-2 bg-[#ED910C] hover:bg-[#13484f] text-white font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50'
          >
            <PlusCircle className='w-4 h-4' />
            <span>Tambah</span>
          </button>
          <button
            onClick={onBack}
            className='flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-medium bg-[#090909] text-white hover:brightness-105 transition-all'
          >
            <CornerDownLeft className='w-4 h-4' />
            <span>Kembali</span>
          </button>
        </div>
      </header>

      <section className='grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 flex-1 pb-3'>
        {/* Left list column */}
        <div className='lg:col-span-1 glass-card h-auto flex flex-col overflow-hidden'
          style={panelHeight ? { height: panelHeight } : undefined}>
          <div className='p-4 border-b border-white/10 bg-white/5'>
            <h2 className='text-sm font-semibold flex items-center mb-3 gap-2 text-[#13484f] uppercase tracking-wider'>
              <FileText className='w-4 h-4' /> Knowledge List ({filteredItems.length})
            </h2>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
              <input
                type='text'
                placeholder='Cari tag atau konten...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full bg-white/5 text-gray-700 rounded-lg border border-[#13484f]/40 pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-colors'
                disabled={mode !== 'view'}
              />
            </div>
          </div>
          <div className='overflow-y-auto flex-1 p-3 space-y-2'>
            {isLoading.list ? (
              <div className='flex justify-center items-center h-full text-gray-400'>
                <Loader2 className='w-8 h-8 animate-spin' />
              </div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <button
                  key={item._id}
                  onClick={() => handleSelectItem(item)}
                  disabled={mode !== 'view'}
                  className={`w-full text-left p-3 rounded-lg transition-all border ${
                    selectedItem?._id === item._id
                      ? 'bg-white/8 border-primary/40 bg-primary/5'
                      : 'border-transparent hover:bg-white/6'
                  }`}
                >
                  <p className='font-bold text-[#13484f] text-sm truncate mb-1'>{item.tag}</p>
                  <p className='text-xs text-gray-500 truncate'>
                    {item.content_text?.slice(0, 100)}...
                  </p>
                  <p className='text-[10px] text-gray-400 mt-1'>
                    {item.embedding_provider
                      ? `✅ Embedded (${item.embedding_provider})`
                      : '⚠️ Belum di-embed'}
                  </p>
                </button>
              ))
            ) : (
              <div className='text-center text-gray-400 p-8 text-sm'>
                <p>{error || 'Item pengetahuan tidak ditemukan.'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right detail column */}
        <div className='lg:col-span-2 glass-card h-auto flex flex-col overflow-hidden'
          style={panelHeight ? { height: panelHeight } : undefined}>
          <KnowledgeDetailPanel
            item={selectedItem}
            mode={mode}
            onSave={handleSaveItem}
            onCancel={handleCancelAction}
            onEdit={handleEditClick}
            onDelete={handleDeleteItem}
            isSaving={isLoading.save}
          />
        </div>
      </section>
    </div>
  );
}

// ===== DETAIL PANEL COMPONENT =====
const initialFormData = { tag: '', content_text: '' };

const KnowledgeDetailPanel = React.memo(function KnowledgeDetailPanel({
  item, mode, onSave, onCancel, onEdit, onDelete, isSaving,
}: KnowledgeDetailPanelProps) {
  const isAdding  = mode === 'add';
  const isEditing = mode === 'edit';
  const [formData, setFormData] = useState(initialFormData);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (item && !isAdding) {
      setFormData({ tag: item.tag, content_text: item.content_text });
    } else if (isAdding) {
      setFormData(initialFormData);
    }
  }, [item, mode, isAdding]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveClick = () => {
    if (!formData.tag || !formData.content_text) {
      toast.warning('Tag dan Konten tidak boleh kosong.');
      return;
    }
    onSave(formData, isAdding);
  };

  if (!item && !isAdding) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-gray-400 p-8'>
        <div className='p-6 bg-white/5 rounded-full mb-4'>
          <DatabaseZap className='w-10 h-10 text-gray-300' />
        </div>
        <p className='text-center'>Pilih item dari daftar atau klik <strong>Tambah</strong> untuk membuat baru.</p>
      </div>
    );
  }

  return (
    <>
      {showGuide && <MarkdownGuideModal onClose={() => setShowGuide(false)} />}
      <div className='flex flex-col h-full'>
        <header className='p-4 border-b border-white/10 flex justify-between items-center bg-white/5'>
          <div>
            <h3 className='font-bold text-[#13484f]'>
              {isAdding ? 'Tambah Pengetahuan Baru' : isEditing ? 'Edit Item' : item?.tag}
            </h3>
            {item && !isAdding && (
              <p className='text-xs text-gray-400 font-mono mt-0.5'>ID: {item._id}</p>
            )}
          </div>
          <div className='flex flex-wrap gap-2'>
            {(isAdding || isEditing) && (
              <button
                type='button'
                onClick={() => setShowGuide(true)}
                className='px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-sm font-medium'
              >
                Panduan
              </button>
            )}

            {isAdding || isEditing ? (
              <>
                <button
                  onClick={handleSaveClick}
                  disabled={isSaving}
                  className='px-3 py-1.5 bg-[#13484f] text-white rounded-lg text-sm font-medium hover:bg-[#0f6b66] transition-colors disabled:opacity-50 flex items-center gap-1'
                >
                  {isSaving ? <Loader2 className='w-3 h-3 animate-spin' /> : <Save className='w-3 h-3' />}
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
                <button
                  onClick={onCancel}
                  className='px-3 py-1.5 bg-white/10 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-1'
                >
                  <CornerDownLeft className='w-3 h-3' />
                  <span>Batal</span>
                </button>
              </>
            ) : (
              item && (
                <>
                  <button
                    onClick={onEdit}
                    className='px-3 py-1.5 bg-[#389EA9] text-blue-100 rounded-lg text-sm font-medium flex items-center gap-1'
                  >
                    <Pencil className='w-3 h-3' />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => onDelete(item._id)}
                    className='px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium flex items-center gap-1'
                  >
                    <Trash2 className='w-3 h-3' />
                    <span>Hapus</span>
                  </button>
                </>
              )
            )}
          </div>
        </header>

        <div className='flex-1 overflow-y-auto p-6 bg-white/5 space-y-4'>
          {/* Status embedding */}
          {item && !isAdding && (
            <div className='flex flex-wrap gap-2 mb-2'>
              <span className={`px-3 py-1 rounded-lg text-xs font-medium ${item.embedding_provider ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                {item.embedding_provider
                  ? `✅ Embedded — ${item.embedding_provider} / ${item.embedding_model}`
                  : '⚠️ Belum di-embed — Klik Sync/Compile'}
              </span>
              {item.last_compiled && (
                <span className='px-3 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700'>
                  🕒 Compiled: {new Date(item.last_compiled).toLocaleString()}
                </span>
              )}
            </div>
          )}

          <InputField
            label='Tag (Unik, tanpa spasi, gunakan underscore)'
            name='tag'
            value={formData.tag}
            onChange={handleChange}
            isEditing={isAdding || isEditing}
            placeholder='Contoh: biaya_kuliah_s1'
          />

          <InputField
            label='Konten Pengetahuan'
            name='content_text'
            value={formData.content_text}
            onChange={handleChange}
            isEditing={isAdding || isEditing}
            type='textarea'
            rows={16}
            placeholder='Tulis konten pengetahuan di sini. Gunakan format Q&A (Tanya:/Jawab:) untuk hasil terbaik.'
          />

          {(isAdding || isEditing) && (
            <p className='text-xs text-gray-400 text-right'>
              * Tekan tombol &ldquo;Panduan&rdquo; di atas untuk format penulisan.
            </p>
          )}
        </div>
      </div>
    </>
  );
});
