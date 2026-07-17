import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import bgImage from "../../public/images/qless-bg.jpg";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AppView = "cart" | "checkout" | "exit";
type ScanState = "idle" | "verifying" | "success" | "error";
type PaymentMethod = "upi" | "card" | "wallet";

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  offer?: string;
  expiryDays: number;
  freshnessScore: number;
  recommendation: string;
}

// Full mock product catalog — each has a fake barcode string
interface Product extends Omit<CartItem, "quantity"> {
  barcode: string;
  category: string;
  emoji: string;
}

const enrichProductInfo = (prod: any) => {
  const name = prod.name.toLowerCase();
  let expiryDays = 14;
  let freshnessScore = 95;
  let recommendation = "Best within 2 weeks";

  if (name.includes("milk")) {
    expiryDays = 2;
    freshnessScore = 92;
    recommendation = "Consume today or tomorrow";
  } else if (name.includes("bread")) {
    expiryDays = 3;
    freshnessScore = 88;
    recommendation = "Best within 2 days";
  } else if (name.includes("egg")) {
    expiryDays = 10;
    freshnessScore = 90;
    recommendation = "Best within a week";
  } else if (name.includes("apple") || name.includes("fruit")) {
    expiryDays = 5;
    freshnessScore = 85;
    recommendation = "Eat now or soon";
  } else if (name.includes("rice") || name.includes("grain")) {
    expiryDays = 180;
    freshnessScore = 100;
    recommendation = "Highly shelf stable";
  } else if (name.includes("butter") || name.includes("cheese")) {
    expiryDays = 30;
    freshnessScore = 95;
    recommendation = "Best within 2-3 weeks";
  } else if (name.includes("salt") || name.includes("spice")) {
    expiryDays = 365;
    freshnessScore = 100;
    recommendation = "Shelf stable";
  } else if (name.includes("noodle") || name.includes("maggi") || name.includes("instant")) {
    expiryDays = 90;
    freshnessScore = 98;
    recommendation = "Best within 2 months";
  } else if (name.includes("oil")) {
    expiryDays = 120;
    freshnessScore = 99;
    recommendation = "Safe for 3-4 months";
  } else if (name.includes("toothpaste") || name.includes("shampoo")) {
    expiryDays = 730;
    freshnessScore = 100;
    recommendation = "Highly shelf stable";
  } else if (name.includes("lays") || name.includes("biscuit") || name.includes("snack") || name.includes("cookie")) {
    expiryDays = 45;
    freshnessScore = 96;
    recommendation = "Best within a month";
  }

  return {
    ...prod,
    expiryDays,
    freshnessScore,
    recommendation
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_ID = "A123"; // Or use crypto.randomUUID().substring(0,8)
const RECEIPT_ID = "#QL12345";

const INITIAL_ITEMS: CartItem[] = [
  enrichProductInfo({ id: 1, name: "Milk",  price: 50, quantity: 1 }),
  enrichProductInfo({ id: 2, name: "Bread", price: 40, quantity: 1 }),
];

const MOCK_PRODUCTS: Product[] = [
  enrichProductInfo({ id: 3,  name: "Eggs (12 pcs)",      price: 72,  barcode: "8901030874322", category: "Dairy",    emoji: "🥚", offer: "Buy 1 Get 1" }),
  enrichProductInfo({ id: 4,  name: "Apples (1 kg)",      price: 120, barcode: "8901072001422", category: "Fruits",   emoji: "🍎" }),
  enrichProductInfo({ id: 5,  name: "Basmati Rice (5kg)", price: 380, barcode: "8904109600127", category: "Grains",   emoji: "🍚" }),
  enrichProductInfo({ id: 6,  name: "Amul Butter",        price: 55,  barcode: "8901063103765", category: "Dairy",    emoji: "🧈", offer: "₹5 OFF" }),
  enrichProductInfo({ id: 7,  name: "Tata Salt (1kg)",    price: 24,  barcode: "8901058003345", category: "Spices",   emoji: "🧂" }),
  enrichProductInfo({ id: 8,  name: "Maggi Noodles",      price: 14,  barcode: "8901058009989", category: "Instant",  emoji: "🍜" }),
  enrichProductInfo({ id: 9,  name: "Sunflower Oil (1L)", price: 148, barcode: "8906009510019", category: "Oils",     emoji: "🫙" }),
  enrichProductInfo({ id: 10, name: "Colgate Toothpaste", price: 99,  barcode: "8718951233256", category: "Personal", emoji: "🪥" }),
  enrichProductInfo({ id: 11, name: "Lays Classic",       price: 20,  barcode: "8901491503951", category: "Snacks",   emoji: "🥔" }),
  enrichProductInfo({ id: 12, name: "Biscuits (Parle-G)", price: 10,  barcode: "8901063001101", category: "Snacks",   emoji: "🍪" }),
];

// (kept for potential future use — scanner uses MOCK_PRODUCTS directly)
const _CATALOG: Omit<CartItem, "quantity">[] = MOCK_PRODUCTS.map(({ barcode: _b, category: _c, emoji: _e, ...rest }) => rest);
void _CATALOG;

interface CouponInfo {
  code: string;
  threshold: number;
  discountType: "percent" | "flat";
  discountValue: number;
}

const COUPONS: CouponInfo[] = [
  { code: "SAVE10", threshold: 199, discountType: "percent", discountValue: 10 },
  { code: "SAVE50", threshold: 499, discountType: "flat", discountValue: 50 },
];

const getCouponStatus = (subtotal: number) => {
  let appliedCoupon: CouponInfo | null = null;
  let maxDiscount = 0;

  for (const coupon of COUPONS) {
    if (subtotal >= coupon.threshold) {
      const discount = coupon.discountType === "percent"
        ? (subtotal * coupon.discountValue) / 100
        : coupon.discountValue;
      
      if (discount > maxDiscount) {
        maxDiscount = discount;
        appliedCoupon = coupon;
      }
    }
  }

  const nextCoupon = COUPONS.find(c => subtotal < c.threshold);

  return {
    appliedCoupon,
    discountAmount: maxDiscount,
    finalTotal: Math.max(0, subtotal - maxDiscount),
    nextCoupon,
  };
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  upi:    "UPI (GPay / PhonePe)",
  card:   "Credit / Debit Card",
  wallet: "QLESS Wallet",
};

function nowTime() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny icon components
// ─────────────────────────────────────────────────────────────────────────────

const IcAdd    = () => <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>;
const IcShare  = () => <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8.5 8.7 12m7.3 3.5L8.7 12M18 7a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0ZM9 12a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Zm9 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>;
const IcCheck  = () => <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.2 4L19 6.8"/></svg>;
const IcBag    = () => <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M7.2 8.5h9.6l.8 10.1A2.2 2.2 0 0 1 15.4 21H8.6a2.2 2.2 0 0 1-2.2-2.4l.8-10.1Z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" strokeLinecap="round"/></svg>;
const IcClose  = () => <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>;
const IcBack   = () => <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M5 12l6-6M5 12l6 6"/></svg>;
const IcCamera = () => <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 8.5a2 2 0 0 1 2-2h1.4l1.1-1.7A1.5 1.5 0 0 1 9.75 4h4.5a1.5 1.5 0 0 1 1.25.8l1.1 1.7H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5Z"/><circle cx="12" cy="12.5" r="3.2"/></svg>;
const IcShield = () => <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 3.2 5.5 5.8v5c0 4.1 2.7 7.4 6.5 8.9 3.8-1.5 6.5-4.8 6.5-8.9v-5L12 3.2Z"/><path d="m9.3 11.8 1.9 1.9 3.5-3.9" strokeLinecap="round"/></svg>;
const IcScan   = () => <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="4" height="4" rx="0.5"/><rect x="13" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="13" width="4" height="4" rx="0.5"/><path d="M13 15h.01M16 15h.01M13 18h.01M16 18h.01" strokeWidth="2.4"/></svg>;

// ─────────────────────────────────────────────────────────────────────────────
// Barcode SVG illustration (decorative, flickers while scanning)
// ─────────────────────────────────────────────────────────────────────────────

function BarcodeSVG({ active }: { active: boolean }) {
  // Widths for 30 alternating bars — purely decorative
  const bars = [3,1,2,1,3,2,1,3,1,2,3,1,2,1,4,1,2,3,1,2,1,3,2,1,3,1,2,1,3,2];
  let x = 0;
  return (
    <svg
      viewBox="0 0 120 60"
      className={`w-full max-w-[180px] ${active ? "qless-bar-flicker" : ""}`}
      aria-hidden="true"
    >
      {bars.map((w, i) => {
        const rect = (
          <rect
            key={i}
            x={x}
            y={4}
            width={w}
            height={i % 5 === 0 ? 48 : 42}
            rx={0.5}
            fill={i % 2 === 0 ? "#0F2044" : "transparent"}
            opacity={i % 2 === 0 ? (i % 7 === 0 ? 0.9 : 0.75) : 0}
          />
        );
        x += w + 1;
        return rect;
      })}
      {/* barcode number below */}
      <text x="60" y="58" textAnchor="middle" fontSize="6" fill="#7A8493" fontFamily="monospace">
        8901063103765
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Barcode Scanner Modal
// ─────────────────────────────────────────────────────────────────────────────

type ScanPhase = "scanning" | "detected" | "added";

function BarcodeScannerModal({
  open,
  onClose,
  onItemScanned,
  existingIds,
}: {
  open: boolean;
  onClose: () => void;
  onItemScanned: (product: Product) => void;
  existingIds: number[];
}) {
  const [phase, setPhase]       = useState<ScanPhase>("scanning");
  const [detected, setDetected] = useState<Product | null>(null);
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerRef              = useRef<Html5Qrcode | null>(null);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open]);

  // Scanner setup
  useEffect(() => {
    let active = true;
    let startTimeout: ReturnType<typeof setTimeout> | null = null;

    if (!open) {
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        if (scanner.isScanning) {
          scanner.stop().catch(() => {}).finally(() => {
            try { scanner.clear(); } catch {}
          });
        }
      }
      return;
    }

    setPhase("scanning");
    setDetected(null);

    const startScanner = async () => {
      try {
        if (!active) return;
        const html5Qrcode = new Html5Qrcode("reader");
        scannerRef.current = html5Qrcode;
        
        await html5Qrcode.start(
          { facingMode: "environment" },
          { fps: 20, aspectRatio: 1.0 },
          (decodedText) => {
            if (active) handleScanSuccess(decodedText);
          },
          () => {} // ignore ongoing scan errors
        );

        if (!active) {
          if (html5Qrcode.isScanning) {
            await html5Qrcode.stop();
            html5Qrcode.clear();
          }
        }
      } catch (err) {
        if (active) {
          console.error("Scanner failed to start", err);
        }
      }
    };
    
    // Give DOM a tick to render #reader
    startTimeout = setTimeout(startScanner, 100);

    return () => {
      active = false;
      if (startTimeout) clearTimeout(startTimeout);
      
      const stopScanner = async () => {
        if (scannerRef.current) {
          const scanner = scannerRef.current;
          scannerRef.current = null;
          if (scanner.isScanning) {
            try {
              await scanner.stop();
              scanner.clear();
            } catch (err) {
              console.error("Failed to stop scanner", err);
            }
          }
        }
      };
      stopScanner();
    };
  }, [open]);

  const handleScanSuccess = async (decodedText: string) => {
    // Stop scanning immediately
    if (scannerRef.current && scannerRef.current.getState() === 2) {
      scannerRef.current.pause(true);
    }
    
    // Query Supabase for the real product
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', decodedText)
      .maybeSingle();

    let product = data;

    if (error || !product) {
      // First check if the barcode matches any mock product exactly
      const matchedMock = MOCK_PRODUCTS.find(p => p.barcode === decodedText);
      if (matchedMock) {
        product = matchedMock;
      } else {
        // Fallback to a random demo product if not found in DB or mock catalog
        const available = MOCK_PRODUCTS.filter(p => !existingIds.includes(p.id));
        const pool = available.length > 0 ? available : MOCK_PRODUCTS;
        product = pool[Math.floor(Math.random() * pool.length)];
      }
    } else {
      product = enrichProductInfo(product);
    }

    setDetected(product as Product);
    setPhase("detected");
  };

  const handleAdd = () => {
    if (!detected) return;
    setPhase("added");
    onItemScanned(detected);
    timerRef.current = setTimeout(() => {
      handleClose();
    }, 900);
  };

  const handleRescan = () => {
    setDetected(null);
    setPhase("scanning");
    if (scannerRef.current && scannerRef.current.getState() === 3) {
      scannerRef.current.resume();
    }
  };

  const handleClose = () => {
    setPhase("scanning");
    setDetected(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F2044]/40 backdrop-blur-sm qless-fade-in" onMouseDown={handleClose}>
      <div className="w-full max-w-[420px] rounded-t-3xl bg-white shadow-[0_-16px_60px_rgba(15,32,68,0.22)] qless-scale-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="h-1 w-10 rounded-full bg-[#E5E7EB]" /></div>
        <div className="flex items-center justify-between px-6 py-3 border-b border-black/5">
          <div>
            <h3 className="font-poppins text-lg font-semibold text-[#0F2044]">Barcode Scanner</h3>
            <p className="text-xs text-[#7A8493] font-alegreya">
              {phase === "scanning" ? "Scanning for product…" : phase === "detected" ? "Product found!" : "Added to cart ✓"}
            </p>
          </div>
          <button onClick={handleClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-[#7A8493] hover:bg-[#F6F7F8] hover:text-[#0F2044] transition-all"><IcClose /></button>
        </div>

        <div className="px-6 pt-5 pb-4">
          <div className={`relative h-64 w-full overflow-hidden rounded-2xl border-2 transition-all duration-500 ${phase === "added" ? "border-[#2E9E44] bg-[#EEF8F0]" : phase === "detected" ? "border-[#2E9E44]/60 bg-[#F9FAFB]" : "border-dashed border-[#2E9E44]/30 bg-black/5"}`}>
            {/* Scanner target container */}
            <div id="reader" className="absolute inset-0 z-0 h-full w-full object-cover [&>video]:h-full [&>video]:w-full [&>video]:object-cover" style={{ display: phase === "scanning" ? "block" : "none" }}></div>

            <div className={`pointer-events-none absolute inset-3 z-10 ${phase === "scanning" ? "qless-corner-pulse" : ""}`} aria-hidden="true">
              <span className={`absolute left-0 top-0 h-7 w-7 rounded-tl-xl border-l-[3px] border-t-[3px] transition-colors duration-300 ${phase === "scanning" ? "border-[#2E9E44]" : "border-[#2E9E44]"}`} />
              <span className={`absolute right-0 top-0 h-7 w-7 rounded-tr-xl border-r-[3px] border-t-[3px] transition-colors duration-300 ${phase === "scanning" ? "border-[#2E9E44]" : "border-[#2E9E44]"}`} />
              <span className={`absolute bottom-0 left-0 h-7 w-7 rounded-bl-xl border-b-[3px] border-l-[3px] transition-colors duration-300 ${phase === "scanning" ? "border-[#2E9E44]" : "border-[#2E9E44]"}`} />
              <span className={`absolute bottom-0 right-0 h-7 w-7 rounded-br-xl border-b-[3px] border-r-[3px] transition-colors duration-300 ${phase === "scanning" ? "border-[#2E9E44]" : "border-[#2E9E44]"}`} />
            </div>

            {phase === "scanning" && (
              <div className="pointer-events-none absolute left-5 right-5 z-10 h-0.5 rounded-full qless-beam" style={{ background: "linear-gradient(90deg, transparent, #2E9E44, transparent)", boxShadow: "0 0 8px 2px rgba(46,158,68,0.35)" }} aria-hidden="true" />
            )}

            {phase === "scanning" && (
              <div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center gap-3 qless-fade-in bg-black/20">
                <p className="mt-auto mb-4 font-poppins text-xs font-semibold tracking-widest text-white uppercase animate-pulse drop-shadow-md">Scanning…</p>
              </div>
            )}

            {phase === "detected" && detected && (
              <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 px-4 qless-scale-in bg-[#F9FAFB]">
                <div className="text-4xl">{detected.emoji}</div>
                <div className="text-center">
                  <p className="font-poppins text-base font-bold text-[#0F2044] leading-tight">{detected.name}</p>
                  <p className="mt-0.5 text-xs text-[#7A8493] font-alegreya">{detected.category} · {detected.barcode}</p>
                  {detected.offer && (
                    <span className="mt-1.5 inline-block text-[10px] font-bold uppercase tracking-wider bg-[#EEF8F0] text-[#2E9E44] border border-[#2E9E44]/20 px-2 py-0.5 rounded-md">
                      {detected.offer}
                    </span>
                  )}
                  <p className="mt-1 font-poppins text-xl font-bold text-[#2E9E44]">{fmt(detected.price)}</p>
                </div>
              </div>
            )}

            {phase === "added" && (
              <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 qless-scale-in bg-[#EEF8F0]">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2E9E44] text-white shadow-[0_8px_20px_rgba(46,158,68,0.3)]"><svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
                <p className="font-poppins text-sm font-bold text-[#2E9E44]">Added to Cart!</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-8 space-y-3">
          {phase === "scanning" && (
            <div className="flex items-center justify-center gap-2 py-3">
              <div className="h-1.5 w-1.5 rounded-full bg-[#2E9E44] animate-bounce [animation-delay:0ms]" />
              <div className="h-1.5 w-1.5 rounded-full bg-[#2E9E44] animate-bounce [animation-delay:150ms]" />
              <div className="h-1.5 w-1.5 rounded-full bg-[#2E9E44] animate-bounce [animation-delay:300ms]" />
            </div>
          )}

          {phase === "detected" && (
            <>
              <button onClick={handleAdd} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2E9E44] font-poppins text-sm font-semibold text-white shadow-[0_8px_20px_rgba(46,158,68,0.25)] transition-all hover:scale-[1.02] active:scale-[0.98]"><IcAdd /> Add to Cart</button>
              <button onClick={handleRescan} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white font-poppins text-sm font-semibold text-[#7A8493] transition-all hover:scale-[1.02] hover:bg-[#F8F9FA] hover:text-[#0F2044] active:scale-[0.98]">Scan Different Item</button>
            </>
          )}

          {phase === "added" && <div className="h-12 flex items-center justify-center"><p className="font-alegreya text-sm text-[#7A8493]">Closing scanner…</p></div>}
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

const STEPS: { key: AppView; label: string }[] = [
  { key: "cart",     label: "Cart"     },
  { key: "checkout", label: "Checkout" },
  { key: "exit",     label: "Exit"     },
];

function StepBar({ current }: { current: AppView }) {
  const idx = STEPS.findIndex(s => s.key === current);
  return (
    <div className="flex items-center justify-center gap-0 py-4 select-none">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
              i < idx  ? "bg-[#2E9E44] text-white"
            : i === idx ? "bg-[#0F2044] text-white shadow-[0_4px_12px_rgba(15,32,68,0.22)]"
            :              "bg-[#E5E7EB] text-[#9AA3AF]"
            }`}>
              {i < idx ? <IcCheck /> : i + 1}
            </div>
            <span className={`text-[10px] font-semibold tracking-wide ${
              i <= idx ? "text-[#0F2044]" : "text-[#9AA3AF]"
            }`}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`mb-4 mx-1 h-px w-10 transition-all duration-300 ${i < idx ? "bg-[#2E9E44]" : "bg-[#E5E7EB]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Share Modal
// ─────────────────────────────────────────────────────────────────────────────

function ShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  
  // Real URL for scanning
  const shareUrl = `${window.location.origin}${window.location.pathname}?session=${SESSION_ID}`;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F2044]/20 px-5 backdrop-blur-md qless-fade-in" onMouseDown={onClose}>
      <div className="w-full max-w-[340px] rounded-2xl border border-black/5 bg-white p-6 text-center shadow-[0_24px_70px_rgba(15,32,68,0.18)] qless-scale-in" onMouseDown={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <span className="h-10 w-10" />
          <h2 className="font-poppins text-xl font-semibold text-[#0F2044]">Share Session</h2>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl text-[#7A8493] hover:bg-[#F6F7F8] hover:text-[#0F2044] transition-all hover:scale-[1.02]"><IcClose /></button>
        </div>
        <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-2xl border border-black/5 bg-white p-3 shadow-inner">
          <QRCode value={shareUrl} size={180} fgColor="#0F2044" bgColor="#FFFFFF" title={`QLESS session ${SESSION_ID}`} />
        </div>
        <p className="mt-5 text-sm font-medium text-[#7A8493]">Scan with camera to join cart</p>
        <button onClick={handleCopy} className="mx-auto mt-5 flex h-11 items-center justify-center rounded-xl bg-[#0F2044] px-6 font-poppins text-sm font-semibold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]">
          {copied ? "Link Copied!" : "Copy Link"}
        </button>
        <button onClick={onClose} className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-[#7A8493] transition-all hover:bg-[#F6F7F8] hover:text-[#0F2044]">Close</button>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// Cart Screen
// ─────────────────────────────────────────────────────────────────────────────

function CartScreen({
  items, total, itemCount,
  onAddProduct, onQtyChange, onClear,
  onShare, onCheckout,
}: {
  items: CartItem[]; total: number; itemCount: number;
  onAddProduct: (p: Product) => void; onQtyChange: (id: number, delta: number) => void; onClear: () => void;
  onShare: () => void; onCheckout: () => void;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const { appliedCoupon, nextCoupon } = getCouponStatus(total);

  return (
    <div className="flex flex-1 flex-col qless-fade-in">
      {/* Scrollable content — bottom padding reserves space so items aren't hidden behind the fixed action bar */}
      <div className="flex-1 pb-56">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="font-poppins text-3xl font-semibold tracking-[-0.05em] text-[#0F2044]">Cart</h2>
            <p className="mt-1 text-sm text-[#758092]">Items scanned during your visit.</p>
          </div>
          {items.length > 0 && (
            <button onClick={onClear} className="rounded-xl px-3 py-2 text-xs font-semibold text-[#7A8493] transition hover:bg-white hover:scale-[1.02] active:scale-95">
              Clear all
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/50 bg-white/70 p-8 text-center shadow-[0_8px_24px_rgba(15,32,68,0.08)] backdrop-blur-md">
            <div>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F6F7F8] text-[#9AA3AF]"><IcBag /></div>
              <h3 className="mt-5 font-poppins text-xl font-semibold text-[#0F2044]">Cart is empty</h3>
              <p className="mx-auto mt-2 max-w-[240px] text-sm text-[#7A8493]">Tap "Add Item" to add products to your session.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <article key={item.id} className="flex items-center justify-between rounded-2xl border border-white/50 bg-white/75 p-4 shadow-[0_8px_24px_rgba(15,32,68,0.08)] backdrop-blur-md transition duration-200 hover:scale-[1.01] hover:bg-white/85">
                <div className="min-w-0 pr-4">
                  <h3 className="truncate font-poppins text-base font-semibold text-[#0F2044] flex items-center gap-2">
                    {item.name}
                  </h3>
                  <p className="mt-0.5 text-sm text-[#7A8493] flex items-center gap-2">
                    {fmt(item.price)} each
                    {(item as any).offer && (
                      <span className="text-[9px] font-bold bg-[#EEF8F0] text-[#2E9E44] px-1.5 py-0.5 rounded border border-[#2E9E44]/15">
                        {(item as any).offer}
                      </span>
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200/30 select-none">
                      ⏳ Exp: {item.expiryDays}d
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold border select-none ${
                      item.freshnessScore >= 95 ? "bg-[#EEF8F0] text-[#2E9E44] border-[#2E9E44]/15" :
                      item.freshnessScore >= 85 ? "bg-blue-50 text-blue-700 border-blue-200/30" :
                      "bg-red-50 text-red-700 border-red-200/30"
                    }`} title={item.recommendation}>
                      ✨ Fresh: {item.freshnessScore}%
                    </span>
                  </div>
                  <p className="mt-1 text-[9px] text-[#8A94A3] font-alegreya italic leading-none select-none">
                    * {item.recommendation}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="font-poppins text-lg font-semibold text-[#0F2044]">{fmt(item.price * item.quantity)}</p>
                  <div className="flex items-center gap-1.5 rounded-xl border border-black/5 bg-[#F8F9FA] p-1">
                    <button onClick={() => onQtyChange(item.id, -1)} aria-label={`Remove ${item.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-semibold text-[#0F2044] transition hover:bg-white active:scale-90">−</button>
                    <span className="min-w-[20px] text-center text-sm font-bold text-[#0F2044]">{item.quantity}</span>
                    <button onClick={() => onQtyChange(item.id,  1)} aria-label={`Add ${item.name}`}    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-semibold text-[#0F2044] transition hover:bg-white active:scale-90">+</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 px-4 pb-4">
        <div className="mx-auto w-full max-w-[420px] rounded-t-2xl border border-white/50 bg-white/85 p-5 shadow-[0_-12px_34px_rgba(15,32,68,0.14)] backdrop-blur-xl">
          {nextCoupon && total > 0 && (
            <div className="mb-4 rounded-xl border border-dashed border-[#2E9E44]/30 bg-[#EEF8F0]/80 p-3 text-xs font-semibold backdrop-blur-sm">
              <div className="flex items-center justify-between mb-1 text-[#0F2044]">
                <span className="flex items-center gap-1 select-none">
                  🏷️ {appliedCoupon ? `Unlocked ${appliedCoupon.code}!` : "Unlock Special Offers"}
                </span>
                <span className="text-[#2E9E44]">
                  Add {fmt(nextCoupon.threshold - total)} more
                </span>
              </div>
              <div className="w-full bg-[#E5E7EB] h-1.5 rounded-full overflow-hidden mb-1">
                <div 
                  className="bg-[#2E9E44] h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, (total / nextCoupon.threshold) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-[#7A8493] font-normal leading-normal select-none">
                {appliedCoupon 
                  ? `You unlocked ${appliedCoupon.discountValue}${appliedCoupon.discountType === "percent" ? "%" : " " + fmt(1)} off. Get ${nextCoupon.discountValue}${nextCoupon.discountType === "percent" ? "%" : " " + fmt(1)} off by adding more!`
                  : `Add items worth ${fmt(nextCoupon.threshold - total)} more to get ${nextCoupon.discountValue}% off with code ${nextCoupon.code}!`}
              </p>
            </div>
          )}

          {total >= 199 && !nextCoupon && (
            <div className="mb-4 rounded-xl border border-dashed border-[#2E9E44]/30 bg-[#EEF8F0]/80 p-3 text-xs font-semibold backdrop-blur-sm">
              <div className="flex items-center justify-between text-[#0F2044]">
                <span className="flex items-center gap-1 select-none">
                  🎉 Max Coupon Applied!
                </span>
                <span className="text-[#2E9E44] font-bold">
                  {appliedCoupon?.code} Active
                </span>
              </div>
              <p className="text-[10px] text-[#7A8493] font-normal leading-normal mt-1 select-none">
                You have unlocked the maximum discount tier of {appliedCoupon?.discountValue}{appliedCoupon?.discountType === "percent" ? "%" : " " + fmt(1)} off!
              </p>
            </div>
          )}

          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#8A94A3]">Total</p>
              <p className="mt-1 font-poppins text-3xl font-bold tracking-tight text-[#0F2044]">{fmt(total)}</p>
            </div>
            <p className="rounded-full border border-black/5 bg-[#F6F7F8] px-3 py-1 text-xs font-semibold text-[#7A8493]">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setScannerOpen(true)}
              className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#2E9E44] font-poppins text-sm font-semibold text-white shadow-[0_10px_22px_rgba(46,158,68,0.22)] transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <IcScan /> Scan &amp; Add Item
            </button>
            <button onClick={onShare} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#D8DDE3] bg-white font-poppins text-sm font-semibold text-[#0F2044] transition hover:scale-[1.02] hover:bg-[#F8F9FA] active:scale-[0.98]">
              <IcShare /> Share
            </button>
            <button onClick={onCheckout} disabled={items.length === 0} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0F2044] font-poppins text-sm font-semibold text-white shadow-md transition hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100">
              <IcCheck /> Checkout
            </button>
          </div>
        </div>
      </div>

      {/* Barcode scanner modal — opens on "Scan & Add Item" */}
      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onItemScanned={(product) => {
          onAddProduct(product);
          setScannerOpen(false);
        }}
        existingIds={items.map(i => i.id)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkout Screen
// ─────────────────────────────────────────────────────────────────────────────

function CheckoutScreen({
  items, total, onBack, onPay,
}: {
  items: CartItem[]; total: number;
  onBack: () => void; onPay: (discountedTotal: number) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [payState, setPayState] = useState<"idle" | "processing" | "success">("idle");
  const { appliedCoupon, discountAmount, finalTotal } = getCouponStatus(total);

  const handlePay = () => {
    setPayState("processing");
    // processing delay
    setTimeout(() => {
      setPayState("success");
      // success duration
      setTimeout(() => {
        onPay(finalTotal);
      }, 1500);
    }, 1500);
  };

  if (payState === "processing") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center qless-fade-in">
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#EEF8F0]">
          <svg className="h-10 w-10 animate-spin text-[#2E9E44]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
          </svg>
        </div>
        <h3 className="mt-6 font-poppins text-2xl font-semibold text-[#0F2044]">Processing Payment</h3>
        <p className="mt-2 font-alegreya text-[#7A8493]">Please wait securely...</p>
      </div>
    );
  }

  if (payState === "success") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center qless-fade-in">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#2E9E44] text-white shadow-[0_8px_30px_rgba(46,158,68,0.4)] qless-scale-in">
          <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <h3 className="mt-6 font-poppins text-2xl font-semibold text-[#0F2044] qless-fade-in [animation-delay:200ms]">Payment Successful!</h3>
        <p className="mt-2 font-poppins font-bold text-[#2E9E44] qless-fade-in [animation-delay:400ms]">{fmt(finalTotal)} Paid</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col qless-fade-in pb-36">
      <div className="mb-6">
        <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-[#7A8493] transition hover:text-[#0F2044]">
          <IcBack /> Back to Cart
        </button>
        <h2 className="font-poppins text-3xl font-semibold tracking-tight text-[#0F2044]">Checkout</h2>
        <p className="mt-1 font-alegreya text-base text-[#7A8493]">Review your order and pay</p>
      </div>

      <div className="rounded-2xl border border-white/50 bg-white/80 p-5 shadow-[0_8px_24px_rgba(15,32,68,0.08)] backdrop-blur-md">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[#7A8493]">Order Summary</p>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item.id}>
              <div className="flex justify-between">
                <div>
                  <p className="font-poppins font-semibold text-[#0F2044]">{item.name}</p>
                  <p className="text-xs text-[#7A8493] font-alegreya">Qty {item.quantity} × {fmt(item.price)}</p>
                </div>
                <p className="font-poppins font-semibold text-[#0F2044]">{fmt(item.price * item.quantity)}</p>
              </div>
              {i < items.length - 1 && <div className="mt-3 h-px bg-black/5" />}
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-black/5 pt-4 space-y-2.5">
          <div className="flex justify-between items-center text-sm">
            <span className="font-alegreya text-[#7A8493]">Subtotal</span>
            <span className="font-poppins font-semibold text-[#0F2044]">{fmt(total)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between items-center text-sm text-[#2E9E44]">
              <span className="font-alegreya flex items-center gap-1">
                🏷️ Discount ({appliedCoupon?.code})
              </span>
              <span className="font-poppins font-semibold font-bold">-{fmt(discountAmount)}</span>
            </div>
          )}
          <div className="h-px bg-black/5" />
          <div className="flex justify-between items-center">
            <span className="font-alegreya text-base font-bold text-[#0F2044]">Grand Total</span>
            <span className="font-poppins text-2xl font-bold text-[#2E9E44]">{fmt(finalTotal)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#7A8493]">Payment Method</p>
        <div className="space-y-2.5">
          {(Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).map(([key, label]) => (
            <label key={key} className={`flex cursor-pointer items-center justify-between rounded-2xl border-2 p-4 backdrop-blur-md transition-all duration-200 ${method === key ? "border-[#2E9E44] bg-[#EEF8F0]/90 shadow-[0_4px_12px_rgba(46,158,68,0.14)]" : "border-white/50 bg-white/75 hover:border-[#D8DDE3] hover:bg-white/85"}`}>
              <div className="flex items-center gap-3">
                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${method === key ? "border-[#2E9E44]" : "border-[#D8DDE3]"}`}>
                  {method === key && <div className="h-2.5 w-2.5 rounded-full bg-[#2E9E44]" />}
                </div>
                <span className="font-poppins font-semibold text-[#0F2044]">{label}</span>
              </div>
              <input type="radio" name="pay" className="hidden" checked={method === key} onChange={() => setMethod(key)} />
            </label>
          ))}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 px-4 pb-4">
        <div className="mx-auto w-full max-w-[420px] rounded-t-2xl border border-white/50 bg-white/85 p-5 shadow-[0_-12px_34px_rgba(15,32,68,0.14)] backdrop-blur-xl">
          <button
            onClick={handlePay}
            className="flex w-full h-14 items-center justify-center gap-2 rounded-xl bg-[#2E9E44] font-poppins text-base font-semibold text-white shadow-[0_10px_22px_rgba(46,158,68,0.25)] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Pay {fmt(finalTotal)} Now
          </button>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// Exit Verification Screen
// ─────────────────────────────────────────────────────────────────────────────

function ExitScreen({
  total, paidAt, onDone, sessionId
}: {
  total: number; paidAt: string; onDone: () => void; sessionId: string;
}) {
  const [scanState, setScanState] = useState<ScanState>("verifying");
  const [receiptId, setReceiptId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Create the receipt in supabase
    const createReceipt = async () => {
      const { data, error } = await supabase.from('receipts').insert([
        { session_id: sessionId, total, status: 'paid' }
      ]).select().single();
      
      if (data) {
        setReceiptId(data.id);
      } else {
        console.error(error);
        setScanState("error");
      }
    };
    createReceipt();
  }, [sessionId, total]);

  useEffect(() => {
    if (!receiptId) return;

    // 2. Listen for verification by staff (Realtime WebSocket)
    const channel = supabase
      .channel(`receipt-sync-${receiptId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'receipts', filter: `id=eq.${receiptId}` },
        (payload) => {
          if (payload.new.status === 'verified') {
            setScanState('success');
          }
        }
      )
      .subscribe();

    // 3. Fallback Polling (checks every 2 seconds for high reliability)
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('receipts')
        .select('status')
        .eq('id', receiptId)
        .maybeSingle();

      if (data && data.status === 'verified') {
        setScanState('success');
        clearInterval(interval);
      }
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [receiptId]);

  const receiptStr = receiptId ? receiptId : `RECEIPT_PENDING`;

  if (scanState === "success") {
    return (
      <div className="flex flex-grow flex-col justify-center items-center qless-fade-in pb-20 text-center">
        <div className="mx-auto w-full max-w-[320px] rounded-3xl border border-white/60 bg-white/90 p-8 shadow-[0_16px_40px_rgba(15,32,68,0.12)] backdrop-blur-xl flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#2E9E44] text-white shadow-[0_8px_24px_rgba(46,158,68,0.3)] mb-6 animate-bounce">
            <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          </div>
          
          <h2 className="font-poppins text-2xl font-bold text-[#0F2044] mb-2">Verification Done!</h2>
          <p className="font-alegreya text-base text-[#7A8493] mb-6">You can leave the store now. Thank you for shopping with QLESS!</p>
          
          <div className="w-full space-y-3 border-t border-dashed border-[#CBD5E1] pt-5">
            <div className="flex items-center justify-between">
              <span className="font-alegreya text-sm text-[#7A8493]">Amount Paid</span>
              <span className="font-poppins text-sm font-semibold text-[#2E9E44]">{fmt(total)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-alegreya text-sm text-[#7A8493]">Receipt ID</span>
              <span className="font-poppins text-xs font-semibold text-[#0F2044] truncate max-w-[120px]" title={receiptId || ""}>
                {receiptId ? receiptId.substring(0, 8) : "N/A"}...
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onDone}
          className="mt-8 flex h-12 w-full max-w-[320px] mx-auto items-center justify-center gap-2 rounded-xl bg-[#2E9E44] font-poppins text-sm font-semibold text-white shadow-[0_8px_20px_rgba(46,158,68,0.22)] transition hover:scale-[1.02] active:scale-[0.98]"
        >
          Start New Session
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col qless-fade-in pb-20">
      <div className="mb-6 text-center">
        <h2 className="font-poppins text-3xl font-semibold tracking-tight text-[#0F2044]">Exit Pass</h2>
        <p className="mt-1 font-alegreya text-base text-[#7A8493]">Scan this QR at the exit gate</p>
      </div>

      <div className="qless-scale-in">
        <div className="mx-auto w-full max-w-[320px] rounded-3xl border border-white/60 bg-white/90 p-8 text-center shadow-[0_16px_40px_rgba(15,32,68,0.12)] backdrop-blur-xl">
          <div className="mx-auto mb-6 flex aspect-square w-full items-center justify-center rounded-2xl bg-white shadow-inner p-4 border border-[#E5E7EB]">
            <QRCode value={receiptStr} size={220} fgColor="#0F2044" bgColor="transparent" title="Exit Receipt QR" />
          </div>
          
          <h3 className="font-poppins text-2xl font-bold text-[#0F2044] mb-1">Receipt {RECEIPT_ID}</h3>
          <p className="font-poppins text-sm font-semibold text-[#2E9E44] mb-5">{fmt(total)} Paid</p>
          
          <div className="space-y-3 border-t border-dashed border-[#CBD5E1] pt-5">
            <div className="flex items-center justify-between">
              <span className="font-alegreya text-sm text-[#7A8493]">Verified At</span>
              <span className="font-poppins text-sm font-semibold text-[#0F2044]">{paidAt}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-alegreya text-sm text-[#7A8493]">Session</span>
              <span className="font-poppins text-sm font-semibold text-[#0F2044]">#{SESSION_ID}</span>
            </div>
          </div>
          
          <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-[#2E9E44]/20 bg-[#EEF8F0] px-3.5 py-1.5 text-[#2E9E44]">
            <IcShield />
            <span className="font-poppins text-xs font-semibold">QLESS Secure Pass</span>
          </div>
        </div>
        
        <button
          onClick={onDone}
          className="mt-8 flex h-12 w-full max-w-[320px] mx-auto items-center justify-center gap-2 rounded-xl border-2 border-[#0F2044] bg-[#0F2044] font-poppins text-sm font-semibold text-white transition hover:bg-transparent hover:text-[#0F2044] active:scale-[0.98]"
        >
          Done — Back to Home
        </button>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// Root App — connects all screens with shared state
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomerScreen() {
  const [view, setView]         = useState<AppView>("cart");
  const [items, setItems]       = useState<CartItem[]>(INITIAL_ITEMS);
  const [shareOpen, setShare]   = useState(false);
  const [paidAt, setPaidAt]     = useState("");
  const [paidTotal, setPaidTotal] = useState<number | null>(null);
  const navigate = useNavigate();

  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const itemCount = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  const addProduct = async (product: Product) => {
    // Fire and forget to supabase
    supabase.from('cart_items').insert([{
      session_id: SESSION_ID,
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      quantity: 1
    }]).then(() => {});

    setItems(cur => {
      const ex = cur.find(i => i.id === product.id);
      return ex
        ? cur.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...cur, { id: product.id, name: product.name, price: product.price, quantity: 1, offer: product.offer } as any];
    });
  };

  const changeQty = (id: number, delta: number) => {
    setItems(cur => cur.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const handlePay = async (discountedTotal: number) => {
    // Call Supabase function to decay stock of items in cart
    await supabase.rpc("decay_stock", { p_session_id: SESSION_ID });

    setPaidTotal(discountedTotal);
    setPaidAt(nowTime());
    setView("exit");
  };

  const handleDone = () => {
    // Reset entire session
    setItems([]);
    setPaidAt("");
    setPaidTotal(null);
    setView("cart");
  };

  return (
    <main
      className="relative min-h-screen px-5 pb-8 pt-6 text-[#0F2044] antialiased qless-app-bg"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Soft overlay to keep content readable over the photo */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-white/70 via-white/55 to-white/75" aria-hidden="true" />

      <div className="relative z-[1] mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[420px] flex-col">

        {/* App bar */}
        <header className="flex items-center justify-between pb-1 pt-1">
          <div>
            <p className="font-poppins text-[22px] font-bold tracking-[-0.03em] text-[#0F2044] cursor-pointer" onClick={() => navigate("/")}>← QLESS</p>
            <p className="text-xs font-medium text-[#7A8493]">Session #{SESSION_ID} · DMart</p>
          </div>
          <div className="rounded-full border border-white/40 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#2E9E44] shadow-sm backdrop-blur-sm">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </div>
        </header>

        {/* Step indicator */}
        <StepBar current={view} />

        {/* View router */}
        {view === "cart" && (
          <CartScreen
            items={items} total={total} itemCount={itemCount}
            onAddProduct={addProduct} onQtyChange={changeQty} onClear={() => setItems([])}
            onShare={() => setShare(true)} onCheckout={() => setView("checkout")}
          />
        )}

        {view === "checkout" && (
          <CheckoutScreen
            items={items} total={total}
            onBack={() => setView("cart")} onPay={handlePay}
          />
        )}

        {view === "exit" && (
          <ExitScreen total={paidTotal !== null ? paidTotal : total} paidAt={paidAt} onDone={handleDone} sessionId={SESSION_ID} />
        )}

        {/* Footer */}
        <footer className="pb-2 pt-6 text-center">
          <p className="font-alegreya text-xs text-[#A0A8B4]">Scan. Pay. Go. — No queues, no waiting.</p>
        </footer>
      </div>

      <ShareModal open={shareOpen} onClose={() => setShare(false)} />
    </main>
  );
}
