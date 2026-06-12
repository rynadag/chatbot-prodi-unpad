// src/app/Admin/rag-detail-view.tsx
'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  X,
  Loader2,
  CornerDownLeft,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface RagDetailViewProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function RagDetailView({ onBack, onSuccess }: RagDetailViewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  // Handler: pilih file JSON
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 5 * 1024 * 1024) {
        toast.error('Ukuran file terlalu besar (Maks 5MB)');
        return;
      }
      if (!selected.name.endsWith('.json') && selected.type !== 'application/json') {
        toast.error('Hanya file JSON yang diizinkan');
        return;
      }
      setFile(selected);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handler: Import JSON ke KnowledgeSource
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.warning('Pilih file JSON terlebih dahulu.');
      return;
    }

    setIsImporting(true);
    setStep('Mengupload dan memproses file JSON...');

    try {
      const formData = new FormData();
      formData.append('importFile', file);

      const res = await fetch('http://localhost:3000/api/admin/import', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengimport data.');

      toast.success('Import berhasil!', { description: json.message });
      removeFile();
      onSuccess();
    } catch (error) {
      toast.error('Gagal Import', {
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
      });
    } finally {
      setIsImporting(false);
      setStep('');
    }
  };

  // Handler: Sync/Compile embedding ke Atlas
  const handleCompile = async () => {
    setIsSyncing(true);
    setStep('Menyinkronisasi embedding ke MongoDB Atlas...');

    try {
      const res = await fetch('http://localhost:3000/api/admin/compile', {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal melakukan sinkronisasi.');

      toast.success('Sinkronisasi Berhasil!', { description: json.message });
    } catch (error) {
      toast.error('Gagal Sync', {
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
      });
    } finally {
      setIsSyncing(false);
      setStep('');
    }
  };

  return (
    <div className='p-4 sm:p-6 lg:p-8 h-full flex flex-col animate-in fade-in duration-300 overflow-y-auto'>
      <div className='max-w-3xl mx-auto w-full'>

        {/* Header */}
        <div className='mb-6 flex justify-between items-center bg-white/40 backdrop-blur-md p-4 rounded-xl border border-white/50 shadow-sm'>
          <div>
            <h1 className='text-3xl font-bold text-[#13484f] tracking-tight flex items-center gap-2'>
              <UploadCloud className='w-8 h-8 text-primary' />
              Upload & Auto-RAG
            </h1>
            <p className='text-gray-600 mt-1 font-medium opacity-80 text-sm'>
              Import data JSON, lalu sync embedding vector ke MongoDB Atlas.
            </p>
          </div>
          <button
            onClick={onBack}
            disabled={isImporting || isSyncing}
            className='flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-[#13484f]
                       glass-card hover:bg-white/40 border-white/50 shadow-sm transition-all active:scale-95 disabled:opacity-50'
          >
            <CornerDownLeft className='w-4 h-4' />
            Batal
          </button>
        </div>

        {/* Card 1: Import JSON */}
        <div className='glass-card p-6 sm:p-8 relative overflow-hidden shadow-xl mb-6'>
          <div className='absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none' />

          <h2 className='text-lg font-bold text-[#13484f] mb-1 flex items-center gap-2'>
            <UploadCloud className='w-5 h-5 text-primary' />
            Step 1 — Import Data JSON
          </h2>
          <p className='text-sm text-gray-500 mb-6'>
            Upload file JSON berisi array objek dengan field <code className='bg-gray-100 px-1 rounded'>tag</code> dan <code className='bg-gray-100 px-1 rounded'>content_text</code>.
          </p>

          <form onSubmit={handleImport} className='space-y-6 relative z-10'>
            {/* Dropzone */}
            <div
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer relative group
                ${file
                  ? 'border-primary bg-primary/5 shadow-inner'
                  : 'border-white/60 bg-white/30 hover:border-primary/50 hover:bg-white/50 shadow-sm'}`}
            >
              <input
                ref={fileInputRef}
                type='file'
                accept='.json,application/json'
                onChange={handleFileChange}
                className='absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10'
                disabled={isImporting}
              />

              {!file ? (
                <div className='flex flex-col items-center gap-4'>
                  <div className='p-5 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform shadow-sm border border-primary/20'>
                    <UploadCloud className='w-10 h-10' />
                  </div>
                  <div>
                    <p className='font-bold text-[#13484f] text-lg'>
                      Klik atau Tarik File JSON ke sini
                    </p>
                    <p className='text-xs text-gray-500 mt-2 max-w-xs mx-auto leading-relaxed'>
                      Maksimal 5MB. Format: <code>[{`{"tag":"...", "content_text":"..."}`}, ...]</code>
                    </p>
                  </div>
                </div>
              ) : (
                <div className='flex items-center justify-between bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-md border border-primary/30 relative z-20 animate-in zoom-in-95 duration-200'>
                  <div className='flex items-center gap-4'>
                    <div className='p-3 bg-green-100 text-green-600 rounded-xl shadow-inner'>
                      <FileText className='w-8 h-8' />
                    </div>
                    <div className='text-left'>
                      <p className='font-bold text-gray-800 truncate max-w-[250px] text-sm'>
                        {file.name}
                      </p>
                      <p className='text-xs text-gray-500 mt-0.5'>
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type='button'
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeFile(); }}
                    disabled={isImporting}
                    className='p-2.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-all active:scale-90'
                  >
                    <X className='w-6 h-6' />
                  </button>
                </div>
              )}
            </div>

            <button
              type='submit'
              disabled={isImporting || !file}
              style={!(isImporting || !file) ? { background: 'linear-gradient(to right, var(--primary), var(--accent))' } : {}}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-3 active:scale-[0.98]
                ${isImporting || !file
                  ? 'bg-gray-300 cursor-not-allowed opacity-70 shadow-none'
                  : 'hover:brightness-110 hover:shadow-lg'
                }`}
            >
              {isImporting ? (
                <>
                  <Loader2 className='w-5 h-5 animate-spin' />
                  <span className='animate-pulse'>{step}</span>
                </>
              ) : (
                <>
                  <UploadCloud className='w-5 h-5' />
                  <span>Import JSON ke Database</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Card 2: Compile/Sync Embedding */}
        <div className='glass-card p-6 sm:p-8 relative overflow-hidden shadow-xl'>
          <div className='absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-accent/5 rounded-full blur-3xl pointer-events-none' />

          <h2 className='text-lg font-bold text-[#13484f] mb-1 flex items-center gap-2'>
            <RefreshCw className='w-5 h-5 text-accent' />
            Step 2 — Sync & Compile Embedding
          </h2>
          <p className='text-sm text-gray-500 mb-6'>
            Setelah import selesai, klik tombol ini untuk membuat/memperbarui vektor embedding di MongoDB Atlas. Proses ini bisa memakan beberapa menit tergantung jumlah data.
          </p>

          <div className='bg-amber-50/40 backdrop-blur-sm border border-amber-200 rounded-2xl p-4 flex gap-3 shadow-sm mb-6'>
            <CheckCircle2 className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
            <div className='text-sm text-amber-900 leading-relaxed font-medium'>
              <strong className='text-amber-700 block mb-1'>Kapan perlu di-Sync?</strong>
              Setiap kali ada data baru yang diimport atau diubah. Chatbot hanya bisa menjawab berdasarkan data yang sudah tersinkronisasi.
            </div>
          </div>

          <button
            onClick={handleCompile}
            disabled={isSyncing}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-3 active:scale-[0.98]
              ${isSyncing
                ? 'bg-gray-300 cursor-not-allowed opacity-70 shadow-none'
                : 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:shadow-emerald-500/30 hover:brightness-110'
              }`}
          >
            {isSyncing ? (
              <>
                <Loader2 className='w-5 h-5 animate-spin' />
                <span className='animate-pulse'>{step}</span>
              </>
            ) : (
              <>
                <RefreshCw className='w-5 h-5' />
                <span>Sync / Compile Embedding Sekarang</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}