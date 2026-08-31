import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '../api/client';

const tabItems = [
  { to: '/', label: 'My Pieces' },
  { to: '/feed', label: 'Feed' },
  { to: '/favorites', label: 'Favorites' },
];

function BellIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 60000,
  });

  const totalUnseen = notifications?.total_unseen ?? 0;

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close dropdown on navigation
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 flex items-center h-16">
          {/* Left — brand */}
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="text-lg font-semibold tracking-tight cursor-pointer hover:opacity-70 transition-opacity">
            Vintage Searcher
          </a>

          {/* Center — navigation tabs */}
          <div className="flex items-center gap-1 ml-auto mr-auto">
            {tabItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          {/* Right — actions */}
          <div className="flex items-center gap-2">
            <NavLink
              to="/add"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`
              }
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Add
            </NavLink>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpen(!open)}
                className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                title="Notifications"
              >
                <BellIcon className="w-5 h-5" />
                {totalUnseen > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
                    {totalUnseen > 99 ? '99+' : totalUnseen}
                  </span>
                )}
              </button>

              {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  </div>

                  {notifications && notifications.groups.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.groups.map((group) => (
                        <button
                          key={group.piece_id}
                          onClick={() => navigate(`/piece/${group.piece_id}`)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                            <img
                              src={`/uploads/${group.image_filename}`}
                              alt={group.brand}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {group.brand}
                            </p>
                            <p className="text-xs text-blue-500">
                              {group.unseen_count} new result{group.unseen_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-blue-500 text-white text-[10px] font-bold rounded-full">
                            {group.unseen_count}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-gray-400">No new results</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
