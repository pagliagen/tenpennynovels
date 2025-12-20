import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useNotification } from '@/contexts/NotificationContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

// Types
interface EconomicTransaction {
  id: string;
  type: string;
  amount: number;
  amountFormatted: string;
  character: {
    id: string;
    name: string;
  };
  grantedBy?: {
    id: string;
    username: string;
  };
  reason: string;
  category: string;
  timestamp: string;
}

interface EconomicReports {
  moneySupply: {
    totalCash: number;
    totalDeposits: number;
    totalSupply: number;
    supplyGrowth: string;
    avgPlayerBalance: number;
    medianPlayerBalance: number;
  };
  transactionActivity: {
    totalTransactions: number;
    playerToPlayer: number;
    shopPurchases: number;
    adminGrants: number;
    corporationPayments: number;
    averageTransactionSize: number;
  };
  itemEconomy: {
    mostTradedItems: Array<{
      itemId: string;
      itemName: string;
      transactions: number;
    }>;
    priceInflation: Array<{
      itemId: string;
      priceChange: string;
    }>;
  };
  corporationFinances: {
    totalTreasuryFunds: number;
    avgTreasuryBalance: number;
    corporationsInDebt: number;
    totalMonthlyRevenue: number;
    totalMonthlyExpenses: number;
  };
  alerts: Array<{
    type: string;
    item?: string;
    corporation?: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

interface CharacterFinances {
  character: {
    id: string;
    name: string;
    occupation: string;
  };
  balance: {
    cash: number;
    deposit: number;
    total: number;
    formatted: {
      cash: string;
      deposit: string;
      total: string;
    };
  };
  recentTransactions: EconomicTransaction[];
  statistics: {
    totalEarned: number;
    totalSpent: number;
    avgDailySpending: number;
    lastTransaction: string;
  };
  salaryInfo: {
    occupationSalary: number;
    corporationSalary: number;
    totalMonthlySalary: number;
    nextPayment: string;
  };
}

const EconomyPage: NextPage = () => {
  const { showPrompt, showToast } = useNotification();

  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'grants' | 'reports'>('overview');
  const [transactions, setTransactions] = useState<EconomicTransaction[]>([]);
  const [reports, setReports] = useState<EconomicReports | null>(null);
  const [characterFinances, setCharacterFinances] = useState<CharacterFinances | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters for transactions
  const [characterFilter, setCharacterFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  // Grant form state
  const [grantForm, setGrantForm] = useState({
    characterId: '',
    amount: 0,
    type: 'cash' as 'cash' | 'deposit',
    category: 'reward' as 'reward' | 'compensation' | 'correction' | 'event_prize',
    reason: '',
    notifyPlayer: true
  });

  // Character lookup state
  const [lookupCharacterId, setLookupCharacterId] = useState('');

  // Fetch functions
  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50'
      });

      if (characterFilter) params.append('characterId', characterFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (dateFromFilter) params.append('dateFrom', dateFromFilter);
      if (dateToFilter) params.append('dateTo', dateToFilter);

      const response = await fetch(`${API_BASE_URL}/admin/economy/transactions?${params}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTransactions(data.data.transactions);
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchReports = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/economy/reports`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setReports(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  const fetchCharacterFinances = async (characterId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/economy/character/${characterId}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCharacterFinances(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching character finances:', error);
    }
  };

  // Grant money
  const handleGrantMoney = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!grantForm.characterId || !grantForm.reason.trim()) {
      showToast('Character ID and reason are required', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/economy/grant`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: grantForm.characterId,
          amount: grantForm.amount,
          type: grantForm.type,
          category: grantForm.category,
          reason: grantForm.reason,
          notifyPlayer: grantForm.notifyPlayer
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showToast(`Money granted successfully! Transaction ID: ${data.data.transactionId}`, 'success');
          setGrantForm({
            characterId: '',
            amount: 0,
            type: 'cash',
            category: 'reward',
            reason: '',
            notifyPlayer: true
          });
          fetchTransactions();
        }
      } else {
        const errorData = await response.json();
        showToast(`Error: ${errorData.error || 'Failed to grant money'}`, 'error');
      }
    } catch (error) {
      console.error('Error granting money:', error);
      showToast('Error granting money', 'error');
    }
  };

  // Adjust money
  const handleAdjustMoney = async () => {
    const characterId = await showPrompt('Enter Character ID:', '');
    if (!characterId) return;

    const amountStr = await showPrompt('Enter amount (negative for deduction):', '');
    if (!amountStr) return;

    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount === 0) {
      showToast('Invalid amount', 'error');
      return;
    }

    const type = await showPrompt('Enter type (cash/deposit):', 'cash') as 'cash' | 'deposit';
    if (!['cash', 'deposit'].includes(type)) {
      showToast('Type must be cash or deposit', 'error');
      return;
    }

    const reason = await showPrompt('Enter reason for adjustment:', 'Aggiornamento Manutenzione');
    if (!reason) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/economy/adjust`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, amount, type, reason })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          showToast(`Money adjusted successfully! Transaction ID: ${data.data.transactionId}`, 'success');
          fetchTransactions();
        }
      } else {
        const errorData = await response.json();
        showToast(`Error: ${errorData.error || 'Failed to adjust money'}`, 'error');
      }
    } catch (error) {
      console.error('Error adjusting money:', error);
      showToast('Error adjusting money', 'error');
    }
  };

  // Character lookup
  const handleCharacterLookup = () => {
    if (lookupCharacterId.trim()) {
      fetchCharacterFinances(lookupCharacterId.trim());
    }
  };

  // Effects
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([
        fetchTransactions(),
        fetchReports()
      ]);
      setLoading(false);
    };

    fetchData();
  }, [currentPage, characterFilter, typeFilter, categoryFilter, dateFromFilter, dateToFilter]);

  const getTransactionTypeColor = (type: string) => {
    const colors = {
      admin_grant: 'bg-green-100 text-green-800',
      shop_purchase: 'bg-blue-100 text-blue-800',
      transfer: 'bg-purple-100 text-purple-800',
      salary: 'bg-yellow-100 text-yellow-800',
      corporation_payment: 'bg-indigo-100 text-indigo-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (pence: number) => {
    const pounds = Math.floor(pence / 240);
    const shillings = Math.floor((pence % 240) / 12);
    const remainingPence = pence % 12;
    
    if (pounds > 0) {
      return `£${pounds} ${shillings}s ${remainingPence}d`;
    } else if (shillings > 0) {
      return `${shillings}s ${remainingPence}d`;
    } else {
      return `${remainingPence}d`;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Economy Management</h1>
          <p className="text-gray-600 mt-1">Monitor and manage the Victorian London economy</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', icon: '📊' },
            { key: 'transactions', label: 'Transactions', icon: '💰' },
            { key: 'grants', label: 'Money Grants', icon: '🎁' },
            { key: 'reports', label: 'Reports', icon: '📈' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && reports && (
        <div className="space-y-6">
          {/* Money Supply Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Total Money Supply</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(reports.moneySupply.totalSupply)}</p>
              <div className="text-sm text-green-600 mt-1">{reports.moneySupply.supplyGrowth}</div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Average Balance</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(reports.moneySupply.avgPlayerBalance)}</p>
              <div className="text-xs text-gray-600 mt-1">
                Median: {formatCurrency(reports.moneySupply.medianPlayerBalance)}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Transactions Today</h3>
              <p className="text-2xl font-bold text-gray-900">{reports.transactionActivity.totalTransactions}</p>
              <div className="text-xs text-gray-600 mt-1">
                Avg: {formatCurrency(reports.transactionActivity.averageTransactionSize)}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Treasury Funds</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(reports.corporationFinances.totalTreasuryFunds)}</p>
              <div className="text-xs text-gray-600 mt-1">
                {reports.corporationFinances.corporationsInDebt} in debt
              </div>
            </div>
          </div>

          {/* Economic Alerts */}
          {reports.alerts.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Economic Alerts</h3>
              <div className="space-y-3">
                {reports.alerts.map((alert, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">{alert.type.replace('_', ' ').toUpperCase()}</div>
                      <div className="text-sm text-gray-600">{alert.message}</div>
                      {alert.item && <div className="text-xs text-gray-500">Item: {alert.item}</div>}
                      {alert.corporation && <div className="text-xs text-gray-500">Corporation: {alert.corporation}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Character Finances Lookup */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Character Finances Lookup</h3>
            <div className="flex gap-4 mb-4">
              <input
                type="text"
                placeholder="Enter Character ID..."
                value={lookupCharacterId}
                onChange={(e) => setLookupCharacterId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              />
              <button
                onClick={handleCharacterLookup}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Lookup
              </button>
            </div>

            {characterFinances && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">
                  {characterFinances.character.name} - {characterFinances.character.occupation}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Cash</div>
                    <div className="text-lg font-medium">{characterFinances.balance.formatted.cash}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Bank Deposit</div>
                    <div className="text-lg font-medium">{characterFinances.balance.formatted.deposit}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Total Balance</div>
                    <div className="text-lg font-bold text-green-600">{characterFinances.balance.formatted.total}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <input
                type="text"
                placeholder="Character ID..."
                value={characterFilter}
                onChange={(e) => setCharacterFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              />
              
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Types</option>
                <option value="admin_grant">Admin Grants</option>
                <option value="shop_purchase">Shop Purchases</option>
                <option value="transfer">Transfers</option>
                <option value="salary">Salaries</option>
                <option value="corporation_payment">Corporation Payments</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Categories</option>
                <option value="reward">Rewards</option>
                <option value="compensation">Compensation</option>
                <option value="correction">Corrections</option>
                <option value="event_prize">Event Prizes</option>
                <option value="purchase">Purchases</option>
                <option value="trade">Trades</option>
              </select>

              <input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
                placeholder="From Date"
              />

              <input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
                placeholder="To Date"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleAdjustMoney}
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
            >
              Quick Adjust Money
            </button>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Character
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{transaction.id}</div>
                        {transaction.grantedBy && (
                          <div className="text-xs text-gray-500">by {transaction.grantedBy.username}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{transaction.character.name}</div>
                        <div className="text-xs text-gray-500">{transaction.character.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${
                          transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amountFormatted}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTransactionTypeColor(transaction.type)}`}>
                          {transaction.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {transaction.reason}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(transaction.timestamp).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Money Grants Tab */}
      {activeTab === 'grants' && (
        <div className="max-w-2xl">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Grant Money to Character</h3>
            
            <form onSubmit={handleGrantMoney} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Character ID</label>
                <input
                  type="text"
                  value={grantForm.characterId}
                  onChange={(e) => setGrantForm({ ...grantForm, characterId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount (pence)</label>
                  <input
                    type="number"
                    min="1"
                    value={grantForm.amount}
                    onChange={(e) => setGrantForm({ ...grantForm, amount: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select
                    value={grantForm.type}
                    onChange={(e) => setGrantForm({ ...grantForm, type: e.target.value as 'cash' | 'deposit' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="cash">Cash</option>
                    <option value="deposit">Bank Deposit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={grantForm.category}
                  onChange={(e) => setGrantForm({ ...grantForm, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="reward">Reward</option>
                  <option value="compensation">Compensation</option>
                  <option value="correction">Correction</option>
                  <option value="event_prize">Event Prize</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <textarea
                  value={grantForm.reason}
                  onChange={(e) => setGrantForm({ ...grantForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="notifyPlayer"
                  checked={grantForm.notifyPlayer}
                  onChange={(e) => setGrantForm({ ...grantForm, notifyPlayer: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="notifyPlayer" className="text-sm text-gray-700">
                  Notify player of this grant
                </label>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 font-medium"
                >
                  Grant Money
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && reports && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transaction Activity */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction Activity</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Player to Player:</span>
                  <span className="font-medium">{reports.transactionActivity.playerToPlayer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shop Purchases:</span>
                  <span className="font-medium">{reports.transactionActivity.shopPurchases}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Admin Grants:</span>
                  <span className="font-medium">{reports.transactionActivity.adminGrants}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Corporation Payments:</span>
                  <span className="font-medium">{reports.transactionActivity.corporationPayments}</span>
                </div>
              </div>
            </div>

            {/* Corporation Finances */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Corporation Finances</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Treasury:</span>
                  <span className="font-medium">{formatCurrency(reports.corporationFinances.totalTreasuryFunds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monthly Revenue:</span>
                  <span className="font-medium text-green-600">{formatCurrency(reports.corporationFinances.totalMonthlyRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monthly Expenses:</span>
                  <span className="font-medium text-red-600">{formatCurrency(reports.corporationFinances.totalMonthlyExpenses)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Corporations in Debt:</span>
                  <span className="font-medium text-orange-600">{reports.corporationFinances.corporationsInDebt}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Most Traded Items */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Most Traded Items</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Item</th>
                    <th className="text-right py-2">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.itemEconomy.mostTradedItems.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2">{item.itemName}</td>
                      <td className="py-2 text-right font-medium">{item.transactions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EconomyPage;