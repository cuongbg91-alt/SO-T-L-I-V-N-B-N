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
import { saveAs } from 'file-saver';
import HTMLtoDOCX from 'html-to-docx';
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
- Luật Tổ chức chính quyền địa phương và các văn bản sửa đổi, bổ sung cập nhật mới nhất (bao gồm cả cập nhật năm 2025).
- Các Quy chế làm việc tiêu chuẩn của các cơ quan Nhà nước và Đảng bộ.

Nhiệm vụ của bạn là nhận diện chính xác các lỗi:
1. Thể thức kỹ thuật: Theo đúng chuẩn NĐ 30 hoặc HD 36 (tùy cấu hình). Kiểm tra chi tiết đến từng dấu chấm, dấu phẩy, khoảng cách dòng, thụt lề, kiểu chữ của từng thành phần văn bản.
2. Thể thức nội dung & Logic: Kiểm tra tính logic của các đề mục, căn cứ pháp lý. Nếu văn bản nhắc đến quy định đã hết hiệu lực, hãy đề xuất cập nhật quy định mới nhất (ví dụ: Luật Tổ chức chính quyền địa phương 2025).
3. Chính tả & Ngữ pháp: Soát lỗi kỹ thuật gõ máy và lỗi dùng từ chuyên môn hành chính.
4. TÍNH THỐNG NHẤT (Consistency): 
   - Kiểm tra sự đồng nhất của các đề mục: Hệ thống ký hiệu (I, II, 1, 2, a, b, ...) phải thống nhất xuyên suốt văn bản.
   - Kiểm tra các ký tự đầu dòng: Nếu dùng "-", "+" hoặc "*" cho các mục cùng cấp thì phải thống nhất toàn văn bản. Tuyệt đối không để xảy ra tình trạng chỗ dùng "1.", chỗ dùng "1/" cho cùng một cấp độ mục.

Hãy trả về kết quả dưới dạng JSON là một mảng các đối tượng lỗi:
- id: chuỗi duy nhất.
- type: 'format' (thể thức) | 'spelling' (chính tả) | 'grammar' (ngữ pháp) | 'logic' (nội dung/pháp lý/thống nhất).
- message: Mô tả lỗi chi tiết, trích dẫn rõ điều khoản quy định hoặc chỉ rõ sự không thống nhất trong trình bày.
- suggestion: Giải pháp sửa đổi tối ưu nhất để đảm bảo văn bản chuẩn mực và chuyên nghiệp.
- originalText: Đoạn văn bản gốc bị lỗi (cần chính xác để tìm kiếm và bôi đỏ).
- severity: 'low' | 'medium' | 'high'.
- line: Số dòng ước tính.
- page: Số trang ước tính trong file gốc.
`;

export default function App() {
  const [config, setConfig] = useState<RuleConfig>('nd30-baocao');
  const [docState, setDocState] = useState<DocumentState | null>(null);
  const [errors, setErrors] = useState<ProofreadingError[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedErrorId, setSelectedErrorId] = useState<string | null>(null);
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      try {
        const options = {
          styleMap: [
            "p[style-name='Section Title'] => h1:fresh",
            "p[style-name='Subsection Title'] => h2:fresh",
            "p[style-name='Normal'] => p:fresh",
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Subtitle'] => h2:fresh"
          ]
        };
        const result = await mammoth.convertToHtml({ arrayBuffer }, options);
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

  const handleDownload = async () => {
    if (!docState || isDownloading) return;
    setIsDownloading(true);
    try {
      // Create a clean version for download
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = docState.htmlContent;
      
      // 1. Remove all error highlighting spans but keep text
      const errorSpans = tempDiv.querySelectorAll('span[data-error-id]');
      errorSpans.forEach(span => {
        const textNode = document.createTextNode(span.textContent || "");
        span.parentNode?.replaceChild(textNode, span);
      });

      // 2. Remove any anchor tags used for linking
      const anchors = tempDiv.querySelectorAll('span[id^="error-"]');
      anchors.forEach(a => {
        const textNode = document.createTextNode(a.textContent || "");
        a.parentNode?.replaceChild(textNode, a);
      });

      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${docState.fileName}</title>
            <style>
              @page {
                margin: 2.5cm 2cm 2.5cm 3cm;
              }
              body { 
                font-family: 'Times New Roman', Times, serif; 
                font-size: 14pt; 
                line-height: 1.5;
                color: black;
              }
              p { 
                text-align: justify; 
                margin: 0; 
                padding: 0;
                min-height: 1em;
              }
              table { 
                border-collapse: collapse; 
                width: 100%; 
                margin: 12pt 0;
              }
              td, th { 
                border: 1px solid black; 
                padding: 5pt; 
                vertical-align: top;
              }
              strong, b { font-weight: bold; }
              em, i { font-style: italic; }
            </style>
          </head>
          <body>
            ${tempDiv.innerHTML}
          </body>
        </html>
      `;

      const docxBlob = await HTMLtoDOCX(fullHtml, null, {
        margins: {
          top: 1417, // 25mm in twentieths of a point
          right: 1134, // 20mm
          bottom: 1417, // 25mm
          left: 1701 // 30mm
        },
        font: 'Times New Roman',
        fontSize: 28, // 14pt in half-points
        orientation: 'portrait'
      });

      saveAs(docxBlob, `VB_Chuan_${docState.fileName.replace('.docx', '')}.docx`);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Lỗi khi chuẩn bị tệp tải về. Vui lòng thử lại.");
    } finally {
      setIsDownloading(false);
    }
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
        
        YÊU CẦU CHI TIẾT:
        1. Áp dụng các kiến thức mới nhất về Luật Tổ chức chính quyền địa phương (Cập nhật 2025) và quy định hành chính hiện hành.
        2. KIỂM TRA TÍNH THỐNG NHẤT: Rà soát toàn bộ văn bản để tìm các mẫu (patterns) trình bày đề mục, danh sách không đồng nhất. Ví dụ: Nếu mục 1 là "1.", mục 2 không được là "2/".
        3. HIỆU CHỈNH TỐI ƯU: Đề xuất phương án sửa lỗi tối ưu nhất dựa trên các cơ sở pháp lý hiện hành.
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
                line: { type: Type.NUMBER },
                page: { type: Type.NUMBER }
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
        onDownload={handleDownload}
        onPaste={handlePaste}
        onClear={handleClear}
        hasFile={!!docState}
        isDownloading={isDownloading}
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
