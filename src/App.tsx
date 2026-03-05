import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Users,
  Receipt,
  ArrowRightLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Participant {
  id: string;
  name: string;
  colorIndex: number;
}

const AVATAR_COLORS = [
  { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', hoverBorder: 'hover:border-blue-200', activeBg: 'bg-blue-100', activeText: 'text-blue-800', activeBorder: 'border-blue-300' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', hoverBorder: 'hover:border-emerald-200', activeBg: 'bg-emerald-100', activeText: 'text-emerald-800', activeBorder: 'border-emerald-300' },
  { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', hoverBorder: 'hover:border-amber-200', activeBg: 'bg-amber-100', activeText: 'text-amber-800', activeBorder: 'border-amber-300' },
  { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', border: 'border-fuchsia-100', hoverBorder: 'hover:border-fuchsia-200', activeBg: 'bg-fuchsia-100', activeText: 'text-fuchsia-800', activeBorder: 'border-fuchsia-300' },
  { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100', hoverBorder: 'hover:border-rose-200', activeBg: 'bg-rose-100', activeText: 'text-rose-800', activeBorder: 'border-rose-300' },
  { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-100', hoverBorder: 'hover:border-cyan-200', activeBg: 'bg-cyan-100', activeText: 'text-cyan-800', activeBorder: 'border-cyan-300' },
];

function getPColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string; // Participant ID
  splitAmong: string[]; // Array of Participant IDs
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

// --- AI Service ---
async function parseScenario(message: string) {
  const response = await fetch('/api/parseScenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to parse scenario');
  }

  return response.json();
}

// --- Components ---

export default function App() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Actions ---
  const addParticipant = (name: string) => {
    if (!name.trim()) return;
    const id = Math.random().toString(36).substr(2, 9);
    setParticipants([...participants, { id, name: name.trim(), colorIndex: participants.length }]);
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
    setExpenses(expenses.map(e => ({
      ...e,
      splitAmong: e.splitAmong.filter(pid => pid !== id),
      paidBy: e.paidBy === id ? (participants.find(p => p.id !== id)?.id || '') : e.paidBy
    })));
  };

  const addExpense = () => {
    if (participants.length === 0) return;
    const id = Math.random().toString(36).substr(2, 9);
    setExpenses([...expenses, {
      id,
      description: 'New Expense',
      amount: 0,
      paidBy: participants[0].id,
      splitAmong: participants.map(p => p.id)
    }]);
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses(expenses.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const removeExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const handleAiParse = async () => {
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    setError(null);
    try {
      const data = await parseScenario(aiInput);

      // Map names to IDs
      const nameToIdMap: Record<string, string> = {};
      const newParticipants: Participant[] = [];

      data.participants.forEach((name: string, index: number) => {
        const id = Math.random().toString(36).substr(2, 9);
        nameToIdMap[name] = id;
        newParticipants.push({ id, name, colorIndex: index });
      });

      const newExpenses: Expense[] = data.expenses.map((e: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        description: e.description,
        amount: e.amount,
        paidBy: nameToIdMap[e.paidBy] || newParticipants[0]?.id || '',
        splitAmong: e.splitAmong.map((name: string) => nameToIdMap[name]).filter(Boolean)
      }));

      setParticipants(newParticipants);
      setExpenses(newExpenses);
      setAiInput('');
    } catch (err) {
      console.error(err);
      setError('Failed to parse scenario. Please try again with more detail.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- Calculations ---
  const { settlements, individualBalances, totalAmount } = useMemo(() => {
    const balances: Record<string, number> = {};
    const spent: Record<string, number> = {};
    const share: Record<string, number> = {};

    participants.forEach(p => {
      balances[p.id] = 0;
      spent[p.id] = 0;
      share[p.id] = 0;
    });

    expenses.forEach(expense => {
      // Payer gets credit
      balances[expense.paidBy] += expense.amount;
      spent[expense.paidBy] += expense.amount;

      // Split among participants
      if (expense.splitAmong.length > 0) {
        const itemShare = expense.amount / expense.splitAmong.length;
        expense.splitAmong.forEach(pid => {
          balances[pid] -= itemShare;
          share[pid] += itemShare;
        });
      }
    });

    const results: Settlement[] = [];
    const debtors = Object.entries(balances)
      .filter(([_, bal]) => bal < -0.01)
      .map(([id, bal]) => [id, bal] as [string, number])
      .sort((a, b) => a[1] - b[1]);
    const creditors = Object.entries(balances)
      .filter(([_, bal]) => bal > 0.01)
      .map(([id, bal]) => [id, bal] as [string, number])
      .sort((a, b) => b[1] - a[1]);

    const tempDebtors = debtors.map(d => [...d] as [string, number]);
    const tempCreditors = creditors.map(c => [...c] as [string, number]);

    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < tempDebtors.length && cIdx < tempCreditors.length) {
      const [dId, dBal] = tempDebtors[dIdx];
      const [cId, cBal] = tempCreditors[cIdx];

      const amount = Math.min(Math.abs(dBal), cBal);
      results.push({ from: dId, to: cId, amount });

      tempDebtors[dIdx][1] += amount;
      tempCreditors[cIdx][1] -= amount;

      if (Math.abs(tempDebtors[dIdx][1]) < 0.01) dIdx++;
      if (Math.abs(tempCreditors[cIdx][1]) < 0.01) cIdx++;
    }

    return {
      settlements: results,
      individualBalances: participants.map(p => ({
        ...p,
        net: balances[p.id],
        spent: spent[p.id],
        share: share[p.id]
      })),
      totalAmount: expenses.reduce((sum, e) => sum + e.amount, 0)
    };
  }, [participants, expenses]);

  const copyToClipboard = () => {
    const text = settlements.map(s => {
      const from = participants.find(p => p.id === s.from)?.name;
      const to = participants.find(p => p.id === s.to)?.name;
      return `${from} owes ${to} $${s.amount.toFixed(2)}`;
    }).join('\n');
    navigator.clipboard.writeText(text || "All settled up!");
  };

  return (
    <div className="min-h-screen pb-32 selection:bg-brand-900 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 glass px-4 sm:px-6 py-4 flex items-center justify-between border-b border-brand-200/50">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ rotate: 15 }}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-brand-900 rounded-xl flex items-center justify-center shadow-lg shadow-brand-900/20"
          >
            <Sparkles className="text-white w-5 h-5" />
          </motion.div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight leading-none">Splitly AI</h1>
            <p className="text-[9px] sm:text-[10px] text-brand-500 font-medium uppercase tracking-wider mt-1">Intelligent Splitting</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs font-semibold text-brand-500 bg-brand-100/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-brand-200/50">
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-brand-900" />
              {participants.length}
            </div>
            <div className="w-px h-3 bg-brand-200" />
            <div className="flex items-center gap-1.5">
              <Receipt size={14} className="text-brand-900" />
              {expenses.length}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 space-y-12 sm:space-y-16">

        {/* AI Input Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-500 uppercase tracking-widest text-[10px] font-bold">
              <Sparkles size={12} className="text-brand-900" />
              AI Scenario Parser
            </div>
            <div className="text-[10px] font-medium text-brand-400 bg-brand-100 px-2 py-0.5 rounded">Beta</div>
          </div>
          <div className="relative group">
            <textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Describe the scenario: 'Alice paid $120 for dinner. Bob paid $40 for drinks. Charlie didn't have drinks...'"
              className="w-full h-48 sm:h-40 p-5 rounded-3xl bg-white border-2 border-brand-100 focus:border-brand-900 focus:ring-0 transition-all outline-none resize-none text-sm leading-relaxed shadow-sm group-hover:shadow-md"
            />
            <div className="absolute bottom-5 left-5 flex flex-wrap gap-2 pr-24 sm:pr-0">
              <button
                onClick={() => setAiInput("Alice paid $150 for dinner. Bob paid $40 for taxi. Charlie didn't take the taxi. Everyone splits dinner.")}
                className="px-3 sm:px-4 py-2 bg-brand-50 text-brand-600 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-wider hover:bg-brand-900 hover:text-white transition-all border border-brand-200/50"
              >
                Try Sample
              </button>
            </div>
            <button
              onClick={handleAiParse}
              disabled={isAiLoading || !aiInput.trim()}
              className="absolute bottom-5 right-5 px-5 sm:px-6 py-2.5 bg-brand-900 text-white rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-brand-900/20"
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span className="hidden sm:inline">Analyzing...</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Parse Scenario</span>
                  <Sparkles size={14} className="sm:hidden" />
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 text-rose-600 text-xs font-semibold bg-rose-50 p-4 rounded-2xl border border-rose-100"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}
        </section>

        {/* Participants Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-500 uppercase tracking-widest text-[10px] font-bold">
              <Users size={12} className="text-brand-900" />
              Participants
            </div>
            <button
              onClick={() => addParticipant(`Person ${participants.length + 1}`)}
              className="px-3 py-1.5 rounded-xl bg-brand-100 text-brand-900 text-[10px] font-bold uppercase tracking-wider hover:bg-brand-900 hover:text-white transition-all flex items-center gap-1.5"
            >
              <UserPlus size={12} /> Add Person
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <AnimatePresence mode="popLayout">
              {participants.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={cn(
                    "flex items-center gap-2 pl-4 pr-2 py-2 bg-white rounded-2xl border shadow-sm transition-colors group",
                    getPColor(p.colorIndex).border,
                    getPColor(p.colorIndex).hoverBorder
                  )}
                >
                  <input
                    value={p.name}
                    onChange={(e) => setParticipants(participants.map(item => item.id === p.id ? { ...item, name: e.target.value } : item))}
                    onFocus={(e) => e.target.select()}
                    className={cn("bg-transparent border-none focus:ring-0 text-sm font-bold w-24 outline-none", getPColor(p.colorIndex).text)}
                  />
                  <button
                    onClick={() => removeParticipant(p.id)}
                    className="p-1.5 rounded-lg text-brand-200 hover:text-rose-500 hover:bg-rose-50 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {participants.length === 0 && (
              <div className="w-full py-8 text-center bg-brand-100/30 rounded-3xl border border-dashed border-brand-200">
                <p className="text-sm text-brand-400 font-medium">No participants yet. Add some people to get started.</p>
              </div>
            )}
          </div>
        </section>

        {/* Expenses Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-500 uppercase tracking-widest text-[10px] font-bold">
              <Receipt size={12} className="text-brand-900" />
              Expenses
            </div>
            <button
              onClick={addExpense}
              className="px-3 py-1.5 rounded-xl bg-brand-900 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-brand-800 transition-all flex items-center gap-1.5 shadow-lg shadow-brand-900/10"
            >
              <Plus size={12} /> Add Expense
            </button>
          </div>

          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {expenses.map((expense) => (
                <motion.div
                  key={expense.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-[2rem] border-2 border-brand-100 p-5 sm:p-8 shadow-sm hover:shadow-xl hover:border-brand-200 transition-all space-y-6 sm:space-y-8 group relative"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                    <div className="flex-1 space-y-3">
                      <input
                        value={expense.description}
                        onChange={(e) => updateExpense(expense.id, { description: e.target.value })}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-transparent border-none focus:ring-0 text-lg sm:text-xl font-bold outline-none placeholder:text-brand-200"
                        placeholder="What was it for?"
                      />
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Paid by</span>
                        <select
                          value={expense.paidBy}
                          onChange={(e) => updateExpense(expense.id, { paidBy: e.target.value })}
                          className="bg-brand-50 border-none rounded-xl px-3 py-2 sm:py-1.5 focus:ring-2 focus:ring-brand-900 text-xs font-bold text-brand-900 cursor-pointer outline-none min-h-[40px]"
                        >
                          {participants.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-start gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-brand-50">
                      <div className="relative flex-1 sm:flex-none">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-400 font-bold text-lg">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={expense.amount || ''}
                          onChange={(e) => updateExpense(expense.id, { amount: parseFloat(e.target.value) || 0 })}
                          className="w-full sm:w-40 pl-9 pr-5 py-3 sm:py-4 bg-brand-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-900 text-right font-mono font-black text-xl sm:text-2xl outline-none"
                          placeholder="0.00"
                        />
                      </div>
                      <button
                        onClick={() => removeExpense(expense.id)}
                        className="p-3 rounded-xl text-brand-200 hover:text-rose-500 hover:bg-rose-50 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">Split among</div>
                      <button
                        onClick={() => {
                          const allIds = participants.map(p => p.id);
                          const isAllSelected = expense.splitAmong.length === participants.length;
                          updateExpense(expense.id, { splitAmong: isAllSelected ? [] : allIds });
                        }}
                        className="text-[10px] font-bold text-brand-900 hover:underline p-2"
                      >
                        {expense.splitAmong.length === participants.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {participants.map(p => {
                        const isActive = expense.splitAmong.includes(p.id);
                        const pColor = getPColor(p.colorIndex);
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              const newSplit = isActive
                                ? expense.splitAmong.filter(id => id !== p.id)
                                : [...expense.splitAmong, p.id];
                              updateExpense(expense.id, { splitAmong: newSplit });
                            }}
                            className={cn(
                              "px-5 py-2.5 rounded-[1.25rem] text-xs font-bold transition-all border-2 min-h-[40px] shadow-sm",
                              isActive
                                ? `${pColor.activeBg} ${pColor.activeText} ${pColor.activeBorder} shadow-md scale-[1.02]`
                                : `bg-white ${pColor.text} ${pColor.border} hover:bg-slate-50 hover:${pColor.hoverBorder}`
                            )}
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {expenses.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-brand-100 text-brand-300">
                <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Receipt size={32} className="opacity-50" />
                </div>
                <h3 className="text-lg font-bold text-brand-900 mb-2">No expenses yet</h3>
                <p className="text-sm max-w-xs mx-auto">Start by describing your scenario above or add an expense manually.</p>
              </div>
            )}
          </div>
        </section>

        {/* Balances Section */}
        {participants.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-brand-500 uppercase tracking-widest text-[10px] font-bold">
              <Users size={12} className="text-brand-900" />
              Individual Summary
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {individualBalances.map((p, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={p.id}
                  className="bg-white p-6 rounded-3xl border border-brand-100 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-brand-900">{p.name}</span>
                    <div className={cn(
                      "text-[10px] font-black uppercase px-2 py-0.5 rounded",
                      p.net >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {p.net >= 0 ? 'Creditor' : 'Debtor'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-brand-400 font-medium">Paid</span>
                      <span className="font-mono font-bold text-brand-900">${p.spent.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-brand-400 font-medium">Share</span>
                      <span className="font-mono font-bold text-brand-900">${p.share.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-brand-50 flex justify-between items-center">
                      <span className="text-xs font-bold text-brand-900">Net</span>
                      <span className={cn(
                        "font-mono font-black text-lg",
                        p.net >= 0 ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {p.net >= 0 ? '+' : ''}{p.net.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Settlement Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-500 uppercase tracking-widest text-[10px] font-bold">
              <ArrowRightLeft size={12} className="text-brand-900" />
              Final Settlement
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={copyToClipboard}
                className="text-[10px] font-bold text-brand-500 hover:text-brand-900 flex items-center gap-1 transition-colors"
              >
                Copy Summary
              </button>
              <div className="text-sm font-black text-brand-900 bg-white px-4 py-1.5 rounded-full border border-brand-200 shadow-sm">
                Total: ${totalAmount.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="bg-brand-900 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5">
              <ArrowRightLeft size={200} />
            </div>

            <div className="relative z-10 space-y-6 sm:space-y-8">
              {settlements.length > 0 ? (
                <div className="grid gap-3 sm:gap-4">
                  {settlements.map((s, idx) => {
                    const fromP = participants.find(p => p.id === s.from);
                    const to = participants.find(p => p.id === s.to)?.name;
                    const fColor = fromP ? getPColor(fromP.colorIndex) : null;
                    const from = fromP?.name;
                    return (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={`${s.from}-${s.to}`}
                        className="flex items-center justify-between p-4 sm:p-6 bg-white/5 rounded-2xl sm:rounded-3xl backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all group"
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className={cn(
                            "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-inner border border-white/20",
                            fColor ? `${fColor.activeBg} ${fColor.activeText}` : 'bg-white/10 text-white'
                          )}>
                            {from?.[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Owes</span>
                            <span className="font-bold text-sm sm:text-lg leading-tight">{from} → {to}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-black text-xl sm:text-2xl text-emerald-400">
                            ${s.amount.toFixed(2)}
                          </div>
                          <div className="text-[9px] sm:text-[10px] font-bold text-white/30 uppercase tracking-widest">Settlement</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 sm:py-12 space-y-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="text-emerald-400" size={32} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black">Perfect Balance</h3>
                  <p className="text-white/60 text-xs sm:text-sm max-w-xs mx-auto">Everyone is settled up. Add some expenses to see the magic happen.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Floating Action Button for Mobile */}
      <div className="fixed bottom-8 right-6 sm:hidden z-50">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={addExpense}
          className="w-14 h-14 bg-brand-900 text-white rounded-full shadow-2xl flex items-center justify-center border-4 border-white"
        >
          <Plus size={24} />
        </motion.button>
      </div>

      {/* Footer / Info */}
      <footer className="max-w-4xl mx-auto px-6 py-20 text-center space-y-4">
        <div className="flex items-center justify-center gap-6 opacity-30">
          <Sparkles size={20} />
          <Users size={20} />
          <Receipt size={20} />
        </div>
        <p className="text-brand-400 text-[10px] font-bold uppercase tracking-[0.2em]">Splitly AI • The Future of Shared Expenses</p>
      </footer>
    </div>
  );
}
