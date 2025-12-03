import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RotateCcw, Clock, User, ChevronRight, Calculator, FileSpreadsheet, TrendingUp } from 'lucide-react';

// 配置：是否使用模拟数据（调试前端用）。对接 Python 后端时改为 false
const USE_MOCK = false; 
const API_BASE_URL = "http://localhost:8000"; // FastAPI 地址

const App = () => {
  const [currentTab, setCurrentTab] = useState('daily');
  const [account, setAccount] = useState('账号_01');
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

  // --- 新增：周报表数据状态 ---
  // Key 为日期字符串 (YYYY-MM-DD)，Value 为当天的详细数据
  // 这里预置了一些假数据，模拟周一和周三已经有数据的情况
  const [weeklyData, setWeeklyData] = useState({
    '2025-11-24': { // 周一
      initCash: 1000000, finalCash: 1500000, 
      initReserve: 0, finalReserve: 20000,
      initExp: 1000000, finalExp: 21000000,
      duration: 5.0, netCash: 500000, netReserve: 20000, netExp: 20000000, hourlyCash: 100000
    },
    '2025-11-26': { // 周三
      initCash: 1200000, finalCash: 1800000,
      initReserve: 50000, finalReserve: 100000,
      initExp: 2000000, finalExp: 27000000,
      duration: 6.0, netCash: 600000, netReserve: 50000, netExp: 25000000, hourlyCash: 100000
    }
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => date.toLocaleTimeString('zh-CN', { hour12: false });
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
      let data = {};

      if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 500));
        const isInit = target.dataType === 'init';
        data = target.scanType === 'cash_exp'
          ? (isInit ? { cash: 1540200, exp: 2400500 } : { cash: 2890500, exp: 5600800 })
          : (isInit ? { reserve: 50000 } : { reserve: 120000 });
      } else {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE_URL}/ocr`, { method: 'POST', body: formData });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const json = await res.json();
        data = parseBackendValues(json.values);
      }

      const payload = { time: formatTime(new Date()) };
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
  }, []);

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
      // 使用当前日期（假设不跨天）
      const todayStr = new Date().toDateString();
      const t1 = new Date(`${todayStr} ${initData.time}`);
      const t2 = new Date(`${todayStr} ${finalData.time}`);
      const diffMs = t2.getTime() - t1.getTime();
      if (!Number.isNaN(diffMs) && diffMs > 0) {
        duration = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
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
        hourlyCash: hourlyCash
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
              onChange={(e) => setAccount(e.target.value)}
              className="bg-transparent font-medium focus:outline-none cursor-pointer"
            >
              {[...Array(18)].map((_, i) => (
                <option key={i} value={`账号_${String(i + 1).padStart(2, '0')}`}>
                  账号_{String(i + 1).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </nav>

      {(uploadTarget || pendingFile) && (
        <div className="mx-6 mt-4">
          <div className="bg-white border border-dashed border-blue-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-blue-700">当前目标：{targetLabel(uploadTarget)}</div>
              <div className="text-xs text-slate-500">
                操作：点击识别按钮 → 选择图片或直接粘贴 → 点击“确定上传”。支持 clipboard 图片粘贴。
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
                <button className="flex items-center gap-2 text-slate-600 border border-slate-200 px-4 py-2 rounded-lg text-sm transition-all hover:bg-slate-50">
                  <FileSpreadsheet className="w-4 h-4" />
                  导出 Excel
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
            {data.time}
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
const WeeklyTable = ({ data }) => {
  // 定义本周日期 (固定为示例中的 11.24 - 11.30)
  // 实际项目中应根据当前日期动态生成
  const days = [
    { name: '周一', date: '2025-11-24', display: '11.24' },
    { name: '周二', date: '2025-11-25', display: '11.25' }, // 休息
    { name: '周三', date: '2025-11-26', display: '11.26' },
    { name: '周四', date: '2025-11-27', display: '11.27' },
    { name: '周五', date: '2025-11-28', display: '11.28' },
    { name: '周六', date: '2025-11-29', display: '11.29' },
    { name: '周日', date: '2025-11-30', display: '11.30' },
  ];

  // 辅助：获取某天的字段值，如果没有则返回 '-'
  const getVal = (dateKey, field, unit = '') => {
    const dayData = data[dateKey];
    if (!dayData) return '-';
    // 格式化数字：超过1万显示 w，超过1亿显示亿
    let val = dayData[field];
    if (val === undefined) return '-';
    
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
    Object.values(data).forEach(d => {
      if (d[field]) {
        sum += d[field];
        hasData = true;
      }
    });
    if (!hasData) return '-';
    if (sum > 100000000) return (sum / 100000000).toFixed(2) + '亿';
    if (sum > 10000) return (sum / 10000).toFixed(1) + 'w';
    return sum;
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
               <td key={i} className={`border border-slate-200 p-3 text-center ${day.name === '周二' ? 'bg-slate-100 text-slate-300' : 'text-green-600 font-bold'}`}>
                 {day.name === '周二' ? '休息' : getVal(day.date, 'netCash')}
               </td>
             ))}
             <td className="border border-slate-200 p-3 text-center text-blue-700 font-bold bg-blue-50">{getSum('netCash')}</td>
          </tr>
          
          <TableRow label="初始储备" days={days} data={data} field="initReserve" total="-" isHeader />
          <TableRow label="最终储备" days={days} data={data} field="finalReserve" total="-" isHeader />
          <tr className="bg-purple-50">
             <td className="border border-slate-200 p-3 font-bold text-purple-700">净得储备</td>
             {days.map((day, i) => (
               <td key={i} className={`border border-slate-200 p-3 text-center ${day.name === '周二' ? 'bg-slate-100 text-slate-300' : 'text-purple-600 font-bold'}`}>
                 {day.name === '周二' ? '休息' : getVal(day.date, 'netReserve')}
               </td>
             ))}
             <td className="border border-slate-200 p-3 text-center text-blue-700 font-bold bg-blue-50">{getSum('netReserve')}</td>
          </tr>
          
          <tr className="bg-blue-50">
             <td className="border border-slate-200 p-3 font-bold text-blue-700">净得经验</td>
             {days.map((day, i) => (
               <td key={i} className={`border border-slate-200 p-3 text-center ${day.name === '周二' ? 'bg-slate-100 text-slate-300' : 'text-blue-600 font-bold'}`}>
                 {day.name === '周二' ? '休息' : getVal(day.date, 'netExp')}
               </td>
             ))}
             <td className="border border-slate-200 p-3 text-center text-blue-700 font-bold bg-blue-100">{getSum('netExp')}</td>
          </tr>

          <TableRow label="挂机时长" days={days} data={data} field="duration" total={getSum('duration') + 'h'} unit="h" />
          <TableRow label="时薪(现金)" days={days} data={data} field="hourlyCash" total="-" unit="" />

        </tbody>
      </table>
    </div>
  );
};

const TableRow = ({ label, days, data, field, total, isHeader, unit }) => {
  // 简易格式化函数 (复用逻辑)
  const format = (val) => {
    if (!val && val !== 0) return '-';
    if (val > 100000000) return (val / 100000000).toFixed(2) + '亿';
    if (val > 10000) return (val / 10000).toFixed(1) + 'w';
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

export default App;
