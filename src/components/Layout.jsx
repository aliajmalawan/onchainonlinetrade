import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

// App shell used for every authenticated page.
export default function Layout() {
  return (
    <div>
      <div className="shell">
        <Sidebar />
        <main className="main">
          <Topbar />
          <div className="content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
