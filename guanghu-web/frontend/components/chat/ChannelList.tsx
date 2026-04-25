interface Channel { id: string; name: string; icon: string; }

export default function ChannelList({ channels, active, onSelect }: { channels: Channel[]; active: string; onSelect: (id: string) => void }) {
  return (
    <div className="py-2">
      {channels.map((ch) => (
        <button key={ch.id} onClick={() => onSelect(ch.id)} className={`w-full text-left px-4 py-2 text-sm transition-colors ${active === ch.id ? 'bg-gh-primary/10 text-gh-primary font-medium' : 'text-gh-muted hover:bg-gray-50 hover:text-gh-text'}`}>
          <span className="mr-2">{ch.icon}</span>{ch.name}
        </button>
      ))}
    </div>
  );
}
