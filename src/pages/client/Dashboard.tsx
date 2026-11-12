import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  CreditCard, History, Send, Plus, Download, Wallet, User, Home,
  Menu, X, ChevronRight, Shield, HelpCircle, LogOut, Bell, Settings
} from 'lucide-react';
import LogoDisplay from '../../components/ui/LogoDisplay';
import PositionsTable, { Position } from '../../components/client/PositionsTable';
import { useAuth } from '../../contexts/AuthContext';
import { useSystemConfigContext } from '../../contexts/SystemConfigContext';
import { supabase } from '../../config/supabase';
import toast from 'react-hot-toast';
import ContactSupportModal from '../../components/modals/ContactSupportModal';

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard', description: 'Overview' },
  { id: 'accounts', label: 'Account Details', icon: CreditCard, path: '/account', description: 'View account information' },
  { id: 'transactions', label: 'Transaction History', icon: History, path: '/transactions', description: 'View all transactions' },
  { id: 'transfer', label: 'Transfer Money', icon: Send, path: '/transfer', description: 'Send funds' },
  { id: 'deposit', label: 'Deposit Funds', icon: Plus, path: '/deposit', description: 'Add money' },
  { id: 'withdraw', label: 'Withdraw Funds', icon: Download, path: '/withdraw', description: 'Cash out' },
  { id: 'ewallets', label: 'E-Wallets', icon: Wallet, path: '/ewallets', description: 'Digital wallets' },
  { id: 'profile', label: 'Profile Settings', icon: User, path: '/profile', description: 'Manage account' },
];

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { config, loading: configLoading, getPrimaryLogo } = useSystemConfigContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const { data: { user: sbUser } } = await supabase.auth.getUser();
        if (!sbUser) return;

        // Load accounts
        const { data: accData } = await supabase
          .from('accounts')
          .select('*')
          .eq('user_id', sbUser.id);
        setAccounts(accData || []);

        // Load positions (empty for now)
        const { data: posData } = await supabase
          .from('positions')
          .select('*')
          .eq('user_id', sbUser.id);
        setPositions(posData || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const totalBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const availableCash = accounts[0]?.available_balance ?? totalBalance;
  const unrealizedPnl = positions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
  const openCount = positions.filter(p => p.status === 'open').length;

  if (configLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 lg:bg-gray-50/20 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-gray-900/80 border-r transform transition-transform lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <LogoDisplay logoUrl={getPrimaryLogo()} companyName="" fallbackIcon={<Shield className="w-12 h-12 text-gray-700" />} className="h-14 object-contain" />
          </div>
          <div className="px-6 py-4 border-b">
            <p className="font-medium">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link key={item.id} to={item.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${active ? 'bg-gray-100 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <Icon className="w-5 h-5" />
                  <div>
                    <div>{item.label}</div>
                    <div className="text-xs text-gray-400">{item.description}</div>
                  </div>
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t">
            <button onClick={handleSignOut} className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1">
        <header className="bg-white border-b px-6 h-16 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu className="w-6 h-6" /></button>
            <div>
              <h1 className="font-semibold">Good morning, {user?.firstName || 'Client'}</h1>
              <p className="text-sm text-gray-500">Here's an overview of your accounts</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg"><Bell className="w-5 h-5" /></button>
            <button className="p-2 hover:bg-gray-100 rounded-lg"><Settings className="w-5 h-5" /></button>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border rounded-xl p-5">
              <div className="text-sm text-gray-500">Total Account Value</div>
              <div className="text-2xl font-semibold mt-1">{balanceVisible ? formatCurrency(totalBalance) : '••••••'}</div>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <div className="text-sm text-gray-500">Available Cash</div>
              <div className="text-2xl font-semibold mt-1">{balanceVisible ? formatCurrency(availableCash) : '••••••'}</div>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <div className="text-sm text-gray-500">Unrealized P&L</div>
              <div className={`text-2xl font-semibold mt-1 ${unrealizedPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(unrealizedPnl)}
              </div>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <div className="text-sm text-gray-500">Open Positions</div>
              <div className="text-2xl font-semibold mt-1">{openCount}</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button onClick={() => navigate('/documents')} className="bg-white border rounded-xl p-4 text-sm font-medium hover:border-gray-300">Upload Document</button>
            <button onClick={() => navigate('/schedule-call')} className="bg-white border rounded-xl p-4 text-sm font-medium hover:border-gray-300">Schedule Call</button>
            <button onClick={() => navigate('/statements')} className="bg-white border rounded-xl p-4 text-sm font-medium hover:border-gray-300">View Statements</button>
            <button onClick={() => setIsContactModalOpen(true)} className="bg-white border rounded-xl p-4 text-sm font-medium hover:border-gray-300">Contact Support</button>
          </div>

          <PositionsTable positions={positions} onViewFull={() => navigate('/portfolio')} />

          {accounts.length > 0 && (
            <div className="bg-white border rounded-xl p-6">
              <h2 className="font-semibold mb-4">Your Accounts</h2>
              <div className="space-y-3">
                {accounts.map(acc => (
                  <div key={acc.id} className="flex justify-between items-center border rounded-lg p-4">
                    <div>
                      <p className="font-medium capitalize">{acc.account_type}</p>
                      <p className="text-sm text-gray-500">{acc.account_number || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(Number(acc.balance) || 0)}</p>
                      <p className="text-xs text-gray-500">{acc.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <ContactSupportModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />
    </div>
  );
};

export default Dashboard;
