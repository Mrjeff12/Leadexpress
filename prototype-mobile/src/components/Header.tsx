import { Menu, Bell } from 'lucide-react'

interface HeaderProps {
  title: string
  onMenuOpen: () => void
  notificationCount?: number
}

export default function Header({ title, onMenuOpen, notificationCount = 0 }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 pt-5 pb-1">
      <button onClick={onMenuOpen} className="w-10 h-10 rounded-full bg-[var(--gray-50)] flex items-center justify-center press">
        <Menu size={18} strokeWidth={1.8} />
      </button>
      <button className="w-10 h-10 rounded-full bg-[var(--gray-50)] flex items-center justify-center press relative">
        <Bell size={18} strokeWidth={1.8} />
        {notificationCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-[16px] h-[16px] bg-[var(--brand)] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {notificationCount}
          </span>
        )}
      </button>
    </header>
  )
}
