# Mobile Shell & Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing mobile navigation (emoji tab bar + hamburger sidebar) with a premium floating dark bottom bar, drawer menu, and per-page headers — all scoped to mobile only (< 768px).

**Architecture:** Mobile-only components rendered conditionally via `md:hidden`. Desktop Sidebar and layout untouched. New CSS variables and utility classes added to `index.css` under `@media (max-width: 767px)`. Existing `MobileTabBar` in App.tsx replaced with new component.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide React icons, React Router

**This is Plan 1 of 3.** Plan 2 covers core screen redesigns. Plan 3 covers sub-pages and flows.

---

## File Structure

### New Files
- `apps/dashboard/src/components/mobile/BottomTabBar.tsx` — floating dark bottom nav (5 tabs)
- `apps/dashboard/src/components/mobile/Drawer.tsx` — hamburger drawer menu
- `apps/dashboard/src/components/mobile/MobileHeader.tsx` — reusable per-page header

### Modified Files
- `apps/dashboard/src/index.css` — add mobile-only CSS variables and utility classes
- `apps/dashboard/src/App.tsx` — replace inline MobileTabBar, add Drawer, conditional headers
- `apps/dashboard/src/components/Sidebar.tsx` — ensure hidden on mobile (already is, verify)

---

### Task 1: Add Mobile CSS Variables & Utility Classes

**Files:**
- Modify: `apps/dashboard/src/index.css`

- [ ] **Step 1: Add mobile CSS variables at end of `:root`**

Add after existing CSS variables in `:root`:

```css
/* Mobile Design System */
--mobile-brand: #fe5b25;
--mobile-brand-light: #fff4f0;
--mobile-dark: #111111;
--mobile-gray-50: #fafafa;
--mobile-gray-100: #f5f5f5;
--mobile-gray-200: #e5e5e5;
--mobile-gray-400: #a3a3a3;
--mobile-gray-500: #737373;
```

- [ ] **Step 2: Add mobile-only utility classes at end of file**

```css
/* ========================================
   MOBILE-ONLY STYLES (< 768px)
   Desktop/tablet completely untouched
   ======================================== */

@media (max-width: 767px) {
  /* Floating bottom nav */
  .mobile-float-nav {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--mobile-dark);
    border-radius: 28px;
    padding: 5px 6px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }

  .mobile-nav-btn {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
  }
  .mobile-nav-btn.active {
    background: #fff;
  }
  .mobile-nav-btn:active {
    transform: scale(0.88);
  }

  /* Drawer overlay */
  .mobile-drawer-overlay {
    background: rgba(0,0,0,0.25);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  /* Card styles */
  .mobile-card {
    background: #fff;
    border-radius: 20px;
    border: 1px solid rgba(0,0,0,0.04);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .mobile-card-dark {
    background: var(--mobile-dark);
    border-radius: 20px;
    color: #fff;
  }

  /* Press feedback */
  .mobile-press {
    transition: transform 0.15s ease;
  }
  .mobile-press:active {
    transform: scale(0.97);
  }

  /* Animations */
  @keyframes mobileFadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .mobile-anim-up {
    animation: mobileFadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* Typography helpers */
  .mobile-t-hero { font-size: 34px; font-weight: 700; letter-spacing: -0.04em; line-height: 1.08; }
  .mobile-t-title { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
  .mobile-t-head { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
  .mobile-t-sub { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
  .mobile-t-small { font-size: 13px; font-weight: 500; }
  .mobile-t-tiny { font-size: 11px; font-weight: 500; }
  .mobile-t-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mobile-gray-400); }

  /* Page content padding for bottom nav */
  .mobile-page-content {
    padding-bottom: 100px;
  }

  /* Button styles */
  .mobile-btn-primary {
    background: var(--mobile-brand);
    color: white;
    border-radius: 14px;
    font-weight: 600;
    font-size: 15px;
    padding: 14px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .mobile-btn-dark {
    background: var(--mobile-dark);
    color: white;
    border-radius: 14px;
    font-weight: 600;
    font-size: 15px;
    padding: 14px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  /* Chip styles */
  .mobile-chip {
    font-size: 13px;
    font-weight: 500;
    padding: 7px 16px;
    border-radius: 100px;
    white-space: nowrap;
  }
  .mobile-chip-on { background: var(--mobile-dark); color: #fff; }
  .mobile-chip-off { background: var(--mobile-gray-100); color: var(--mobile-gray-500); }

  /* Progress ring */
  .mobile-ring-track { stroke: var(--mobile-gray-100); }
  .mobile-ring-fill { stroke: var(--mobile-brand); transition: stroke-dashoffset 1s ease; }
}
```

- [ ] **Step 3: Verify desktop is unaffected**

Run: `npm run dev` in `apps/dashboard`
Expected: Open on desktop browser at 1024px+ width — everything looks identical to before. The new classes only apply below 768px.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(mobile): add mobile-only CSS variables and utility classes"
```

---

### Task 2: Create Mobile Bottom Tab Bar Component

**Files:**
- Create: `apps/dashboard/src/components/mobile/BottomTabBar.tsx`

- [ ] **Step 1: Create the mobile directory**

```bash
mkdir -p apps/dashboard/src/components/mobile
```

- [ ] **Step 2: Create BottomTabBar component**

```tsx
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, MessageCircle, Zap, Briefcase, User } from 'lucide-react'

const tabs = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/publish', icon: MessageCircle, label: 'Rebeca', badge: true },
  { path: '/leads', icon: Zap, label: 'Leads', badge: true },
  { path: '/jobs', icon: Briefcase, label: 'Jobs' },
  { path: '/profile', icon: User, label: 'Profile' },
]

export default function MobileBottomTabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // Hide on certain pages
  const hiddenPaths = ['/publish', '/login', '/onboarding', '/portal']
  if (hiddenPaths.some(p => pathname.startsWith(p))) return null

  return (
    <nav className="md:hidden mobile-float-nav">
      {tabs.map((tab) => {
        const isActive = tab.path === '/' ? pathname === '/' : pathname.startsWith(tab.path)
        const Icon = tab.icon
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
          >
            <Icon
              size={19}
              strokeWidth={isActive ? 2.2 : 1.5}
              className={isActive ? 'text-[#111]' : 'text-white/50'}
            />
            <span className={`text-[9px] font-medium ${isActive ? 'text-[#111]' : 'text-white/35'}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/mobile/BottomTabBar.tsx
git commit -m "feat(mobile): create floating dark bottom tab bar component"
```

---

### Task 3: Create Mobile Drawer Component

**Files:**
- Create: `apps/dashboard/src/components/mobile/Drawer.tsx`

- [ ] **Step 1: Create Drawer component**

```tsx
import { X, Users, Briefcase, CreditCard, Settings, LogOut, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

const menuItems = [
  { icon: Users, label: 'Groups', desc: 'WhatsApp groups', path: '/group-scan' },
  { icon: CreditCard, label: 'Subscription', desc: 'Plan & billing', path: '/subscription' },
  { icon: Settings, label: 'Settings', desc: 'Preferences', path: '/profile' },
]

export default function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : '??'

  return (
    <>
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 mobile-drawer-overlay"
          onClick={onClose}
          style={{ animation: 'fadeIn 0.2s ease' }}
        />
      )}

      <div
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-[300px] bg-white transform transition-transform duration-[400ms] ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        <div className="pt-14 px-6 pb-8">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center"
          >
            <X size={15} />
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#111] flex items-center justify-center text-white text-lg font-bold">
              {initials}
            </div>
            <div>
              <h3 className="text-[16px] font-semibold">{profile?.full_name || 'Contractor'}</h3>
              <span className="text-[11px] text-[#fe5b25] font-medium">
                {profile?.tier === 'verified' ? 'Verified' : profile?.tier || 'New'}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); onClose() }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-left hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
                  <Icon size={17} strokeWidth={1.6} />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold">{item.label}</p>
                  <p className="text-[11px] text-gray-400">{item.desc}</p>
                </div>
                <ChevronRight size={15} className="text-gray-300" />
              </button>
            )
          })}
        </div>

        <div className="absolute bottom-8 left-6">
          <button
            onClick={() => { signOut(); onClose() }}
            className="flex items-center gap-2 text-gray-400"
          >
            <LogOut size={15} />
            <span className="text-[13px] font-medium">Log Out</span>
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/mobile/Drawer.tsx
git commit -m "feat(mobile): create hamburger drawer menu component"
```

---

### Task 4: Create Mobile Header Component

**Files:**
- Create: `apps/dashboard/src/components/mobile/MobileHeader.tsx`

- [ ] **Step 1: Create MobileHeader component**

```tsx
import { Menu, Bell, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface MobileHeaderProps {
  title?: string
  onMenuOpen?: () => void
  notificationCount?: number
  showBack?: boolean
  backPath?: string
  rightContent?: React.ReactNode
}

export default function MobileHeader({
  title,
  onMenuOpen,
  notificationCount = 0,
  showBack = false,
  backPath,
  rightContent,
}: MobileHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="md:hidden flex items-center justify-between px-5 pt-5 pb-1">
      {showBack ? (
        <button
          onClick={() => backPath ? navigate(backPath) : navigate(-1)}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mobile-press"
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
        </button>
      ) : onMenuOpen ? (
        <button
          onClick={onMenuOpen}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mobile-press"
        >
          <Menu size={18} strokeWidth={1.8} />
        </button>
      ) : (
        <div className="w-10" />
      )}

      {title && (
        <h1 className="text-[16px] font-semibold absolute left-1/2 -translate-x-1/2">{title}</h1>
      )}

      {rightContent || (
        <button
          onClick={() => navigate('/notifications')}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mobile-press relative"
        >
          <Bell size={18} strokeWidth={1.8} />
          {notificationCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-[15px] h-[15px] bg-[#fe5b25] text-white text-[8px] font-bold rounded-full flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>
      )}
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/mobile/MobileHeader.tsx
git commit -m "feat(mobile): create reusable mobile header component"
```

---

### Task 5: Replace MobileTabBar in App.tsx & Wire Up Drawer

**Files:**
- Modify: `apps/dashboard/src/App.tsx`

- [ ] **Step 1: Add imports for new mobile components**

At the top of App.tsx, add:

```tsx
import MobileBottomTabBar from './components/mobile/BottomTabBar'
import MobileDrawer from './components/mobile/Drawer'
```

Add state for drawer:

```tsx
const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
```

- [ ] **Step 2: Remove the existing inline MobileTabBar function**

Delete the entire `function MobileTabBar()` block (approximately lines 110-131 in current App.tsx) and its render at line 167.

- [ ] **Step 3: Add new mobile components in the render**

Replace the old `<MobileTabBar />` usage with:

```tsx
{!onboardingActive && <MobileBottomTabBar />}
{!onboardingActive && (
  <MobileDrawer
    open={mobileDrawerOpen}
    onClose={() => setMobileDrawerOpen(false)}
  />
)}
```

- [ ] **Step 4: Verify on mobile viewport**

Run: `npm run dev` in `apps/dashboard`
Expected:
- At 375px width: floating dark bottom bar with 5 tabs (Home, Rebeca, Leads, Jobs, Profile)
- At 1024px width: original sidebar, no floating bar
- Hamburger icon in mobile header opens drawer from left

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/App.tsx
git commit -m "feat(mobile): replace emoji tab bar with floating dark nav + drawer"
```

---

### Task 6: Add mobile page content padding

**Files:**
- Modify: `apps/dashboard/src/index.css`

- [ ] **Step 1: Update contractor-main-content for mobile**

Find the existing `.contractor-main-content` rule and add mobile padding:

```css
.contractor-main-content {
  padding-inline-start: 0;
  padding-bottom: 0;
}

@media (min-width: 768px) {
  .contractor-main-content {
    padding-inline-start: 252px;
  }
}

@media (max-width: 767px) {
  .contractor-main-content {
    padding-bottom: 100px; /* space for floating nav */
  }
}
```

- [ ] **Step 2: Verify pages don't overlap with bottom nav**

Open any page on mobile viewport. Content should not be hidden behind the floating nav bar.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/index.css
git commit -m "feat(mobile): add bottom padding for floating nav clearance"
```

---

### Task 7: Final Integration Test

- [ ] **Step 1: Test all navigation paths on mobile viewport (375px)**

Verify:
- Home → tap Leads tab → leads page loads, Leads tab highlighted
- Leads → tap Jobs tab → jobs page loads
- Hamburger → drawer opens → tap Groups → groups page loads, drawer closes
- Back button works on sub-pages
- Bell icon navigates to notifications
- Bottom nav hidden on Rebeca chat page

- [ ] **Step 2: Test desktop is completely unaffected (1024px+)**

Verify:
- Sidebar visible and working
- No floating bottom bar visible
- No drawer visible
- All existing functionality works

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(mobile): integration test fixes for shell and navigation"
```

---

## Summary

After completing this plan, the mobile shell is in place:
- Floating dark bottom tab bar (5 tabs)
- Hamburger drawer (Groups, Subscription, Settings, Logout)
- Reusable MobileHeader component
- Mobile CSS utility classes
- Desktop completely untouched

**Next:** Plan 2 — Core Screen Redesigns (Home, Leads, Jobs, Profile, Chat)
