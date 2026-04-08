import { useRef, useState } from "react";
import axios from "axios";

const UploadForm = () => {
  const [formData, setFormData] = useState({
    patientName: "",
    patientId: "",
    reportName: "",
    reportType: "Lab Report",
    reportDate: "",
  });

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedText, setExtractedText] = useState("");

  const [targetLanguage, setTargetLanguage] = useState("English");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisUpdatedAt, setAnalysisUpdatedAt] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [speechPaused, setSpeechPaused] = useState(false);
  const [speechSupported] = useState(
    typeof window !== "undefined" && "speechSynthesis" in window
  );
  const utteranceRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    const maxSizeBytes = 5 * 1024 * 1024;

    if (!allowedTypes.includes(selectedFile.type)) {
      setMessage({
        type: "error",
        text: "Invalid file type. Please upload only PDF, JPG, or PNG.",
      });
      e.target.value = "";
      setFile(null);
      return;
    }

    if (selectedFile.size > maxSizeBytes) {
      setMessage({
        type: "error",
        text: "File is too large. Maximum allowed size is 5MB.",
      });
      e.target.value = "";
      setFile(null);
      return;
    }

    setMessage({ type: "", text: "" });
    setFile(selectedFile);
  };

  const analyzeText = async (textToAnalyze, language = targetLanguage) => {
    try {
      setAnalyzing(true);
      setAnalysisResult(null);

      const response = await axios.post(
        "http://localhost:5000/api/reports/analyze",
        {
          extractedText: textToAnalyze,
          targetLanguage: language,
        }
      );

      if (response.data.analysis) {
        setAnalysisResult(response.data.analysis);
        setAnalysisUpdatedAt(new Date().toLocaleTimeString());
        setMessage({
          type: "success",
          text: `Analysis updated in ${language}.`,
        });
        return true;
      }
      return false;
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "AI analysis failed. Please try again.",
      });
      return false;
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    setAnalysisResult(null);

    if (!file) {
      setMessage({ type: "error", text: "Please select a file to upload." });
      return;
    }

    const data = new FormData();
    Object.keys(formData).forEach((key) => {
      data.append(key, formData[key]);
    });
    data.append("file", file);

    try {
      setUploading(true);

      const response = await axios.post(
        "http://localhost:5000/api/reports/upload",
        data,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percent);
          },
        }
      );

      const extracted = response.data.extractedText || "";
      setExtractedText(extracted);

      if (!extracted.trim()) {
        setMessage({
          type: "error",
          text: "File uploaded, but no readable text was extracted. Please try a clearer PDF/image.",
        });
      } else {
        const analyzed = await analyzeText(extracted, targetLanguage);
        setMessage({
          type: analyzed ? "success" : "error",
          text: analyzed
            ? "Report uploaded and analyzed successfully."
            : "Report uploaded, but AI analysis could not be completed.",
        });
      }

      setFormData({
        patientName: "",
        patientId: "",
        reportName: "",
        reportType: "Lab Report",
        reportDate: "",
      });

      setFile(null);
      setUploadProgress(0);
      e.target.reset();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error.response?.data?.message ||
          "Upload failed. Please try again later.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!extractedText) return;
    await analyzeText(extractedText, targetLanguage);
  };

  const handleSpeakSummary = () => {
    if (!analysisResult) return;

    if (!speechSupported) {
      setMessage({
        type: "error",
        text: "Speech synthesis is not supported in this browser.",
      });
      return;
    }

    const summaryText =
      analysisResult.translatedSummary ||
      analysisResult.shortSummary ||
      analysisResult.patientFriendlyExplanation ||
      "";

    if (!summaryText.trim()) {
      setMessage({ type: "error", text: "No summary available to play." });
      return;
    }

    const languageVoiceMap = {
      English: "en-US",
      Hindi: "hi-IN",
      Tamil: "ta-IN",
      Spanish: "es-ES",
      French: "fr-FR",
    };

    const languageCode = languageVoiceMap[targetLanguage] || "en-US";
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((voice) =>
        voice.lang.toLowerCase().startsWith(languageCode.toLowerCase())
      ) ||
      voices.find((voice) =>
        voice.lang.toLowerCase().startsWith(languageCode.slice(0, 2).toLowerCase())
      ) || null;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(summaryText);
    utterance.lang = preferredVoice?.lang || languageCode;
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      setSpeaking(false);
      setSpeechPaused(false);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setSpeechPaused(false);
      utteranceRef.current = null;
      setMessage({ type: "error", text: "Unable to play audio summary." });
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePauseSpeech = () => {
    if (!speechSupported) return;
    if (!window.speechSynthesis.speaking || window.speechSynthesis.paused) return;
    window.speechSynthesis.pause();
    setSpeechPaused(true);
  };

  const handleResumeSpeech = () => {
    if (!speechSupported) return;
    if (!window.speechSynthesis.paused) return;
    window.speechSynthesis.resume();
    setSpeechPaused(false);
  };

  const handleStopSpeech = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
    setSpeechPaused(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4">

      {/* MAIN CARD */}
      <div className="w-full max-w-4xl bg-white/90 backdrop-blur shadow-xl rounded-3xl p-10 border border-slate-200/70">

        <div className="flex items-start justify-between gap-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m7-7v14m8-5V7a2 2 0 00-2-2h-3.5a2 2 0 01-1.6-.8l-.8-1.067A2 2 0 0010.5 2H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-6z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Patient Report Intake
              </h2>
              <p className="text-slate-600 mt-1">
                Upload a medical report to extract key data and generate an AI-assisted clinical summary.
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3 py-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            Secure upload
          </div>
        </div>

        {message.text && (
          <div
            className={`p-4 rounded-2xl mb-6 text-sm font-semibold border ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Patient information */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 14a4 4 0 10-8 0v6h8v-6zM12 12a4 4 0 100-8 4 4 0 000 8z" />
                </svg>
                <h3 className="text-lg font-bold text-slate-900">Patient Information</h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">Required</span>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Patient name</label>
                <input
                  type="text"
                  name="patientName"
                  placeholder="e.g., Ashiya"
                  value={formData.patientName}
                  onChange={handleInputChange}
                  required
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Patient ID</label>
                <input
                  type="text"
                  name="patientId"
                  placeholder="e.g., OPD-10293"
                  value={formData.patientId}
                  onChange={handleInputChange}
                  required
                  className="input"
                />
              </div>
            </div>
          </section>

          {/* Report details */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <svg className="h-5 w-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-bold text-slate-900">Report Details</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Report title</label>
                <input
                  type="text"
                  name="reportName"
                  placeholder="e.g., CBC / Blood Work"
                  value={formData.reportName}
                  onChange={handleInputChange}
                  required
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Report date</label>
                <input
                  type="date"
                  name="reportDate"
                  value={formData.reportDate}
                  onChange={handleInputChange}
                  required
                  className="input"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Report type</label>
              <select
                name="reportType"
                value={formData.reportType}
                onChange={handleInputChange}
                className="input"
              >
                <option>Lab Report</option>
                <option>Prescription</option>
                <option>Scan Report</option>
              </select>
            </div>
          </section>

          {/* Upload Area */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <svg className="h-5 w-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M7 10l5-5m0 0l5 5m-5-5v12" />
              </svg>
              <h3 className="text-lg font-bold text-slate-900">Upload & Processing</h3>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-slate-50/40 hover:bg-white hover:border-sky-400 transition">
              <label className="inline-flex cursor-pointer items-center gap-2 bg-sky-600 text-white px-6 py-3 rounded-2xl hover:bg-sky-700 shadow-md">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Select report file
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {file ? (
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-full">
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828a4 4 0 10-5.656-5.656L6.343 10.172a6 6 0 108.485 8.485L20 13" />
                  </svg>
                  {file.name}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Accepted: PDF, JPG, PNG (up to 5MB)
                </p>
              )}
            </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="w-full bg-slate-200 rounded-full h-3 mt-5 overflow-hidden">
              <div
                className="bg-sky-600 h-3 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white py-4 rounded-2xl font-bold text-lg transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? `Uploading ${uploadProgress}%` : "Submit Report"}
          </button>
          </section>
        </form>
      </div>

      {/* Extracted Text */}
      {extractedText && (
        <div className="w-full max-w-4xl mt-10 bg-white/90 backdrop-blur p-8 rounded-3xl shadow-lg border border-slate-200/70">

          <div className="flex items-start justify-between gap-6 mb-4">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Extracted Report Text
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Review extracted content before generating the AI summary.
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3 py-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-sky-500" />
              Ready for analysis
            </div>
          </div>

          <pre className="bg-slate-50 p-5 rounded-2xl text-sm max-h-60 overflow-auto leading-relaxed text-slate-800">
            {extractedText}
          </pre>

          <div className="grid md:grid-cols-3 gap-4 mt-6 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Target language
              </label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="input"
              >
                <option>English</option>
                <option>Spanish</option>
                <option>Hindi</option>
                <option>Tamil</option>
                <option>French</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full bg-slate-900 hover:bg-slate-950 text-white px-6 py-4 rounded-2xl font-bold shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {analyzing ? "Analyzing..." : "Re-Generate Analysis"}
            </button>

          </div>

          {analysisUpdatedAt && (
            <p className="text-xs text-slate-500 mt-3">
              Last regenerated at: {analysisUpdatedAt}
            </p>
          )}

          {/* AI Analysis */}
          {analysisResult && (
            <div className="mt-8 space-y-8 animate-[fadeIn_0.5s_ease-out]">

              {/* Lab Values Cards */}
              {analysisResult.structuredLabValues && analysisResult.structuredLabValues.length > 0 && (
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
                  <h4 className="font-extrabold text-slate-900 text-lg mb-5 flex items-center gap-2">
                    <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    Lab Results Overview
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analysisResult.structuredLabValues.map((lab, idx) => {
                      let statusStyles = "";
                      let Icon = null;
                      
                      if (lab.status === "High") {
                        statusStyles = "bg-rose-50 border-rose-200 text-rose-900";
                        Icon = () => <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>;
                      } else if (lab.status === "Low") {
                        statusStyles = "bg-amber-50 border-amber-200 text-amber-900";
                        Icon = () => <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>;
                      } else {
                        statusStyles = "bg-emerald-50 border-emerald-200 text-emerald-900";
                        Icon = () => <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
                      }

                      return (
                        <div key={idx} className={`p-4 rounded-2xl border ${statusStyles} flex flex-col justify-between hover:-translate-y-1 transition-transform duration-200 shadow-sm`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-sm tracking-wide uppercase opacity-80">{lab.test}</span>
                            <span className="bg-white/60 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 shadow-sm border border-black/5">
                              {Icon && <Icon />}
                              {lab.status}
                            </span>
                          </div>
                          <div>
                            <div className="text-2xl font-black tracking-tight mb-1">{lab.value}</div>
                            <div className="text-xs font-medium opacity-70">Normal Range: {lab.normalRange}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-sky-50 border border-sky-100 rounded-3xl shadow-sm">
                  <h4 className="font-extrabold text-slate-900 text-lg mb-3">Executive Summary</h4>
                  <p className="text-slate-700 leading-relaxed text-sm">{analysisResult.shortSummary}</p>
                </div>

                <div className="p-6 bg-teal-50 border border-teal-100 rounded-3xl shadow-sm">
                  <h4 className="font-extrabold text-slate-900 text-lg mb-3">Patient-Friendly Explanation</h4>
                  <p className="text-slate-700 leading-relaxed text-sm">{analysisResult.patientFriendlyExplanation}</p>
                </div>
              </div>

              {analysisResult.translatedSummary && (
                <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-3xl shadow-sm">
                  <h4 className="font-extrabold text-slate-900 text-lg mb-3">
                    Translated Summary ({targetLanguage})
                  </h4>
                  <p className="text-slate-700 leading-relaxed text-sm">
                    {analysisResult.translatedSummary}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSpeakSummary}
                  disabled={!speechSupported}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-xl font-semibold transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {speaking && !speechPaused ? "Playing..." : "Play Summary"}
                </button>
                <button
                  type="button"
                  onClick={handlePauseSpeech}
                  disabled={!speechSupported || !speaking || speechPaused}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-semibold transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={handleResumeSpeech}
                  disabled={!speechSupported || !speechPaused}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={handleStopSpeech}
                  disabled={!speechSupported || (!speaking && !speechPaused)}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Stop
                </button>
              </div>

            </div>
          )}
        </div>
      )}


    </div>
  );
};

export default UploadForm;