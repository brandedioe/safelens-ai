import React, { useState } from 'react';
import { Search } from 'lucide-react';

export default function ManualEntry({ onSearch }: { onSearch: (barcode: string) => void }) {
  const [barcode, setBarcode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcode.trim().length > 3) {
      onSearch(barcode.trim());
      setBarcode(''); // clear after searching
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full relative z-10 bg-[#0D1220] p-6 rounded-2xl border border-gray-800">
      <h2 className="text-white font-semibold mb-4 text-center">Enter Barcode Manually</h2>
      <div className="flex gap-2">
        <input
          type="number"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="e.g. 5449000000996"
          className="flex-1 bg-[#131928] border border-gray-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#10B981] transition-colors"
        />
        <button 
          type="submit"
          disabled={barcode.length < 4}
          className="bg-[#10B981] text-white px-5 rounded-xl font-medium hover:bg-[#0EA5E9] transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          <Search size={20} />
        </button>
      </div>
    </form>
  );
}