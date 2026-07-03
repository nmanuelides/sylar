import { motion } from 'framer-motion';
import { Svg, UI_ICONS } from '@/components/common/Ui';
import '../pages.scss';

const PLANNED = [
  {
    icon: UI_ICONS.export,
    title: 'Share your designs',
    text: 'Publish watchfaces with one click and let others install or remix them.',
  },
  {
    icon: UI_ICONS.star,
    title: 'Discover & vote',
    text: 'Browse trending faces per device, filter by style and upvote favourites.',
  },
  {
    icon: UI_ICONS.copy,
    title: 'Remix anything',
    text: 'Open any community face in the editor and make it yours.',
  },
];

export function CommunityPage() {
  return (
    <div className="page page--center">
      <motion.div
        className="coming"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
      >
        <motion.span
          className="coming__badge"
          animate={{ boxShadow: ['0 0 12px rgba(79,195,255,0.2)', '0 0 28px rgba(79,195,255,0.5)', '0 0 12px rgba(79,195,255,0.2)'] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          Coming soon
        </motion.span>
        <h1>Community</h1>
        <p>
          A place to share, discover and remix watchfaces made with Sylar. Backed by Supabase — the
          same database that already stores your designs.
        </p>
        <div className="coming__grid">
          {PLANNED.map((item, i) => (
            <motion.div
              key={item.title}
              className="coming__card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.12 }}
              whileHover={{ y: -4, borderColor: 'rgba(79,195,255,0.5)' }}
            >
              <span className="coming__icon">
                <Svg d={item.icon} size={20} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
