import { 
  FileUp, 
  FileDown, 
  ClipboardPaste, 
  Trash2,
  FileText,
  Gavel,
  PartyPopper
} from 'lucide-react';
import { RuleConfig } from '../types';
import { cn } from '../lib/utils';

interface ToolbarProps {
  config: RuleConfig;
  setConfig: (config: RuleConfig) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: () => void;
  onPaste: () => void;
  onClear: () => void;
  hasFile: boolean;
  isDownloading?: boolean;
}

export default function Toolbar({ 
  config, 
  setConfig, 
  onUpload, 
  onDownload, 
  onPaste, 
  onClear,
  hasFile,
  isDownloading
}: ToolbarProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 mr-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">VĂN BẢN CHUẨN</h1>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest leading-none">Chuyên gia soát lỗi hành chính</p>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200 mx-2" />

        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
          <ConfigButton 
            active={config === 'nd30-baocao'} 
            onClick={() => setConfig('nd30-baocao')}
            icon={<FileText className="w-4 h-4" />}
            label="Báo cáo (NĐ 30)"
          />
          <ConfigButton 
            active={config === 'nd30-quyetdinh'} 
            onClick={() => setConfig('nd30-quyetdinh')}
            icon={<Gavel className="w-4 h-4" />}
            label="Quyết định (NĐ 30)"
          />
          <ConfigButton 
            active={config === 'hd36-dang'} 
            onClick={() => setConfig('hd36-dang')}
            icon={<PartyPopper className="w-4 h-4" />}
            label="Văn bản Đảng (HD 36)"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100 mr-4">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold text-green-700 uppercase tracking-tighter">AL Knowledge: Updated Law 2026</span>
        </div>

        {hasFile && (
          <button 
            onClick={onClear}
            className="flex items-center gap-2 text-slate-500 hover:text-red-600 px-3 py-2 rounded-lg transition-colors"
            title="Xóa văn bản"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
        
        <button 
          onClick={onPaste}
          className="flex items-center gap-2 text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-lg font-medium transition-colors"
        >
          <ClipboardPaste className="w-5 h-5" />
          <span>Dán văn bản</span>
        </button>

        <div className="relative">
          <input 
            type="file" 
            accept=".docx" 
            onChange={onUpload} 
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all">
            <FileUp className="w-5 h-5" />
            <span>Tải lên (.docx)</span>
          </button>
        </div>

        <button 
          onClick={onDownload}
          disabled={!hasFile || isDownloading}
          className="flex items-center gap-2 border border-slate-300 hover:border-slate-400 disabled:opacity-50 text-slate-700 px-4 py-2 rounded-lg font-medium transition-all"
        >
          {isDownloading ? (
            <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          ) : (
            <FileDown className="w-5 h-5" />
          )}
          <span>{isDownloading ? "Đang xử lý..." : "Tải về"}</span>
        </button>
      </div>
    </header>
  );
}

interface ConfigButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function ConfigButton({ active, onClick, icon, label }: ConfigButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
        active 
          ? "bg-white text-blue-600 shadow-sm" 
          : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
