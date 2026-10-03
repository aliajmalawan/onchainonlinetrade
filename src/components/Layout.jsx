import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

// App shell used for every authenticated page.
export default function Layout() {
  // The customer-support chat is meant to read as one continuous screen
  // (topbar blending straight into the chat panel, no card gaps) rather
  // than the narrow, padded card layout every other page uses — so it
  // gets a dedicated full-bleed treatment on mobile. Scoped by route, not
  // applied globally, so the rest of the app is untouched.
  const isSupportPage = useLocation().pathname === '/support'
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  // CSS `dvh` is supposed to track the real visible viewport, but it's
  // unreliable in practice once the on-screen keyboard is involved — some
  // browsers don't shrink it for the keyboard at all (dvh is spec'd to
  // exclude the keyboard inset), and even where it resizes, the page can
  // still be scrolled within the layout viewport (visualViewport.offsetTop)
  // when the keyboard pushes the focused input into view, which plain vh
  // units know nothing about. window.visualViewport's height AND offsetTop
  // together are the one thing that accurately tracks the real visible
  // area everywhere — mirrored into CSS vars that the chat screen uses to
  // position itself directly, instead of trusting any vh/dvh unit.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    // Keyboard detection can't compare window.innerHeight against
    // vv.height directly — the viewport meta tag's interactive-widget=
    // resizes-content (needed for the chat screen's own sizing) makes the
    // *layout* viewport shrink together with the keyboard too now, so the
    // two stay nearly equal either way. Instead, remember the tallest
    // height seen (the real "keyboard closed" baseline) and treat a big
    // drop from THAT as the keyboard opening. Reset the baseline on a
    // width change since that means a rotation, not a keyboard.
    let maxHeight = Math.max(window.innerHeight, vv.height)
    let lastWidth = window.innerWidth
    const update = () => {
      document.documentElement.style.setProperty('--vvh', vv.height + 'px')
      document.documentElement.style.setProperty('--vv-top', vv.offsetTop + 'px')
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth
        maxHeight = Math.max(window.innerHeight, vv.height)
      } else {
        maxHeight = Math.max(maxHeight, window.innerHeight, vv.height)
      }
      // A keyboard typically eats 150px+; a shrink smaller than that is
      // just the browser's own toolbar hiding on scroll, which the
      // floating bottom nav should ignore.
      setKeyboardOpen(maxHeight - vv.height > 150)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  // On the chat screen specifically, the floating bottom nav has nowhere
  // good to go once the keyboard is up — it ends up wedged between the
  // input and the keyboard — so it's hidden for as long as the keyboard
  // stays open here, same as a native chat app would.
  const hideSidebar = isSupportPage && keyboardOpen

  return (
    <div>
      <div className="shell">
        {!hideSidebar && <Sidebar />}
        <main className={'main' + (isSupportPage ? ' chat-fullscreen' : '') + (hideSidebar ? ' nav-hidden' : '')}>
          <Topbar />
          <div className="content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
