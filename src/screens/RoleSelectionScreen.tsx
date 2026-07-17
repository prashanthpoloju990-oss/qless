import { useNavigate } from "react-router-dom";
import bgImage from "../../public/images/qless-bg.jpg";

export default function RoleSelectionScreen() {
  const navigate = useNavigate();

  return (
    <main
      className="relative min-h-screen px-5 flex flex-col justify-center items-center text-[#0F2044] antialiased qless-app-bg"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-white/80 via-white/70 to-white/90 backdrop-blur-sm" aria-hidden="true" />
      
      <div className="relative z-10 w-full max-w-[420px] text-center space-y-8 qless-fade-in">
        <div>
          <h1 className="font-poppins text-5xl font-bold tracking-tight text-[#0F2044] mb-2">QLESS</h1>
          <p className="font-alegreya text-lg text-[#7A8493]">Smart Shopping Platform</p>
        </div>

        <div className="space-y-4 pt-4">
          <button
            onClick={() => navigate("/customer")}
            className="flex h-16 w-full items-center justify-between px-6 rounded-2xl bg-[#0F2044] font-poppins text-lg font-semibold text-white shadow-xl transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Customer</span>
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          
          <button
            onClick={() => navigate("/staff")}
            className="flex h-16 w-full items-center justify-between px-6 rounded-2xl border-2 border-[#2E9E44] bg-[#EEF8F0] font-poppins text-lg font-semibold text-[#2E9E44] shadow-md transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Store Staff (Verify)</span>
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          
          <button
            onClick={() => navigate("/admin")}
            className="flex h-16 w-full items-center justify-between px-6 rounded-2xl border border-white/50 bg-white/60 backdrop-blur-md font-poppins text-lg font-semibold text-[#0F2044] shadow-sm transition hover:scale-[1.02] hover:bg-white/80 active:scale-[0.98]"
          >
            <span>Admin Dashboard</span>
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </main>
  );
}
