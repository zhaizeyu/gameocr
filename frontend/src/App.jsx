import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RotateCcw, Clock, User, ChevronRight, Calculator, FileSpreadsheet, TrendingUp } from 'lucide-react';

// 配置：真实模式（不再使用 mock）
const USE_MOCK = false; 
const API_BASE_URL = "http://localhost:8000"; // FastAPI 地址

const App = () => {
  const [currentTab, setCurrentTab] = useState('daily');
  const [account, setAccount] = useState('账号_01');
  const defaultAccounts = [{ id: '账号_01', name: '账号_01' }];
  const [accounts, setAccounts] = useState(defaultAccounts);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [isScanning, setIsScanning] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null); // { dataType, scanType }
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const fileInputRef = useRef(null);

  // 初始状态
  const [initData, setInitData] = useState({
    time: '',
    cash: '',
    reserve: '',
    exp: ''
  });

  // 最终状态
  const [finalData, setFinalData] = useState({
    time: '',
    cash: '',
    reserve: '',
    exp: ''
  });

  // 今日实时计算结果
  const [result, setResult] = useState(null);

  // 周报数据：Key 为 YYYY-MM-DD，Value 为当天数据
  const [weeklyData, setWeeklyData] = useState({});
  const [stateReady, setStateReady] = useState(false); // 防止初次加载前写入空数据
  const [loadingState, setLoadingState] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const saveTimer = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAccountState = useCallback(async (acct) => {
    setLoadingState(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/state?account=${encodeURIComponent(acct)}`);
      if (res.ok) {
        const json = await res.json();
        setWeeklyData(json.weeklyData || {});
        setInitData(json.initData || { time: '', cash: '', reserve: '', exp: '' });
        setFinalData(json.finalData || { time: '', cash: '', reserve: '', exp: '' });
      } else {
        setErrorMsg('加载账号数据失败');
      }
    } catch (e) {
      console.warn('Failed to load state for account', acct, e);
      setErrorMsg('加载账号数据失败');
    } finally {
      setLoadingState(false);
      setStateReady(true);
    }
  }, []);

  // 从后端加载账户列表（默认 state.json）并加载当前账户数据
  useEffect(() => {
    const load = async () => {
      let targetAccount = account;
      try {
        const res = await fetch(`${API_BASE_URL}/state`);
        if (res.ok) {
          const json = await res.json();
          if (json.accounts && Array.isArray(json.accounts) && json.accounts.length) {
            setAccounts(json.accounts);
            if (json.account) targetAccount = json.account;
            setAccount(targetAccount);
          }
        }
      } catch (e) {
        console.warn('Failed to load account list', e);
        setErrorMsg('加载账号列表失败');
      } finally {
        // 加载目标账号数据
        loadAccountState(targetAccount);
      }
    };
    load();
  }, [loadAccountState]);  // 初次加载

  // 持久化账户列表（无 account 参数）
  useEffect(() => {
    if (!stateReady || loadingState) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`${API_BASE_URL}/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accounts, account }),
        });
      } catch (e) {
        console.warn('Failed to save account list', e);
        setErrorMsg('保存账号列表失败');
      } finally {
        setSaving(false);
      }
    }, 500);
  }, [accounts, account, stateReady, loadingState]);

  // 持久化当前账号数据
  useEffect(() => {
    if (!stateReady || loadingState) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`${API_BASE_URL}/state?account=${encodeURIComponent(account)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            weeklyData,
            initData,
            finalData,
          }),
        });
      } catch (e) {
        console.warn('Failed to save state for account', account, e);
        setErrorMsg('保存数据失败');
      } finally {
        setSaving(false);
      }
    }, 500);
  }, [weeklyData, initData, finalData, account, stateReady, loadingState]);

  // 确保当前账号存在
  useEffect(() => {
    if (!accounts.find((a) => a.id === account)) {
      if (accounts.length > 0) {
        setAccount(accounts[0].id);
      } else {
        setAccounts(defaultAccounts);
        setAccount(defaultAccounts[0].id);
      }
    }
  }, [accounts, account]);

  const formatTime = (date) => date.toLocaleTimeString('zh-CN', { hour12: false });
  const formatDateTime = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${formatTime(date)}`;
  const parseDateTime = (value) => {
    const d = value ? new Date(value) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  };
  const formatDate = (date) => date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });

  // 辅助：获取 YYYY-MM-DD 格式的日期字符串作为 Key
  const getDateKey = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const parseBackendValues = (values = {}) => ({
    cash: values["现金"] ?? '',
    exp: values["获得经验"] ?? '',
    reserve: values["储备金"] ?? '',
  });

  const setPendingFromFile = (file) => {
    if (!file) return;
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  };

  const targetLabel = (target) => {
    if (!target) return '未选择';
    const part = target.dataType === 'init' ? '初始' : '最终';
    const what = target.scanType === 'cash_exp' ? '现金 + 经验' : '储备金';
    return `${part} · ${what}`;
  };

  const runOcrUpload = useCallback(async (target, file) => {
    // target: { dataType: 'init'|'final', scanType: 'cash_exp'|'reserve' }
    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('account', account);
      const res = await fetch(`${API_BASE_URL}/ocr?account=${encodeURIComponent(account)}`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const data = parseBackendValues(json.values);

      const now = new Date();
      const payload = { time: now.toISOString(), timeDisplay: formatDateTime(now) };
      if (target.scanType === 'cash_exp') {
        payload.cash = data.cash ?? '';
        payload.exp = data.exp ?? '';
      } else {
        payload.reserve = data.reserve ?? '';
      }
      const setter = target.dataType === 'init' ? setInitData : setFinalData;
      setter(prev => ({ ...prev, ...payload }));
    } catch (error) {
      alert(`识别失败: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  }, [account]);

  const startUpload = (dataType, scanType) => {
    setUploadTarget({ dataType, scanType });
    setPendingFile(null);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!uploadTarget) {
      alert('请先选择要识别的位置（初始/最终，现金+经验或储备金）。');
      return;
    }
    setPendingFromFile(file);
  };

  const handlePaste = useCallback(async (event) => {
    const item = [...event.clipboardData.items].find((i) => i.type.startsWith('image/'));
    if (!item) return;
    event.preventDefault();
    const file = item.getAsFile();
    if (!file) return;
    if (!uploadTarget) {
      alert('请先点击“识别”按钮以选择目标，然后粘贴图片。');
      return;
    }
    setPendingFromFile(file);
  }, [uploadTarget, pendingPreview]);

  const confirmUpload = async () => {
    if (!uploadTarget) {
      alert('请先点击目标卡片上的“识别”按钮。');
      return;
    }
    if (!pendingFile) {
      alert('请先选择或粘贴图片，再点击确定上传。');
      return;
    }
    await runOcrUpload(uploadTarget, pendingFile);
    setPendingFile(null);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
    setUploadTarget(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cancelUpload = () => {
    setPendingFile(null);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
    setUploadTarget(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // 计算逻辑 & 更新周报
  const handleCalculate = () => {
    if (!initData.cash || !finalData.cash) {
      alert("请先完成数据录入");
      return;
    }

    const iCash = Number(initData.cash);
    const fCash = Number(finalData.cash);
    const iReserve = Number(initData.reserve);
    const fReserve = Number(finalData.reserve);
    const iExp = Number(initData.exp);
    const fExp = Number(finalData.exp);

    const cashDiff = fCash - iCash;
    const reserveDiff = fReserve - iReserve;
    const expDiff = fExp - iExp;
    
    // 自动计算时长
    let duration = 4.0; 
    if (initData.time && finalData.time) {
      const t1 = parseDateTime(initData.time);
      const t2 = parseDateTime(finalData.time);
      if (t1 && t2) {
        const diffMs = t2.getTime() - t1.getTime();
        if (!Number.isNaN(diffMs) && diffMs > 0) {
          duration = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
        }
      }
    }
    const hourlyCash = duration > 0 ? Math.floor(cashDiff / duration) : 0;
    const hourlyReserve = duration > 0 ? Math.floor(reserveDiff / duration) : 0;
    const hourlyExp = duration > 0 ? Math.floor(expDiff / duration) : 0;

    // 1. 设置今日显示结果
    setResult({
      cash: cashDiff,
      reserve: reserveDiff,
      exp: expDiff,
      duration: duration,
      hourlyCash: hourlyCash,
      hourlyReserve: hourlyReserve,
      hourlyExp: hourlyExp
    });

    // 2. 自动更新周报表数据
    // 注意：这里默认使用“今天”的日期作为 Key。
    // 如果您在测试时想填入指定日期，可以临时修改这里的 dateKey
    const todayKey = getDateKey(new Date()); // 例如 "2025-11-27"
    
    setWeeklyData(prev => ({
      ...prev,
      [todayKey]: {
        initCash: iCash, finalCash: fCash,
        initReserve: iReserve, finalReserve: fReserve,
        initExp: iExp, finalExp: fExp,
        duration: duration,
        netCash: cashDiff,
        netReserve: reserveDiff,
        netExp: expDiff,
        hourlyCash: hourlyCash,
        hourlyReserve: hourlyReserve,
        hourlyExp: hourlyExp,
      }
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100 pb-10">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      {(uploadTarget || pendingFile) && (
        <div className="mx-6 mt-4">
          <div className="bg-white border border-dashed border-blue-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-blue-700">当前目标：{targetLabel(uploadTarget)}</div>
              <div className="text-xs text-slate-500">
                操作：点击识别按钮 → 粘贴或选择图片 → 点击“确定上传”。支持 clipboard 图片粘贴。
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium hover:bg-slate-100 transition-all"
              >
                选择图片
              </button>
              <button
                onClick={confirmUpload}
                disabled={!pendingFile || isScanning}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                确定上传
              </button>
              <button
                onClick={cancelUpload}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
            </div>
            <div className="flex items-center gap-3">
              {pendingPreview ? (
                <img src={pendingPreview} alt="待上传预览" className="w-24 h-24 object-contain rounded border border-slate-200 bg-slate-50" />
              ) : (
                <div className="text-xs text-slate-400">等待粘贴/选择图片</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 顶部导航 */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Calculator className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            梦幻收益分析助手
          </h1>
        </div>
        
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => setCurrentTab('daily')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentTab === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            今日录入
          </button>
          <button 
            onClick={() => setCurrentTab('report')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${currentTab === 'report' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            周报表
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
            <Clock className="w-4 h-4" />
            <span className="font-mono font-medium">{formatDate(currentTime)} {formatTime(currentTime)}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <select 
              value={account} 
              onChange={(e) => {
                const next = e.target.value;
                if (next === account) return;
                setAccount(next);
                loadAccountState(next);
              }}
              className="bg-transparent font-medium focus:outline-none cursor-pointer"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              <button
                className="text-xs text-blue-600 border border-blue-100 px-2 py-1 rounded hover:bg-blue-50"
                onClick={() => {
                  const name = window.prompt('新账号名称', `账号_${String(accounts.length + 1).padStart(2, '0')}`);
                  if (!name) return;
                  const id = name;
                  setAccounts((prev) => [...prev, { id, name }]);
                  setAccount(id);
                  loadAccountState(id);
                }}
              >
                新增
              </button>
              <button
                className="text-xs text-slate-600 border border-slate-200 px-2 py-1 rounded hover:bg-slate-50"
                onClick={() => {
                  const current = accounts.find((a) => a.id === account);
                  if (!current) return;
                  const name = window.prompt('修改账号名称', current.name);
                  if (!name) return;
                  setAccounts((prev) => prev.map((a) => (a.id === account ? { ...a, name } : a)));
                }}
              >
                重命名
              </button>
              <button
                className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                onClick={() => {
                  if (accounts.length <= 1) {
                    alert('至少保留一个账号');
                    return;
                  }
                  if (!window.confirm('确认删除当前账号？')) return;
                  const nextAccounts = accounts.filter((a) => a.id !== account);
                  const next = nextAccounts[0]?.id || defaultAccounts[0].id;
                  setAccounts(nextAccounts.length ? nextAccounts : defaultAccounts);
                  setAccount(next);
                  loadAccountState(next);
                }}
              >
                删除
              </button>
            </div>
            </div>
          {errorMsg && (
            <div className="ml-4 text-xs text-red-500">{errorMsg}</div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {currentTab === 'daily' ? (
          <div className="space-y-6">
            {/* 录入区 */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-start">
              
              <DataCard 
                title="初始状态 (上号)" 
                type="init"
                data={initData} 
                setData={setInitData}
                onScanCashExp={() => startUpload('init', 'cash_exp')}
                onScanReserve={() => startUpload('init', 'reserve')}
                isScanning={isScanning}
                color="blue"
              />

              <div className="hidden lg:flex flex-col items-center justify-center h-full pt-20 opacity-30">
                <ChevronRight className="w-12 h-12 text-slate-400" />
                <span className="text-xs font-medium text-slate-400">GUA JI ZHONG</span>
              </div>

              <DataCard 
                title="最终状态 (下号)" 
                type="final"
                data={finalData} 
                setData={setFinalData}
                onScanCashExp={() => startUpload('final', 'cash_exp')}
                onScanReserve={() => startUpload('final', 'reserve')}
                isScanning={isScanning}
                color="indigo"
              />
            </div>

            {/* 结果计算区 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 bg-green-500 rounded-full"></div>
                  <h2 className="text-lg font-bold text-slate-800">收益结算</h2>
                </div>
                <button 
                  onClick={handleCalculate}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-2.5 rounded-lg font-medium shadow-md shadow-green-200 transition-all active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  计算并保存到周报
                </button>
              </div>

              {result ? (
                <div className="space-y-6">
                  {/* 第一行：总收益概览 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <ResultBox label="现金净收益" value={result.cash} subValue={`+${(result.cash/10000).toFixed(2)}w`} color="text-amber-600" bg="bg-amber-50" border="border-amber-100" />
                    <ResultBox label="储备金净收益" value={result.reserve} subValue={`+${(result.reserve/10000).toFixed(2)}w`} color="text-purple-600" bg="bg-purple-50" border="border-purple-100" />
                    <ResultBox label="经验净收益" value={result.exp} subValue={`+${(result.exp/10000000).toFixed(2)}亿`} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" />
                    <div className="bg-slate-100 rounded-lg p-4 flex flex-col justify-center items-center border border-slate-200">
                      <span className="text-xs text-slate-500 font-medium uppercase mb-1">挂机时长</span>
                      <span className="text-2xl font-bold text-slate-700">{result.duration}<span className="text-sm font-normal ml-1">小时</span></span>
                    </div>
                  </div>

                  {/* 第二行：效率分析 */}
                  <div className="border-t border-slate-100 pt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-4 h-4 text-slate-400" />
                      <h3 className="text-sm font-bold text-slate-600">效率分析 (每小时收益)</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <EfficiencyBox label="每小时现金" value={result.hourlyCash} unit="两/h" color="text-amber-600" />
                      <EfficiencyBox label="每小时储备金" value={result.hourlyReserve} unit="两/h" color="text-purple-600" />
                      <EfficiencyBox label="每小时经验" value={result.hourlyExp} unit="点/h" color="text-blue-600" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <p className="text-slate-400 text-sm">数据录入完成后，点击右上角“计算”按钮查看分析，并自动录入周报</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-x-auto">
               <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">综合数据周报</h2>
                    <p className="text-xs text-slate-500">自动汇总本周数据</p>
                  </div>
                </div>
                <button
                  onClick={() => handleExport(API_BASE_URL, account, accounts, setExporting, setErrorMsg)}
                  disabled={exporting}
                  className="flex items-center gap-2 text-slate-600 border border-slate-200 px-4 py-2 rounded-lg text-sm transition-all hover:bg-slate-50 disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {exporting ? '导出中...' : '导出 Excel'}
                </button>
              </div>

            {/* 将周数据传递给报表组件 */}
            <WeeklyTable data={weeklyData} />
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

// --- 子组件 ---

const DataCard = ({ title, type, data, setData, onScanCashExp, onScanReserve, isScanning, color }) => {
  const isInit = type === 'init';
  const borderColor = isInit ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-indigo-500';

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${borderColor}`}>
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-slate-700">{title}</h3>
        {data.time ? (
          <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
            {data.timeDisplay || formatDateTime(new Date(data.time))}
          </span>
        ) : (
          <span className="text-xs text-slate-400">未录入时间</span>
        )}
      </div>
      
      <div className="p-5 space-y-5">
        <div>
           <div className="flex justify-between items-center mb-2">
             <span className="text-xs font-bold text-slate-500 uppercase">步骤一: 现金 & 经验</span>
             <button 
               onClick={onScanCashExp}
               disabled={isScanning}
               className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 rounded text-xs font-medium transition-all disabled:opacity-50"
              >
                <Camera className="w-3 h-3" />
                识别 现金+经验（选文件/粘贴）
             </button>
           </div>
           <div className="space-y-2 pl-2 border-l-2 border-slate-100">
              <InputRowSimple label="现金" value={data.cash} unit="两" onChange={(e) => setData({...data, cash: e.target.value})} />
              <InputRowSimple label="经验" value={data.exp} unit="点" onChange={(e) => setData({...data, exp: e.target.value})} />
           </div>
        </div>

        <div>
           <div className="flex justify-between items-center mb-2">
             <span className="text-xs font-bold text-slate-500 uppercase">步骤二: 储备金</span>
             <button 
               onClick={onScanReserve}
               disabled={isScanning}
               className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1 rounded text-xs font-medium transition-all disabled:opacity-50"
              >
                <Camera className="w-3 h-3" />
                识别 储备金（选文件/粘贴）
             </button>
           </div>
           <div className="pl-2 border-l-2 border-slate-100">
              <InputRowSimple label="储备" value={data.reserve} unit="两" onChange={(e) => setData({...data, reserve: e.target.value})} />
           </div>
        </div>
      </div>
    </div>
  );
};

const InputRowSimple = ({ label, value, unit, onChange }) => (
  <div className="flex items-center gap-3">
    <label className="w-10 text-sm font-medium text-slate-500 text-right">{label}</label>
    <div className="relative flex-1">
      <input 
        type="number" 
        value={value}
        onChange={onChange}
        className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
        placeholder="0"
      />
      <span className="absolute right-3 top-1.5 text-xs text-slate-400">{unit}</span>
    </div>
  </div>
);

const ResultBox = ({ label, value, subValue, color, bg, border }) => (
  <div className={`${bg} ${border} border rounded-lg p-4 flex flex-col justify-center`}>
    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{label}</span>
    <span className={`text-xl font-bold ${color} truncate`}>{value.toLocaleString()}</span>
    <span className="text-xs text-slate-400 font-medium mt-1">{subValue}</span>
  </div>
);

const EfficiencyBox = ({ label, value, unit, color }) => (
  <div className="bg-slate-50 border border-slate-200 rounded p-3 flex justify-between items-center">
    <span className="text-sm text-slate-600 font-medium">{label}</span>
    <div className="text-right">
      <span className={`block font-bold ${color}`}>{value.toLocaleString()}</span>
      <span className="text-[10px] text-slate-400">{unit}</span>
    </div>
  </div>
);

// --- 动态周报表组件 ---
const WeeklyTable = ({ data, onExport }) => {
  // 动态生成本周日期（周一到周日）
  const getWeekDays = () => {
    const today = new Date();
    const day = today.getDay() || 7; // 周一=1, 周日=7
    const monday = new Date(today);
    monday.setDate(today.getDate() - day + 1);
    const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      return {
        name: names[idx],
        date: `${year}-${month}-${date}`,
        display: `${month}.${date}`,
      };
    });
  };

  const days = getWeekDays();
  const dayKeys = new Set(days.map((d) => d.date));

  // 辅助：获取某天的字段值，如果没有则返回 '-'
  const getVal = (dateKey, field, unit = '') => {
    const dayData = data[dateKey];
    if (!dayData) return '-';
    // 格式化数字：超过1万显示 w，超过1亿显示亿
    let val = dayData[field];
    if (val === undefined || val === null) return '-';
    // 支持字符串数字
    if (typeof val === 'string' && val.trim() !== '' && !Number.isNaN(Number(val))) {
      val = Number(val);
    }
    
    // 简易格式化
    if (val > 100000000) return (val / 100000000).toFixed(2) + '亿';
    if (val > 10000) return (val / 10000).toFixed(1) + 'w';
    if (val === 0) return '0';
    return val + unit;
  };

  // 辅助：计算汇总
  const getSum = (field) => {
    let sum = 0;
    let hasData = false;
    Object.entries(data).forEach(([dateKey, d]) => {
      if (!dayKeys.has(dateKey)) return; // 仅统计本周
      let val = d[field];
      if (val === undefined || val === null) return;
      if (typeof val === 'string' && val.trim() !== '' && !Number.isNaN(Number(val))) {
        val = Number(val);
      }
      sum += val;
      hasData = true;
    });
    if (!hasData) return '-';
    if (sum > 100000000) return (sum / 100000000).toFixed(2) + '亿';
    if (sum > 10000) return (sum / 10000).toFixed(1) + 'w';
    return sum;
  };

  const calcHourlyTotal = (data, dayKeys, netField, durationField) => {
    let netSum = 0;
    let durSum = 0;
    Object.entries(data).forEach(([dateKey, d]) => {
      if (!dayKeys.has(dateKey)) return;
      let net = d[netField];
      let dur = d[durationField];
      if (net === undefined || dur === undefined) return;
      if (typeof net === 'string' && net.trim() !== '' && !Number.isNaN(Number(net))) net = Number(net);
      if (typeof dur === 'string' && dur.trim() !== '' && !Number.isNaN(Number(dur))) dur = Number(dur);
      netSum += net || 0;
      durSum += dur || 0;
    });
    if (durSum <= 0) return '-';
    return Math.floor(netSum / durSum);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse border border-slate-200">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-200 p-3 text-left font-bold text-slate-700 min-w-[100px]">项目 \ 日期</th>
            {days.map((day, i) => (
               <th key={i} className={`border border-slate-200 p-3 font-bold text-slate-700 min-w-[100px] ${day.name === '周二' ? 'bg-slate-200 text-slate-400' : ''}`}>
                 <div className="flex flex-col items-center">
                   <span>{day.name}</span>
                   <span className="text-xs font-normal opacity-70">{day.display}</span>
                 </div>
               </th>
            ))}
            <th className="border border-slate-200 p-3 font-bold text-blue-700 bg-blue-50 min-w-[120px]">本周汇总</th>
          </tr>
        </thead>
        <tbody>
          {/* 生成数据行 */}
          <TableRow label="初始现金" days={days} data={data} field="initCash" total="-" isHeader />
          <TableRow label="最终现金" days={days} data={data} field="finalCash" total="-" isHeader />
          <tr className="bg-green-50">
             <td className="border border-slate-200 p-3 font-bold text-green-700">净得现金</td>
             {days.map((day, i) => (
               <td key={i} className="border border-slate-200 p-3 text-center text-green-600 font-bold">
                 {getVal(day.date, 'netCash')}
               </td>
             ))}
             <td className="border border-slate-200 p-3 text-center text-blue-700 font-bold bg-blue-50">{getSum('netCash')}</td>
          </tr>
          
          <TableRow label="初始储备" days={days} data={data} field="initReserve" total="-" isHeader />
          <TableRow label="最终储备" days={days} data={data} field="finalReserve" total="-" isHeader />
          <tr className="bg-purple-50">
             <td className="border border-slate-200 p-3 font-bold text-purple-700">净得储备</td>
             {days.map((day, i) => (
               <td key={i} className="border border-slate-200 p-3 text-center text-purple-600 font-bold">
                 {getVal(day.date, 'netReserve')}
               </td>
             ))}
             <td className="border border-slate-200 p-3 text-center text-blue-700 font-bold bg-blue-50">{getSum('netReserve')}</td>
          </tr>
          
          <tr className="bg-blue-50">
             <td className="border border-slate-200 p-3 font-bold text-blue-700">净得经验</td>
             {days.map((day, i) => (
               <td key={i} className="border border-slate-200 p-3 text-center text-blue-600 font-bold">
                 {getVal(day.date, 'netExp')}
               </td>
             ))}
             <td className="border border-slate-200 p-3 text-center text-blue-700 font-bold bg-blue-100">{getSum('netExp')}</td>
          </tr>

          <TableRow label="挂机时长" days={days} data={data} field="duration" total={getSum('duration') + 'h'} unit="h" />
          <TableRow label="每小时现金" days={days} data={data} field="hourlyCash" total={calcHourlyTotal(data, dayKeys, 'netCash', 'duration')} unit="两/h" />
          <TableRow label="每小时储备金" days={days} data={data} field="hourlyReserve" total={calcHourlyTotal(data, dayKeys, 'netReserve', 'duration')} unit="两/h" />
          <TableRow label="每小时经验" days={days} data={data} field="hourlyExp" total={calcHourlyTotal(data, dayKeys, 'netExp', 'duration')} unit="点/h" />

        </tbody>
      </table>
    </div>
  );
};

const TableRow = ({ label, days, data, field, total, isHeader, unit }) => {
  // 简易格式化函数 (复用逻辑)
    const format = (val) => {
      if (val === undefined || val === null || (val === '' && val !== 0)) return '-';
      if (typeof val === 'string' && val.trim() !== '' && !Number.isNaN(Number(val))) {
        val = Number(val);
      }
      if (typeof val === 'number') {
        if (val > 100000000) return (val / 100000000).toFixed(2) + '亿';
        if (val > 10000) return (val / 10000).toFixed(1) + 'w';
        if (val === 0) return '0';
      }
      return val + (unit || '');
    };

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className={`border border-slate-200 p-3 text-slate-600 ${isHeader ? 'text-xs text-slate-400 pl-6' : 'font-medium'}`}>{label}</td>
      {days.map((day, i) => {
        const dayData = data[day.date];
        const val = dayData ? dayData[field] : null;
        return (
          <td key={i} className={`border border-slate-200 p-3 text-center ${val === null ? 'bg-slate-50 text-slate-300' : isHeader ? 'text-xs text-slate-400' : 'text-slate-600'}`}>
            {format(val)}
          </td>
        );
      })}
      <td className="border border-slate-200 p-3 text-center font-bold text-slate-700 bg-slate-50">{total}</td>
    </tr>
  );
};

// 导出所有周数据（跨账号合并）为 CSV
const handleExport = async (apiBase, currentAccount, accountsList, setExporting, setErrorMsg) => {
  setExporting(true);
  try {
    const res = await fetch(`${apiBase}/state`);
    let accounts = [];
    let globalAccount = currentAccount || 'default';
    if (res.ok) {
      const json = await res.json();
      if (json.accounts) accounts = json.accounts;
      if (json.account) globalAccount = json.account;
    }
    const accountMap = new Map();
    const addAcct = (id, name) => {
      if (!id) return;
      accountMap.set(id, name || id);
    };
    (accountsList || []).forEach((a) => addAcct(a.id, a.name));
    accounts.forEach((a) => addAcct(a.id, a.name));
    addAcct(currentAccount, (accountsList || []).find((a) => a.id === currentAccount)?.name);
    addAcct(globalAccount, accounts.find((a) => a.id === globalAccount)?.name || globalAccount);
    // 不再强制加 default，避免额外账号
    const accountEntries = Array.from(accountMap.entries());

    const rows = [];
    rows.push(['账号', '日期', '初始现金', '最终现金', '净得现金', '初始储备', '最终储备', '净得储备', '初始经验', '最终经验', '净得经验', '挂机时长', '每小时现金', '每小时储备金', '每小时经验']);

    for (const [acct, acctName] of accountEntries) {
      const acctSafe = encodeURIComponent(acct);
      const stateRes = await fetch(`${apiBase}/state?account=${acctSafe}`);
      if (!stateRes.ok) continue;
      const stateJson = await stateRes.json();
      const data = stateJson.weeklyData || {};
      const dates = Object.keys(data).sort();
      if (dates.length === 0) {
        // 仍然输出账号行，避免漏掉账号
        rows.push([acctName, '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      } else {
        dates.forEach((dateKey) => {
          const d = data[dateKey] || {};
          rows.push([
            acctName,
            dateKey,
            d.initCash ?? '',
            d.finalCash ?? '',
            d.netCash ?? '',
            d.initReserve ?? '',
            d.finalReserve ?? '',
            d.netReserve ?? '',
            d.initExp ?? '',
            d.finalExp ?? '',
            d.netExp ?? '',
            d.duration ?? '',
            d.hourlyCash ?? '',
            d.hourlyReserve ?? '',
            d.hourlyExp ?? '',
          ]);
        });
      }
    }

    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'weekly_report_all_accounts.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn('Export failed', e);
    setErrorMsg('导出失败');
    alert(`导出失败: ${e.message}`);
  } finally {
    setExporting(false);
  }
};

export default App;
