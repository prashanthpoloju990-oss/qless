import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import bgImage from "../../public/images/qless-bg.jpg";

export default function StaffScreen() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  const [scanState, setScanState] = useState<"scanning" | "verifying" | "success" | "error">("scanning");
  const [scannedReceiptId, setScannedReceiptId] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // --- LOGIN ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      setIsLoggedIn(true);
    }
  };

  // --- SCANNER ---
  useEffect(() => {
    if (!isLoggedIn) return;

    const startScanner = async () => {
      try {
        scannerRef.current = new Html5Qrcode("staff-reader");
        await scannerRef.current.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => handleScan(decodedText),
          () => {} // ignore errors
        );
      } catch (err) {
        console.error(err);
      }
    };
    
    // small delay for DOM
    setTimeout(startScanner, 100);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
      }
    };
  }, [isLoggedIn]);

  const handleScan = async (decodedText: string) => {
    // Prevent multiple scans
    if (scannerRef.current && scannerRef.current.getState() === 2) {
      scannerRef.current.pause(true);
    }
    
    setScanState("verifying");
    setScannedReceiptId(decodedText);

    // Verify in supabase
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', decodedText)
      .single();

    if (error || !data) {
      setScanState("error");
    } else {
      if (data.status === 'paid') {
        // Mark as verified
        await supabase
          .from('receipts')
          .update({ status: 'verified' })
          .eq('id', decodedText);
        setScanState("success");
      } else if (data.status === 'verified') {
        // Already verified
        setScanState("success");
      } else {
        setScanState("error");
      }
    }
  };

  const handleNext = () => {
    setScannedReceiptId(null);
    setScanState("scanning");
    if (scannerRef.current && scannerRef.current.getState() === 3) {
      scannerRef.current.resume();
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="relative min-h-screen px-5 flex flex-col justify-center items-center text-[#0F2044] qless-app-bg" style={{ backgroundImage: `url(${bgImage})` }}>
        <div className="pointer-events-none fixed inset-0 z-0 bg-white/80 backdrop-blur-md" aria-hidden="true" />
        
        <div className="relative z-10 w-full max-w-[340px] bg-white p-8 rounded-3xl shadow-2xl">
          <button onClick={() => navigate("/")} className="absolute top-6 left-6 text-[#7A8493] font-semibold text-sm">← Back</button>
          
          <h2 className="font-poppins text-2xl font-bold text-[#0F2044] mt-6 mb-1 text-center">Staff Login</h2>
          <p className="text-center text-[#7A8493] text-sm mb-6">Demo environment</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-full h-12 px-4 rounded-xl border border-black/10 bg-[#F9FAFB] font-poppins focus:outline-none focus:border-[#2E9E44]" />
            </div>
            <div>
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full h-12 px-4 rounded-xl border border-black/10 bg-[#F9FAFB] font-poppins focus:outline-none focus:border-[#2E9E44]" />
            </div>
            <button type="submit" className="w-full h-12 rounded-xl bg-[#2E9E44] text-white font-semibold font-poppins shadow-lg transition hover:scale-[1.02] active:scale-[0.98]">
              Login
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex flex-col text-[#0F2044] bg-[#0F2044]">
      <header className="flex items-center justify-between px-6 py-5 bg-white/5 backdrop-blur-md border-b border-white/10 z-10">
        <div>
          <p className="font-poppins text-xl font-bold text-white">QLESS Staff</p>
          <p className="text-xs text-[#9AA3AF]">Exit Gate Scanner</p>
        </div>
        <button onClick={() => navigate("/")} className="text-sm font-semibold text-white/70 hover:text-white">Exit</button>
      </header>

      <div className="flex-1 relative flex flex-col justify-center items-center">
        <div id="staff-reader" className="absolute inset-0 z-0 h-full w-full object-cover [&>video]:h-full [&>video]:w-full [&>video]:object-cover" style={{ display: scanState === "scanning" ? "block" : "none" }}></div>

        {scanState === "scanning" && (
          <div className="pointer-events-none relative z-10 flex h-full w-full flex-col items-center justify-center bg-black/40">
            <div className="w-64 h-64 border-2 border-white/50 border-dashed rounded-3xl relative">
               <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-[#2E9E44]" />
               <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-[#2E9E44]" />
               <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-[#2E9E44]" />
               <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-[#2E9E44]" />
               <div className="absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 bg-[#2E9E44] shadow-[0_0_8px_2px_rgba(46,158,68,0.8)] animate-pulse" />
            </div>
            <p className="mt-8 font-poppins text-sm font-semibold tracking-widest text-white uppercase drop-shadow-md">Align receipt QR</p>
          </div>
        )}

        {scanState === "verifying" && (
          <div className="relative z-10 flex flex-col items-center">
            <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md mb-4">
               <svg className="h-8 w-8 animate-spin text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg>
            </div>
            <p className="text-white font-poppins font-semibold">Verifying Database...</p>
          </div>
        )}

        {scanState === "success" && (
          <div className="relative z-10 flex flex-col items-center justify-center h-full w-full bg-[#2E9E44] p-6 text-center animate-in fade-in zoom-in duration-300">
             <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-[#2E9E44] shadow-2xl mb-8">
               <svg viewBox="0 0 24 24" fill="none" className="h-14 w-14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
             </div>
             <h2 className="font-poppins text-4xl font-bold text-white mb-2">Verified</h2>
             <p className="text-white/80 font-alegreya text-lg mb-10">Customer may exit the store.</p>
             <p className="text-white/60 text-sm mb-12 max-w-[240px] truncate">Receipt ID: {scannedReceiptId}</p>
             
             <button onClick={handleNext} className="w-full max-w-[300px] h-14 rounded-2xl bg-white text-[#2E9E44] font-poppins font-bold text-lg shadow-xl active:scale-95 transition-all">
               Scan Next Customer
             </button>
          </div>
        )}

        {scanState === "error" && (
          <div className="relative z-10 flex flex-col items-center justify-center h-full w-full bg-[#D64541] p-6 text-center animate-in fade-in zoom-in duration-300">
             <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-[#D64541] shadow-2xl mb-6">
               <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
             </div>
             <h2 className="font-poppins text-3xl font-bold text-white mb-2">Invalid Receipt</h2>
             <p className="text-white/80 font-alegreya text-lg mb-8">This receipt is unpaid or invalid.</p>
             
             <button onClick={handleNext} className="w-full max-w-[300px] h-14 rounded-2xl bg-white text-[#D64541] font-poppins font-bold text-lg shadow-xl active:scale-95 transition-all">
               Try Again
             </button>
          </div>
        )}
      </div>
    </main>
  );
}
