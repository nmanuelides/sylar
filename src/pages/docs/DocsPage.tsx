import { motion } from 'framer-motion';
import '../pages.scss';

const SHORTCUTS: [string, string][] = [
  ['Click / drag', 'Select and move an element'],
  ['Shift + click', 'Add to selection'],
  ['Arrow keys', 'Nudge by 1 px (Shift = 10 px)'],
  ['Delete', 'Remove selected elements'],
  ['Ctrl + Z / Ctrl + Y', 'Undo / redo'],
  ['Ctrl + D', 'Duplicate selection'],
  ['Ctrl + G', 'Toggle grid'],
  ['Ctrl + scroll', 'Zoom canvas'],
  ['Alt while resizing', 'Resize from the center (both sides move)'],
  ['Shift while rotating', 'Snap rotation to 15° steps'],
  ['Esc', 'Clear selection'],
];

const STEPS = [
  {
    title: '1 · Pick a device',
    text: 'Choose your Amazfit model in the canvas toolbar — the canvas adopts its exact resolution and shape (round or rectangular).',
  },
  {
    title: '2 · Drag in components',
    text: 'Complications, watch hands, digital time, text, icons, progress bars and tick marks live in the left panel. Click to drop at the center or drag them anywhere on the canvas.',
  },
  {
    title: '3 · Customize everything',
    text: 'Select an element to edit position, size, rotation, opacity, colors, fonts and type-specific options in the Properties panel. Reorder layers by dragging in the Layers panel — top of the list renders on top.',
  },
  {
    title: '4 · Upload your own assets',
    text: 'The Assets tab accepts PNG, JPG and SVG images plus TTF/OTF fonts. Any element — not just images — can spin continuously: set Properties → Transform → "Rotate as" to hour, minute, second, day of week, or battery.',
  },
  {
    title: '5 · Design the AOD',
    text: 'Flip the AOD switch to edit the Always-On Display variant. Start from a copy of your main design and strip it down — dark AOD faces save battery.',
  },
  {
    title: '6 · Preview, save & export',
    text: 'Preview shows both modes with live data. Save stores the project (Supabase or local browser storage) and Export produces a JSON project file plus PNG renders.',
  },
];

export function DocsPage() {
  return (
    <div className="page page--docs">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1>Docs</h1>
        <p className="page__lead">Everything you need to design your first Amazfit watchface with Sylar.</p>

        <h2>Getting started</h2>
        <div className="docs__steps">
          {STEPS.map((s, i) => (
            <motion.section
              key={s.title}
              className="docs__step"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
            >
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </motion.section>
          ))}
        </div>

        <h2>Keyboard shortcuts</h2>
        <table className="docs__table">
          <tbody>
            {SHORTCUTS.map(([keys, action]) => (
              <tr key={keys}>
                <td>
                  <code>{keys}</code>
                </td>
                <td>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Export format</h2>
        <p>
          Exported <code>.sylar.json</code> files contain the complete project: device, both element
          trees (active + AOD), z-order, every property and embedded assets. Compiling to installable
          Amazfit binaries is on the roadmap.
        </p>
      </motion.div>
    </div>
  );
}
