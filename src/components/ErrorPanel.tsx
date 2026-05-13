import { 
  AlertCircle, 
  Search,
  CheckCircle2, 
  HelpCircle, 
  Info,
  ChevronRight,
  Loader2,
  Trash2
} from 'lucide-react';
import { ProofreadingError } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ErrorPanelProps {
  errors: ProofreadingError[];
  isAnalyzing: boolean;
  onSelectError: (id: string) => void;
  onFixError: (id: string) => void;
  selectedId: string | null;
}

export default function ErrorPanel({ errors, isAnalyzing, onSelectError, onFixError, selectedId }: ErrorPanelProps) {
  if (isAnalyzing) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50/50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium font-serif italic text-lg">Đang soát lỗi văn bản...</p>
        <p className="text-slate-400 text-sm mt-2">AL đang học tập và ghi nhớ quy định...</p>
      </div>
    );
  }

  if (errors.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50/50">
        <CheckCircle2 className="w-12 h-12 text-green-500 mb-4 opacity-50" />
        <p className="font-medium text-slate-600">Văn bản sạch lỗi!</p>
        <p className="text-sm mt-1">Không tìm thấy lỗi nào đáng chú ý</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      <AnimatePresence mode="popLayout">
        {errors.map((error, index) => (
          <motion.div
            key={error.id}
            layout
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectError(error.id)}
            className={cn(
              "group p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden",
              selectedId === error.id 
                ? "bg-blue-50 border-blue-200 shadow-md ring-1 ring-blue-100" 
                : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
            )}
          >
            <div className="flex gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                error.type === 'format' && "bg-amber-100 text-amber-600",
                error.type === 'spelling' && "bg-red-100 text-red-600",
                error.type === 'grammar' && "bg-blue-100 text-blue-600",
                error.type === 'logic' && "bg-purple-100 text-purple-600",
              )}>
                {error.type === 'format' && <HelpCircle className="w-5 h-5" />}
                {error.type === 'spelling' && <AlertCircle className="w-5 h-5" />}
                {error.type === 'grammar' && <Info className="w-5 h-5" />}
                {error.type === 'logic' && <AlertCircle className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full inline-block mb-1",
                    error.severity === 'high' ? "bg-red-100 text-red-700" : 
                    error.severity === 'medium' ? "bg-amber-100 text-amber-700" : 
                    "bg-blue-100 text-blue-700"
                  )}>
                    {error.type.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">Dòng {error.line || '?'}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectError(error.id);
                      }}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold rounded shadow-sm transition-colors"
                      title="Xem vị trí lỗi"
                    >
                      <Search className="w-3 h-3" />
                      XEM
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onFixError(error.id);
                      }}
                      className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded shadow-sm transition-colors"
                      title="Sửa lỗi này"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      SỬA LỖI
                    </button>
                  </div>
                </div>
                
                <h4 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors break-words">
                  {error.message}
                </h4>
                
                <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-200/50">
                  <p className="text-[11px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Văn bản gốc:
                  </p>
                  <p className="text-xs font-mono text-pink-600 line-through overflow-hidden text-ellipsis whitespace-nowrap">{error.originalText}</p>
                  
                  <p className="text-[11px] text-slate-500 uppercase font-bold mt-2 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Đề xuất sửa:
                  </p>
                  <p className="text-xs font-bold text-green-600">{error.suggestion}</p>
                </div>
              </div>

              <div className="shrink-0 flex items-center">
                <ChevronRight className={cn(
                  "w-5 h-5 text-slate-300 transition-all",
                  selectedId === error.id ? "text-blue-500 translate-x-1" : "group-hover:translate-x-1"
                )} />
              </div>
            </div>
            
            {/* Selected Indicator */}
            {selectedId === error.id && (
              <motion.div 
                layoutId="active-indicator"
                className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" 
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
