import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import domtoimage from 'dom-to-image-more';
import ShareCard from './ShareCard';
import { X, Download, Loader2 } from 'lucide-react';

// ── Twitter / X logo SVG ──────────────────────────────────────────────────────
const XLogo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.735-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

export default function ShareModal({ isOpen, onClose, raceData }) {
  const [format, setFormat]             = useState('square');
  const [isGenerating, setGenerating]   = useState(false);
  const [isMobile, setIsMobile]         = useState(false);
  const [viewport, setViewport]         = useState({ width: 1280, height: 800 });
  const EXPORT_CARD_ID = 'share-card-export';

  // Responsive check
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const canUsePortal = typeof document !== 'undefined';

  if (!raceData || !canUsePortal) return null;

  const waitForNodeAssets = async (node) => {
    if (!node) return;

    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // Ignore font readiness failures and continue.
      }
    }

    const images = Array.from(node.querySelectorAll('img'));
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          const finish = () => resolve();
          img.addEventListener('load', finish, { once: true });
          img.addEventListener('error', finish, { once: true });
          setTimeout(resolve, 2500);
        });
      })
    );
  };

  // ── Download handler ───────────────────────────────────────────────────────
  const downloadCard = async () => {
    setGenerating(true);
    try {
      const node = document.getElementById(EXPORT_CARD_ID);
      if (!node) return;

      const exportHeight = format === 'portrait' ? 1350 : 1080;

      await waitForNodeAssets(node);

      const captureOptions = {
        quality: 1,
        scale: 2,
        bgcolor: '#080808',
        width: 1080,
        height: exportHeight,
        cacheBust: true,
        useCORS: true,
        allowTaint: false,
        style: {
          margin: '0',
          transform: 'none',
          border: 'none',
        },
      };

      const blob = await domtoimage.toBlob(node, captureOptions);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = (raceData.raceName || 'race').replace(/\s+/g, '-').toLowerCase();
      link.download = `boxbox-${safeName}-${raceData.year || '2026'}.png`;
      link.href = url;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.error('Download failed:', err);
      try {
        const node = document.getElementById(EXPORT_CARD_ID);
        if (!node) throw new Error('Share card not found');
        const exportHeight = format === 'portrait' ? 1350 : 1080;
        await waitForNodeAssets(node);

        const dataUrl = await domtoimage.toPng(
          node,
          {
            scale: 2,
            bgcolor: '#080808',
            width: 1080,
            height: exportHeight,
            cacheBust: true,
            useCORS: true,
            allowTaint: false,
            style: {
              margin: '0',
              transform: 'none',
              border: 'none',
            },
          }
        );
        window.open(dataUrl, '_blank');
      } catch (_fallbackError) {
        alert('Download failed. Try on desktop.');
      }
    } finally {
      setGenerating(false);
    }
  };

  // ── Twitter share handler ──────────────────────────────────────────────────
  const shareOnX = () => {
    const { raceName, year, p1, p2, p3, fastestLap } = raceData;
    const noSpaces = (raceName || '').replace(/\s+/g, '');
    const text = encodeURIComponent(
      `🏎️ ${raceName} ${year}\n\n` +
      `🥇 ${p1?.name} — ${p1?.team}\n` +
      `🥈 ${p2?.name} — ${p2?.team}\n` +
      `🥉 ${p3?.name} — ${p3?.team}\n\n` +
      `⚡ Fastest Lap: ${fastestLap?.driver} · ${fastestLap?.time}\n\n` +
      `Analysed with @BoxBoxApp 🏎️\n` +
      `boxbox.app\n` +
      `#F1 #Formula1 #${noSpaces}GP`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'width=560,height=440');
  };

  // ── Scale for preview ──────────────────────────────────────────────────────
  const baseHeight = format === 'portrait' ? 1350 : 1080;
  const reserveHeight = isMobile ? 360 : 320;
  const maxPreviewW = isMobile
    ? Math.max(240, Math.min(viewport.width - 32, 420))
    : Math.max(320, Math.min(viewport.width - 120, 560));
  const maxPreviewH = Math.max(240, viewport.height - reserveHeight);
  const autoScale = Math.min(maxPreviewW / 1080, maxPreviewH / baseHeight);
  const SCALE = Math.min(isMobile ? 0.34 : 0.46, Math.max(isMobile ? 0.2 : 0.24, autoScale));
  const previewW = 1080 * SCALE;
  const previewH = baseHeight * SCALE;

  // ── Shared inner content ───────────────────────────────────────────────────
  const modalInner = (
    <>
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/5 bg-[rgba(14,14,14,0.98)]">
        <div>
          <div className="text-white font-['Space_Grotesk'] font-bold text-lg">Share Race Card</div>
          <div className="text-[#555] text-xs mt-0.5 font-['Space_Grotesk'] tracking-widest uppercase">Download or post to social</div>
        </div>
        <button
          onClick={onClose}
          className="text-[#555] hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
        >
          <X size={18} />
        </button>
      </div>

      {/* Format selector */}
      <div className={`${isMobile ? 'flex flex-col' : 'flex'} gap-2 px-5 sm:px-6 pt-5`}>
        {[
          { id: 'square',   label: '📸 Square',  sub: '1080×1080 · Instagram / Reddit' },
          { id: 'portrait', label: '📲 Story',   sub: '1080×1350 · Stories / Snapchat' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFormat(f.id)}
            className={`${isMobile ? 'w-full' : 'flex-1'} py-2.5 px-3 rounded-xl border text-left transition-all ${
              format === f.id
                ? 'border-[#F59E0B] bg-[#F59E0B10] text-white'
                : 'border-white/10 bg-white/5 text-[#666] hover:border-white/20'
            }`}
          >
            <div className="text-sm font-['Space_Grotesk'] font-bold">{f.label}</div>
            <div className="text-[10px] text-[#555] mt-0.5 font-['Space_Grotesk']">{f.sub}</div>
          </button>
        ))}
      </div>

      {/* Card preview */}
      <div className="flex justify-center items-center px-4 sm:px-6 pt-4 pb-2">
        <div
          style={{
            width: previewW,
            height: previewH,
            position: 'relative',
            borderRadius: 10,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 0 40px rgba(225,6,0,0.1)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              transform: `scale(${SCALE})`,
              transformOrigin: 'top left',
              width: 1080,
              height: format === 'portrait' ? 1350 : 1080,
              pointerEvents: 'none',
            }}
          >
            <ShareCard raceData={raceData} format={format} cardId="share-card-preview" />
          </div>
        </div>
      </div>

      {/* Dimensions label */}
      <div className="text-center text-[10px] text-[#444] font-['Space_Grotesk'] tracking-widest uppercase pb-2">
        {format === 'portrait' ? '1080 × 1350 px' : '1080 × 1080 px'} · PNG · 2× retina
      </div>

      {/* Action buttons */}
      <div className={`${isMobile ? 'flex flex-col' : 'flex'} gap-3 px-5 sm:px-6 py-4 sticky bottom-0 z-20 bg-[rgba(14,14,14,0.98)] border-t border-white/5`}>
        {/* Download */}
        <motion.button
          onClick={downloadCard}
          disabled={isGenerating}
          className={`${isMobile ? 'w-full' : 'flex-1'} flex items-center justify-center gap-2 rounded-xl font-['Space_Grotesk'] font-bold text-sm tracking-wide uppercase transition-all disabled:opacity-60`}
          style={{
            background: isGenerating ? '#555' : '#F59E0B',
            color: '#000',
            height: isMobile ? 52 : 44,
          }}
          {...(isMobile ? {} : { whileHover: !isGenerating ? { scale: 1.02 } : {} })}
          whileTap={!isGenerating ? { scale: 0.97 } : {}}
        >
          {isGenerating
            ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
            : <><Download size={15} /> Download PNG</>
          }
        </motion.button>

        {/* Share on X */}
        <motion.button
          onClick={shareOnX}
          className={`${isMobile ? 'w-full' : 'flex-1'} flex items-center justify-center gap-2 font-['Space_Grotesk'] font-bold text-sm text-white tracking-wide uppercase hover:bg-white/[0.08] transition-all`}
          style={{
            height: isMobile ? 52 : 44,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
          }}
          {...(!isMobile && { whileHover: { scale: 1.02 } })}
          whileTap={{ scale: 0.97 }}
        >
          <XLogo /> Share on X
        </motion.button>
      </div>
    </>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Off-screen export node (no preview scale transform) */}
          <div
            style={{
              position: 'fixed',
              left: -10000,
              top: -10000,
              width: 1080,
              height: format === 'portrait' ? 1350 : 1080,
              pointerEvents: 'none',
              zIndex: -1,
            }}
          >
            <ShareCard
              raceData={raceData}
              format={format}
              cardId={EXPORT_CARD_ID}
              exportMode={true}
            />
          </div>

          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[12000]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {isMobile ? (
            /* ── Mobile: Bottom sheet ── */
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-[12001] overflow-y-auto"
              style={{
                maxHeight: '96vh',
                borderRadius: '20px 20px 0 0',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                background: 'rgba(14, 14, 14, 0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              {modalInner}
            </motion.div>
          ) : (
            /* ── Desktop: Centered modal ── */
            <motion.div
              className="fixed inset-0 z-[12001] flex items-center justify-center p-4 overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                style={{
                  width: '100%',
                  maxWidth: 560,
                  maxHeight: '92vh',
                  background: 'rgba(14, 14, 14, 0.95)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20,
                }}
                className="overflow-y-auto shadow-2xl"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                onClick={e => e.stopPropagation()}
              >
                {modalInner}
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
