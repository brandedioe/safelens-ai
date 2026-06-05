// src/lib/whatsapp.ts — WhatsApp result sharing helper

interface ShareData {
  barcode:  string;
  product:  { name?: string; brand?: string } | null;
  analysis: {
    score:         number;
    grade:         string;
    findings:      Array<{ name: string; risk: string; type: string }>;
    allergyAlerts: string[];
  };
}

export function buildShareMessage(data: ShareData): string {
  const name   = data.product?.name  ?? 'Unknown Product';
  const brand  = data.product?.brand ? ' by ' + data.product.brand : '';
  const grade  = data.analysis.grade;
  const score  = data.analysis.score;

  const gradeEmoji: Record<string, string> = {
    A: '🟢', B: '🟢', C: '🟡', D: '🟠', F: '🔴',
  };
  const verdict = score >= 70 ? '✅ Generally safe' : score >= 50 ? '⚠️ Use with caution' : '❌ AVOID this product';

  const lines: string[] = [
    '🔍 *SafeLens AI Safety Scan*',
    '',
    '📦 *' + name + '*' + brand,
    (gradeEmoji[grade] ?? '⚪') + ' Safety Score: *' + score + '/100* — Grade *' + grade + '*',
    '',
  ];

  if (data.analysis.allergyAlerts.length > 0) {
    lines.push('🚨 *ALLERGY ALERT:*');
    data.analysis.allergyAlerts.forEach(a => lines.push('• Contains ' + a));
    lines.push('');
  }

  const dangers = data.analysis.findings.filter(f => f.type === 'danger').slice(0, 5);
  if (dangers.length > 0) {
    lines.push('⚠️ *Flagged Additives:*');
    dangers.forEach(f => lines.push('• ' + f.name + ' (' + f.risk + ' risk)'));
    if (data.analysis.findings.length > 5) {
      lines.push('• +' + (data.analysis.findings.length - 5) + ' more');
    }
    lines.push('');
  }

  lines.push(verdict);
  lines.push('');
  lines.push('_Scanned with SafeLens AI — Guardian of Nigerian Consumers_');
  lines.push('📲 Install free: https://safelens-ai.vercel.app');

  return lines.join('\n');
}

export function shareOnWhatsApp(data: ShareData) {
  const text = buildShareMessage(data);
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}