import { useState, useRef, useEffect } from 'react';
import { 
  FileUp, 
  FileDown, 
  ClipboardPaste, 
  Settings2, 
  Search, 
  CheckCircle2, 
  ChevronRight,
  AlertCircle,
  Loader2,
  Trash2
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import mammoth from 'mammoth';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { RuleConfig, ProofreadingError, DocumentState } from './types';

// Components
import Toolbar from './components/Toolbar';
import EditorView from './components/EditorView';
import ErrorPanel from './components/ErrorPanel';

const INITIAL_PROMPT = `
Bạn là chuyên gia AL (Artificial Intelligence) cấp cao nhất về soát lỗi văn bản hành chính và pháp quy Việt Nam. 
Hệ thống của bạn đã được tích hợp kiến thức "Tự học" (Self-learning) và cập nhật liên tục các văn bản pháp luật mới nhất cho đến năm 2025-2026, bao gồm:
- Toàn bộ Nghị định 30/2020/NĐ-CP về công tác văn thư.
- Hướng dẫn 36-HD/VPTW về thể thức văn bản Đảng.
- Luật Tổ chức chính quyền địa phương 2015 (và các văn bản sửa đổi, bổ sung cập nhật mới nhất).
- Các Quy chế làm việc tiêu chuẩn của các cơ quan Nhà nước và Đảng bộ.

Nhiệm vụ của bạn là nhận diện chính xác các lỗi:
1. Thể thức kỹ thuật: Theo đúng chuẩn NĐ 30 hoặc HD 36 (tùy cấu hình). Kiểm tra chi tiết đến từng dấu chấm, dấu phẩy, khoảng cách dòng, thụt lề, kiểu chữ của từng thành phần văn bản.
2. Thể thức nội dung: Kiểm tra tính logic của các đề mục, căn cứ pháp lý (ví dụ: nếu văn bản nhắc đến Luật cũ đã hết hiệu lực, hãy đề xuất cập nhật Luật mới nhất).
3. Chính tả & Ngữ pháp: Soát lỗi kỹ thuật gõ máy và lỗi dùng từ chuyên môn hành chính.

Hãy trả về kết quả dưới dạng JSON là một mảng các đối tượng lỗi:
- id: chuỗi duy nhất.
- type: 'format' (thể thức) | 'spelling' (chính tả) | 'grammar' (ngữ pháp) | 'logic' (nội dung/pháp lý).
- message: Mô tả lỗi chi tiết, trích dẫn rõ điều khoản quy định (ví dụ: "Vi phạm Điều 8 NĐ 30/2020", "Căn cứ Luật Tổ chức chính quyền địa phương 2015...").
- suggestion: Giải pháp sửa đổi tối ưu nhất.
- originalText: Đoạn văn bản gốc bị lỗi (cần chính xác để bôi đỏ).
- severity: 'low' | 'medium' | 'high'.
- line: Số dòng ước tính.
`;

export default function App() {
  const [config, setConfig] = useState<RuleConfig>('nd30-baocao');
  const [docState, setDocState] = useState<DocumentState | null>(null);
  const [errors, setErrors] = useState<ProofreadingError[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedErrorId, setSelectedErrorId] = useState<string | null>(null);
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      try {
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const textResult = await mammoth.extractRawText({ arrayBuffer });
        
        setDocState({
          rawText: textResult.value,
          htmlContent: result.value,
          fileName: file.name
        });
        setErrors([]);
        setSelectedErrorId(null);
      } catch (err) {
        console.error("Error parsing Word file:", err);
        alert("Không thể đọc tệp Word. Vui lòng kiểm tra lại định dạng.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDocState({
          rawText: text,
          htmlContent: `<div style="font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.5; white-space: pre-wrap;">${text}</div>`,
          fileName: 'Văn bản dán.txt'
        });
        setErrors([]);
      }
    } catch (err) {
      alert("Không thể dán văn bản. Vui lòng cấp quyền cho trình duyệt.");
    }
  };

  const runAnalysis = async (contentToCheck?: string) => {
    if (!docState) return;
    setIsAnalyzing(true);

    try {
      const modeText = 
        config === 'nd30-baocao' ? "Báo cáo theo Nghị định 30/2020/NĐ-CP" :
        config === 'nd30-quyetdinh' ? "Quyết định theo Nghị định 30/2020/NĐ-CP" :
        "Văn bản Đảng theo Hướng dẫn 36-HD/VPTW";

      const textToAnalyze = contentToCheck || docState.rawText;
      
      // Optimization: Send structured context
      const prompt = `
        CHẾ ĐỘ KIỂM TRA: ${modeText}
        LOẠI HÌNH: ${contentToCheck ? 'SOÁT VÙNG LỰA CHỌN' : 'SOÁT TOÀN DIỆN'}
        DỮ LIỆU ĐẦU VÀO:
        --- START ---
        ${textToAnalyze.substring(0, 10000)}
        --- END ---
        
        YÊU CẦU: Áp dụng các kiến thức mới nhất về Luật Tổ chức chính quyền địa phương và quy định hành chính hiện hành để đánh giá.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: INITIAL_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                message: { type: Type.STRING },
                suggestion: { type: Type.STRING },
                originalText: { type: Type.STRING },
                severity: { type: Type.STRING },
                line: { type: Type.NUMBER }
              },
              required: ["id", "type", "message", "suggestion", "originalText", "severity"]
            }
          }
        }
      });

      const textResult = response.text || "[]";
      const result = JSON.parse(textResult.trim());
      
      // If it's a selection check, we might want to append errors or replace
      if (contentToCheck) {
        setErrors(prev => [...result, ...prev]);
      } else {
        setErrors(result);
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setErrors([]);
      alert("Không thể phân tích văn bản. Vui lòng thử lại.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFixError = (errorId: string) => {
    if (!docState) return;
    const error = errors.find(e => e.id === errorId);
    if (!error) return;

    const newHtml = docState.htmlContent.split(error.originalText).join(`<span class="text-green-600 font-bold bg-green-50 px-1 rounded">${error.suggestion}</span>`);
    setDocState({ ...docState, htmlContent: newHtml });
    setErrors(prev => prev.filter(e => e.id !== errorId));
  };

  const handleFixAll = () => {
    if (!docState) return;
    let newHtml = docState.htmlContent;
    errors.forEach(err => {
      newHtml = newHtml.split(err.originalText).join(`<span class="text-green-600 font-bold bg-green-50 px-1 rounded">${err.suggestion}</span>`);
    });
    setDocState({ ...docState, htmlContent: newHtml });
    setErrors([]);
  };

  const checkSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString();
    if (!selectedText) {
      alert("Vui lòng bôi đen đoạn văn bản cần soát trong trang hiển thị.");
      return;
    }
    runAnalysis(selectedText);
  };

  const handleClear = () => {
    setDocState(null);
    setErrors([]);
    setSelectedErrorId(null);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-800 font-sans">
      <Toolbar 
        config={config} 
        setConfig={setConfig}
        onUpload={handleFileUpload}
        onDownload={() => alert('Chức năng tải về đang được phát triển')}
        onPaste={handlePaste}
        onClear={handleClear}
        hasFile={!!docState}
      />
      
      <main className="flex flex-1 overflow-hidden p-4 gap-4">
        {/* Document View */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-bottom flex justify-between items-center bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trang hiển thị văn bản</span>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            {docState && <span className="text-xs text-slate-400 italic">{docState.fileName}</span>}
          </div>
          <div className="flex-1 overflow-auto p-8 bg-slate-100">
             <EditorView 
                content={docState?.htmlContent || ""} 
                errors={errors} 
                selectedErrorId={selectedErrorId} 
             />
          </div>
        </div>

        {/* Status & Error Panel */}
        <div className="w-[450px] flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
             <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button 
                    onClick={() => runAnalysis()}
                    disabled={!docState || isAnalyzing}
                    className="flex-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Soát toàn bộ
                  </button>
                  <button 
                    onClick={checkSelection}
                    disabled={!docState || isAnalyzing}
                    className="flex-2 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                    title="Soát đoạn văn bản đang chọn"
                  >
                    <Search className="w-4 h-4" />
                    Soát vùng
                  </button>
                </div>
                <button 
                  onClick={handleFixAll}
                  disabled={errors.length === 0 || isAnalyzing}
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Sửa toàn bộ theo gợi ý
                </button>
             </div>
          </div>

          <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-bottom bg-slate-50 flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lỗi và Đề xuất ({errors.length})</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                  <Settings2 className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase">
                    {config === 'nd30-baocao' ? 'NĐ 30: BÁO CÁO' : config === 'nd30-quyetdinh' ? 'NĐ 30: QUYẾT ĐỊNH' : 'HD 36: ĐẢNG'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">AL đang áp dụng chuẩn {config.startsWith('nd') ? 'Nhà nước' : 'Đảng'} để nhận diện</p>
            </div>
            <div className="flex-1 overflow-auto">
              {docState ? (
                <ErrorPanel 
                  errors={errors} 
                  isAnalyzing={isAnalyzing} 
                  onSelectError={(id) => setSelectedErrorId(id)}
                  onFixError={handleFixError}
                  selectedId={selectedErrorId}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <FileUp className="w-12 h-12 mb-4 opacity-20" />
                  <p>Tải lên văn bản để bắt đầu soát lỗi</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
