import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Activity, ShoppingBag, CheckCircle, Store, Users, ArrowLeft, Tag } from "lucide-react";

export default function AdminScreen() {
  const navigate = useNavigate();
  const [activeUsers, setActiveUsers] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [feed, setFeed] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editStock, setEditStock] = useState<number>(0);
  const [editOffer, setEditOffer] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const handleEditClick = (p: any) => {
    setEditingProduct(p);
    setEditPrice(p.price);
    setEditStock(p.stock ?? 100);
    setEditOffer(p.offer ?? "");
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('products')
      .update({
        price: Number(editPrice),
        stock: Number(editStock),
        offer: editOffer || null
      })
      .eq('id', editingProduct.id);

    setIsSaving(false);
    if (!error) {
      setEditingProduct(null);
    } else {
      alert("Error updating product: " + error.message);
    }
  };

  useEffect(() => {
    // Initial fetch of today's receipts for revenue
    const fetchStats = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data: receipts } = await supabase
        .from('receipts')
        .select('total, status, paid_at')
        .gte('paid_at', today);
        
      if (receipts) {
        const rev = receipts.reduce((sum, r) => sum + Number(r.total), 0);
        setRevenue(rev);
      }
      
      const { data: prods } = await supabase.from('products').select('*');
      if (prods) setProducts(prods);
    };
    fetchStats();

    // Setup realtime subscriptions
    const channel = supabase
      .channel('admin-dashboard')
      // Listen to new cart items
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cart_items' }, payload => {
        setFeed(prev => [{
          id: Date.now(),
          type: 'cart',
          message: `Someone scanned ${payload.new.product_name}`,
          time: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 50));
        // Mock active user pulse
        setActiveUsers(curr => curr + 1);
        setTimeout(() => setActiveUsers(curr => Math.max(0, curr - 1)), 60000); // decay after 1 min
      })
      // Listen to checkouts
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'receipts' }, payload => {
        if (payload.new.status === 'paid') {
          setRevenue(curr => curr + Number(payload.new.total));
          setFeed(prev => [{
            id: Date.now(),
            type: 'checkout',
            message: `Checkout completed for ₹${payload.new.total}`,
            time: new Date().toLocaleTimeString()
          }, ...prev].slice(0, 50));
        }
      })
      // Listen to gate verifications
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'receipts' }, payload => {
        if (payload.new.status === 'verified' && payload.old.status === 'paid') {
          setFeed(prev => [{
            id: Date.now(),
            type: 'verify',
            message: `Customer exited store (Receipt ${payload.new.id.substring(0,8)})`,
            time: new Date().toLocaleTimeString()
          }, ...prev].slice(0, 50));
        }
      })
      // Listen to live stock updates
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, payload => {
        setProducts(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));
        setFeed(prev => [{
          id: Date.now(),
          type: 'cart',
          message: `Stock level updated for ${payload.new.name} to ${payload.new.stock}`,
          time: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 50));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F6F7F8] font-poppins text-[#0F2044]">
      {/* Navbar */}
      <header className="bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-black/5 transition text-[#7A8493]">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#0F2044]">QLESS Command Center</h1>
            <p className="text-xs font-semibold text-[#2E9E44] flex items-center gap-1.5">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E9E44] opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-[#2E9E44]"></span></span>
              Live Store Metrics connected to Supabase
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-[#EEF8F0] px-4 py-2 rounded-full border border-[#2E9E44]/20">
          <Store className="h-4 w-4 text-[#2E9E44]" />
          <span className="text-sm font-semibold text-[#2E9E44]">Store: DMart HSR</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: KPI & Products */}
        <div className="lg:col-span-2 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm">
              <div className="flex items-center gap-3 text-[#7A8493] mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Activity className="h-5 w-5" /></div>
                <h3 className="font-semibold text-sm uppercase tracking-wider">Active Shoppers</h3>
              </div>
              <p className="text-5xl font-bold text-[#0F2044]">{activeUsers}</p>
              <p className="text-xs text-[#7A8493] mt-2 font-alegreya">Scanning items right now</p>
            </div>
            
            <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm">
              <div className="flex items-center gap-3 text-[#7A8493] mb-4">
                <div className="p-2 bg-[#EEF8F0] text-[#2E9E44] rounded-xl"><CheckCircle className="h-5 w-5" /></div>
                <h3 className="font-semibold text-sm uppercase tracking-wider">Today's Revenue</h3>
              </div>
              <p className="text-5xl font-bold text-[#0F2044]">₹{revenue.toLocaleString('en-IN')}</p>
              <p className="text-xs text-[#7A8493] mt-2 font-alegreya">Total from QLESS checkouts</p>
            </div>
          </div>

          {/* Product Catalog Management */}
          <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-black/5 flex justify-between items-center bg-[#FDFDFE]">
              <div className="flex items-center gap-2 text-[#0F2044]">
                <Tag className="h-5 w-5 text-[#7A8493]" />
                <h2 className="font-bold text-lg">Product Catalog</h2>
              </div>
              <span className="text-xs font-semibold bg-black/5 px-3 py-1 rounded-full text-[#7A8493]">
                {products.length} Items synced
              </span>
            </div>
            <div className="p-0 overflow-auto max-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F9FAFB] sticky top-0 z-10 text-xs font-semibold text-[#7A8493] uppercase tracking-wider border-b border-black/5">
                  <tr>
                    <th className="px-6 py-3 font-medium">Product</th>
                    <th className="px-6 py-3 font-medium">Category</th>
                    <th className="px-6 py-3 font-medium">Barcode</th>
                    <th className="px-6 py-3 text-right font-medium">Stock</th>
                    <th className="px-6 py-3 text-right font-medium">Offer</th>
                    <th className="px-6 py-3 text-right font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 text-sm">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-[#F9FAFB] transition cursor-pointer" onClick={() => handleEditClick(p)}>
                      <td className="px-6 py-4 font-semibold text-[#0F2044] flex items-center gap-2">
                        <span className="text-xl">{p.emoji}</span> {p.name}
                      </td>
                      <td className="px-6 py-4 text-[#7A8493]">{p.category}</td>
                      <td className="px-6 py-4 text-[#7A8493] font-mono text-xs">{p.barcode}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-semibold px-2 py-1 rounded-lg text-xs ${
                          p.stock < 10 ? 'bg-red-50 text-red-600 font-bold border border-red-200' : 'bg-black/5 text-[#0F2044]'
                        }`}>
                          {p.stock ?? 100} units
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {p.offer ? (
                          <span className="font-bold text-xs bg-[#EEF8F0] text-[#2E9E44] px-2 py-1 rounded-lg border border-[#2E9E44]/15">
                            {p.offer}
                          </span>
                        ) : (
                          <span className="text-xs text-[#7A8493] italic">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-[#2E9E44]">₹{p.price}</td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-[#7A8493]">No products found in Supabase. Run the schema SQL.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Live Feed */}
        <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-120px)]">
          <div className="px-6 py-5 border-b border-black/5 flex justify-between items-center bg-[#FDFDFE]">
            <div className="flex items-center gap-2 text-[#0F2044]">
              <Activity className="h-5 w-5 text-[#2E9E44] animate-pulse" />
              <h2 className="font-bold text-lg">Live Activity Feed</h2>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {feed.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#9AA3AF] space-y-3">
                <ShoppingBag className="h-10 w-10 opacity-20" />
                <p className="text-sm font-medium">Waiting for customer activity...</p>
              </div>
            ) : (
              feed.map((item) => (
                <div key={item.id} className="flex gap-4 p-4 rounded-2xl bg-[#F9FAFB] border border-black/5 animate-in slide-in-from-top-4 fade-in duration-300">
                  <div className="shrink-0 mt-0.5">
                    {item.type === 'cart' && <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><ShoppingBag className="h-4 w-4" /></div>}
                    {item.type === 'checkout' && <div className="h-8 w-8 rounded-full bg-[#EEF8F0] text-[#2E9E44] flex items-center justify-center"><CheckCircle className="h-4 w-4" /></div>}
                    {item.type === 'verify' && <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><Users className="h-4 w-4" /></div>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0F2044]">{item.message}</p>
                    <p className="text-xs text-[#7A8493] mt-1">{item.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </main>

      {/* Product Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-[420px] rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-poppins text-lg font-bold text-[#0F2044] mb-1">
              Edit Product Details
            </h3>
            <p className="text-xs text-[#7A8493] mb-6 flex items-center gap-1.5">
              <span className="text-xl">{editingProduct.emoji}</span> {editingProduct.name}
            </p>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#7A8493] uppercase tracking-wider mb-2">Price (₹)</label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={e => setEditPrice(Number(e.target.value))}
                  className="w-full h-12 px-4 rounded-xl border border-black/10 bg-[#F9FAFB] font-poppins focus:outline-none focus:border-[#2E9E44]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7A8493] uppercase tracking-wider mb-2">Stock Level</label>
                <input
                  type="number"
                  value={editStock}
                  onChange={e => setEditStock(Number(e.target.value))}
                  className="w-full h-12 px-4 rounded-xl border border-black/10 bg-[#F9FAFB] font-poppins focus:outline-none focus:border-[#2E9E44]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7A8493] uppercase tracking-wider mb-2">Discount / Promo Offer</label>
                <input
                  type="text"
                  placeholder="e.g. 10% OFF, Buy 1 Get 1"
                  value={editOffer}
                  onChange={e => setEditOffer(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-black/10 bg-[#F9FAFB] font-poppins focus:outline-none focus:border-[#2E9E44]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 h-12 rounded-xl border border-[#D8DDE3] bg-white text-[#7A8493] font-semibold transition hover:bg-[#F8F9FA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 h-12 rounded-xl bg-[#2E9E44] text-white font-semibold shadow-lg hover:bg-[#288a3b] transition disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
