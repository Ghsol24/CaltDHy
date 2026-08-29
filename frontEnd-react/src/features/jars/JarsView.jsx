import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { JarModal } from './JarModal';
import { JarTransactionModal } from './JarTransactionModal';
import { JarDetailModal } from './JarDetailModal';
import { JarHistoryModal } from './JarHistoryModal';
import { FinancialTipsModal } from './FinancialTipsModal';
import { JarGlassGraphic } from './JarGlassGraphic';
import { formatCurrency, formatDate, formatPercent } from '../../utils/formatters';
import { EmptyState } from '../../components/ui/EmptyState';
import '../../assets/css/jars.css';

function formatTick(num) {
  if (num >= 1000000) {
    const val = num / 1000000;
    return val % 1 === 0 ? `${val}M` : `${val.toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${Math.round(num / 1000)}k`;
  }
  return String(num);
}

export function JarsView() {
  const { jars, isLoading, error, fetchData, deleteJar } = useJarStore();
  const { confirm } = useConfirmStore();
  const { addToast } = useToastStore();
  const { setJarsSubTab } = useSpendingStore();
  const { theme } = useThemeStore();

  // Modals state
  const [isJarModalOpen, setIsJarModalOpen] = useState(false);
  const [editingJar, setEditingJar] = useState(null);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [activeJar, setActiveJar] = useState(null);
  const [txAction, setTxAction] = useState('deposit'); // 'deposit' | 'withdraw'

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailJar, setSelectedDetailJar] = useState(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);
  const [tipsTopic, setTipsTopic] = useState('smart'); // 'smart' | '50-30-20'

  // Toolbar & view settings
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'progress_desc' | 'deadline_asc' | 'name_asc'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [activeMenuJarId, setActiveMenuJarId] = useState(null);
  const [recomIndex, setRecomIndex] = useState(0);

  // Financial Chart Settings
  const [selectedMonthVal, setSelectedMonthVal] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activePointIndex, setActivePointIndex] = useState(null);

  const availableMonths = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
      months.push({ value: val, label });
    }
    return months;
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Close card menu on outside click
  useEffect(() => {
    const handleWindowClick = () => setActiveMenuJarId(null);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  // ── Scroll Spy via IntersectionObserver ──
  useEffect(() => {
    const sectionList = [
      { id: 'jars-section-goals', tab: 'goals' },
      { id: 'jars-section-list', tab: 'jars' },
      { id: 'jars-section-history', tab: 'history' }
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        if (window.__caltdhy_programmatic_scroll) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const match = sectionList.find((s) => s.id === entry.target.id);
            if (match) {
              setJarsSubTab(match.tab);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '-88px 0px -50% 0px',
        threshold: 0.2
      }
    );

    sectionList.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [setJarsSubTab]);

  // ── 1. Aggregate Financial Metrics ──
  const { totalSaved, totalTarget, totalPercent, totalRemaining, activeJarsCount } = useMemo(() => {
    let saved = 0;
    let target = 0;
    let activeCount = 0;

    jars.forEach((jar) => {
      const cur = Number(jar.current) || 0;
      const tgt = Number(jar.target) || 0;
      saved += cur;
      target += tgt;
      if (cur > 0 || tgt > 0) {
        activeCount++;
      }
    });

    const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    const remaining = Math.max(0, target - saved);

    return {
      totalSaved: saved,
      totalTarget: target,
      totalPercent: percent,
      totalRemaining: remaining,
      activeJarsCount: activeCount
    };
  }, [jars]);

  const totalCurrent = totalSaved;

  // ── 2. Month-Over-Month Saving Trend ──
  const savingTrend = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const lastMonthDate = new Date(curYear, curMonth - 1, 1);
    const lastYear = lastMonthDate.getFullYear();
    const lastMonth = lastMonthDate.getMonth();

    let thisMonthTotal = 0;
    let lastMonthTotal = 0;
    let hasTransactions = false;

    jars.forEach((jar) => {
      const history = Array.isArray(jar.history) ? jar.history : [];
      history.forEach((h) => {
        const amt = Number(h.amount) || 0;
        const d = new Date(h.date || Date.now());
        const isDeposit = h.type === 'deposit' || h.type === 'initial';
        const isWithdraw = h.type === 'withdraw';

        if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
          if (isDeposit) {
            thisMonthTotal += amt;
            hasTransactions = true;
          } else if (isWithdraw) {
            thisMonthTotal -= amt;
            hasTransactions = true;
          }
        } else if (d.getFullYear() === lastYear && d.getMonth() === lastMonth) {
          if (isDeposit) {
            lastMonthTotal += amt;
          } else if (isWithdraw) {
            lastMonthTotal -= amt;
          }
        }
      });
    });

    thisMonthTotal = Math.max(0, thisMonthTotal);
    lastMonthTotal = Math.max(0, lastMonthTotal);

    if (!hasTransactions && totalSaved > 0) {
      thisMonthTotal = totalSaved;
    }

    let trend = 12;
    let isPositive = true;

    if (lastMonthTotal > 0) {
      trend = Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100);
      isPositive = trend >= 0;
    } else if (thisMonthTotal > 0) {
      trend = 12;
      isPositive = true;
    } else {
      trend = 0;
      isPositive = true;
    }

    return {
      thisMonthSavings: thisMonthTotal,
      trendPercent: Math.abs(trend),
      trendIsPositive: isPositive
    };
  }, [jars, totalSaved]);

  const { thisMonthSavings, trendPercent, trendIsPositive } = savingTrend;

  // ── 2b. Comprehensive Financial Chart Calculation (100% Real User Data) ──
  const detailedChartData = useMemo(() => {
    const [selYearStr, selMonthStr] = selectedMonthVal.split('-');
    const year = parseInt(selYearStr, 10) || new Date().getFullYear();
    const month = parseInt(selMonthStr, 10) - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
    const currentDay = isCurrentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth;

    // Track daily net savings, deposits, and withdrawals strictly from user's actual jar history
    const dailyNet = new Array(daysInMonth + 1).fill(0);
    const dailyDeposits = new Array(daysInMonth + 1).fill(0);
    const dailyWithdrawals = new Array(daysInMonth + 1).fill(0);
    const activeDaysSet = new Set();
    let totalMonthNet = 0;

    jars.forEach((jar) => {
      const history = Array.isArray(jar.history) ? jar.history : [];
      let jarNetThisMonth = 0;

      history.forEach((h) => {
        const d = new Date(h.date || Date.now());
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = Math.min(daysInMonth, Math.max(1, d.getDate()));
          const amt = Number(h.amount) || 0;
          if (amt > 0) {
            if (h.type === 'deposit' || h.type === 'initial') {
              dailyNet[day] += amt;
              dailyDeposits[day] += amt;
              jarNetThisMonth += amt;
              totalMonthNet += amt;
              activeDaysSet.add(day);
            } else if (h.type === 'withdraw') {
              dailyNet[day] -= amt;
              dailyWithdrawals[day] += amt;
              jarNetThisMonth -= amt;
              totalMonthNet -= amt;
              activeDaysSet.add(day);
            }
          }
        }
      });

      // If jar has current balance created in this month but history was not explicitly logged
      const jarCurrent = Number(jar.current) || 0;
      if (jarCurrent > jarNetThisMonth && jar.createdAt) {
        const createD = new Date(jar.createdAt);
        if (createD.getFullYear() === year && createD.getMonth() === month) {
          const day = Math.min(daysInMonth, Math.max(1, createD.getDate()));
          const delta = jarCurrent - jarNetThisMonth;
          if (delta > 0) {
            dailyNet[day] += delta;
            dailyDeposits[day] += delta;
            totalMonthNet += delta;
            activeDaysSet.add(day);
          }
        }
      }
    });

    // Fallback: If no explicit history records exist yet, use totalSaved on currentDay
    if (activeDaysSet.size === 0 && totalSaved > 0) {
      dailyNet[currentDay] = totalSaved;
      dailyDeposits[currentDay] = totalSaved;
      totalMonthNet = totalSaved;
      activeDaysSet.add(currentDay);
    }

    // Compute actual cumulative savings across each day in the month
    const cumulativeByDay = new Array(daysInMonth + 1).fill(0);
    let running = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      running += dailyNet[d];
      cumulativeByDay[d] = Math.max(0, running);
    }

    const monthSavingsTotal = Math.max(0, running);

    // Calculate highest day amount based on net daily savings or single highest deposit
    let highestDayAmount = 0;
    let highestDepositDay = currentDay;
    for (let d = 1; d <= daysInMonth; d++) {
      const netDay = dailyNet[d];
      if (netDay > highestDayAmount) {
        highestDayAmount = netDay;
        highestDepositDay = d;
      }
    }
    if (highestDayAmount === 0) {
      for (let d = 1; d <= daysInMonth; d++) {
        if (dailyDeposits[d] > highestDayAmount) {
          highestDayAmount = dailyDeposits[d];
          highestDepositDay = d;
        }
      }
    }
    if (highestDayAmount === 0 && monthSavingsTotal > 0) {
      highestDayAmount = monthSavingsTotal;
    }

    // Determine the furthest day to plot:
    // For current month, stop at currentDay (today, e.g. 27); for past months, plot entire daysInMonth
    const maxDayToPlot = isCurrentMonth ? currentDay : daysInMonth;

    // Milestone days: 1, 5, 10, 15, 20, 25 up to maxDayToPlot
    const standardMilestones = [1, 5, 10, 15, 20, 25];
    const milestoneDays = standardMilestones.filter((d) => d < maxDayToPlot);
    if (!milestoneDays.includes(maxDayToPlot)) {
      milestoneDays.push(maxDayToPlot);
    }

    const keyDays = Array.from(new Set([...milestoneDays, ...activeDaysSet]))
      .filter((d) => d >= 1 && d <= maxDayToPlot)
      .sort((a, b) => a - b);

    const points = keyDays.map((d) => ({
      day: d,
      value: cumulativeByDay[d],
      hasDeposit: dailyDeposits[d] > 0,
      hasWithdraw: dailyWithdrawals[d] > 0,
      isToday: isCurrentMonth && d === currentDay
    }));

    // Calculate Y-scale with 5 clean steps based on real max value
    const maxVal = Math.max(...points.map((p) => p.value), 1000);
    let yMax = 2500000;
    if (maxVal <= 500000) {
      yMax = 500000;
    } else if (maxVal <= 1000000) {
      yMax = 1000000;
    } else if (maxVal <= 2500000) {
      yMax = 2500000;
    } else if (maxVal <= 5000000) {
      yMax = 5000000;
    } else if (maxVal <= 10000000) {
      yMax = 10000000;
    } else {
      const power = Math.pow(10, Math.floor(Math.log10(maxVal)));
      yMax = Math.ceil((maxVal * 1.15) / power) * power;
    }

    const yStep = yMax / 5;
    const yTicks = [
      { val: yMax, label: formatTick(yMax) },
      { val: yStep * 4, label: formatTick(yStep * 4) },
      { val: yStep * 3, label: formatTick(yStep * 3) },
      { val: yStep * 2, label: formatTick(yStep * 2) },
      { val: yStep, label: formatTick(yStep) },
      { val: 0, label: '0' }
    ];

    const svgWidth = 520;
    const svgHeight = 175;
    const padLeft = 46;
    const padRight = 24;
    const padTop = 22;
    const padBottom = 26;
    const chartW = svgWidth - padLeft - padRight;
    const chartH = svgHeight - padTop - padBottom;

    const gridLines = yTicks.map((tick) => {
      const y = padTop + (1 - tick.val / yMax) * chartH;
      return { y, label: tick.label, val: tick.val };
    });

    const coords = points.map((p) => {
      const ratioX = daysInMonth > 1 ? (p.day - 1) / (daysInMonth - 1) : 0.5;
      const x = padLeft + ratioX * chartW;
      const ratioY = Math.min(1, Math.max(0, p.value / yMax));
      const y = padTop + (1 - ratioY) * chartH;
      const dateStr = `${String(p.day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`;
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        day: p.day,
        val: p.value,
        dateStr,
        hasDeposit: p.hasDeposit,
        isToday: p.isToday
      };
    });

    // Genuine Line Chart (Đường gấp khúc chuẩn kết nối giữa các mốc thực tế)
    let pathStr = `M ${coords[0].x},${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      pathStr += ` L ${coords[i].x},${coords[i].y}`;
    }

    const lastCoord = coords[coords.length - 1];
    const areaStr = `${pathStr} L ${lastCoord.x},${padTop + chartH} L ${coords[0].x},${padTop + chartH} Z`;

    // Calendar X-axis reference labels (01, 05, 10, 15, 20, 25, 31)
    const calendarMilestones = [1, 5, 10, 15, 20, 25, daysInMonth];
    const xLabels = calendarMilestones.map((d) => {
      const ratioX = (d - 1) / (daysInMonth - 1);
      const x = padLeft + ratioX * chartW;
      return {
        day: d,
        label: String(d).padStart(2, '0'),
        x: Math.round(x * 10) / 10,
        isHighlighted: isCurrentMonth ? d === currentDay : d === daysInMonth
      };
    });

    const dailyAverage = currentDay > 0 ? Math.round(monthSavingsTotal / currentDay) : 0;
    const streakDays = activeDaysSet.size || (monthSavingsTotal > 0 ? 1 : 0);
    const highestDayStr = `${String(highestDepositDay).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`;
    const highestDayAmt = highestDayAmount > 0 ? highestDayAmount : monthSavingsTotal;

    return {
      monthSavingsTotal,
      dailyAverage,
      highestDayStr,
      highestDayAmount: highestDayAmt,
      streakDays,
      yTicks: gridLines,
      xLabels,
      coords,
      pathStr,
      areaStr,
      lastCoord,
      padLeft,
      padTop,
      chartW,
      chartH,
      svgWidth,
      svgHeight
    };
  }, [selectedMonthVal, jars, totalSaved]);

  // Dynamic Chart Theme Tokens (Adapted for dark, cream, green, light)
  const jarChartTheme = useMemo(() => {
    switch (theme) {
      case 'dark':
        return {
          stroke: '#818CF8',
          gradStart: '#818CF8',
          pointFill: '#12131C',
          pointStroke: '#818CF8',
          activeGlow: '#818CF8',
          grid: 'rgba(255, 255, 255, 0.08)',
          label: '#94A3B8',
          labelHighlight: '#818CF8'
        };
      case 'cream':
        return {
          stroke: '#C0531E',
          gradStart: '#C0531E',
          pointFill: '#FDF8F2',
          pointStroke: '#C0531E',
          activeGlow: '#C0531E',
          grid: 'rgba(140, 117, 100, 0.16)',
          label: '#8C7564',
          labelHighlight: '#C0531E'
        };
      case 'green':
        return {
          stroke: '#059669',
          gradStart: '#059669',
          pointFill: '#FFFFFF',
          pointStroke: '#059669',
          activeGlow: '#059669',
          grid: 'rgba(75, 114, 96, 0.16)',
          label: '#6B9582',
          labelHighlight: '#059669'
        };
      case 'light':
      default:
        return {
          stroke: '#5356F1',
          gradStart: '#5356F1',
          pointFill: '#FFFFFF',
          pointStroke: '#5356F1',
          activeGlow: '#5356F1',
          grid: '#F1F5F9',
          label: '#94A3B8',
          labelHighlight: '#5356F1'
        };
    }
  }, [theme]);

  // ── 3. Multi-rule Smart Suggestions Algorithm ──
  const smartSuggestions = useMemo(() => {
    if (jars.length === 0) {
      return [
        {
          title: 'Khởi đầu tài chính',
          highlight: 'Bắt đầu hành trình tự do tài chính',
          text: 'Tạo hũ tiết kiệm đầu tiên để bắt đầu tích lũy cho những ước mơ và mục tiêu tương lai của bạn.',
          actionText: 'Tạo hũ ngay',
          actionType: 'create',
          jar: null,
          note1Icon: '✨',
          note1Label: 'Mục tiêu rõ ràng',
          note1Desc: 'Xác định số tiền cụ thể giúp tăng 70% khả năng hoàn thành.',
          note2Icon: '🌱',
          note2Label: 'Khởi đầu nhẹ nhàng',
          note2Desc: 'Bắt đầu từ số tiền nhỏ để hình thành thói quen tài chính vững vàng.'
        }
      ];
    }

    const list = [];

    // Rule 1: Zero-balance jar
    const zeroJar = jars.find((j) => (Number(j.current) || 0) === 0 && (Number(j.target) || 0) > 0);
    if (zeroJar) {
      list.push({
        title: 'Khởi động mục tiêu',
        highlight: `Kích hoạt hũ "${zeroJar.name}" ngay hôm nay`,
        text: `Mục tiêu ${formatCurrency(zeroJar.target)} sẽ nhanh chóng thành hình khi bạn nạp những đồng tích lũy đầu tiên!`,
        actionText: `Nạp hũ "${zeroJar.name}"`,
        actionType: 'deposit',
        jar: zeroJar,
        amount: 50000,
        note1Icon: '🌱',
        note1Label: 'Bước khởi đầu',
        note1Desc: 'Nạp những đồng đầu tiên để kích hoạt thói quen tích lũy.',
        note2Icon: '💡',
        note2Label: 'Gợi ý số tiền',
        note2Desc: 'Thử bắt đầu với 50.000 đ - 100.000 đ để tạo đà nhẹ nhàng.'
      });
    }

    // Rule 2: Top progress jar (< 100%)
    const incompleteJars = jars.filter((j) => (Number(j.current) || 0) < (Number(j.target) || 0));
    if (incompleteJars.length > 0) {
      const sortedByProgress = [...incompleteJars].sort((a, b) => {
        const pA = (Number(a.current) || 0) / (Number(a.target) || 1);
        const pB = (Number(b.current) || 0) / (Number(b.target) || 1);
        return pB - pA;
      });
      const topJar = sortedByProgress[0];
      const cur = Number(topJar.current) || 0;
      const tgt = Number(topJar.target) || 1;
      const pct = Math.round((cur / tgt) * 100);
      const remaining = Math.max(0, tgt - cur);
      const nextMilestone = pct < 25 ? 25 : pct < 50 ? 50 : pct < 75 ? 75 : 100;
      const amtToMilestone = Math.max(0, Math.round(tgt * (nextMilestone / 100) - cur));

      list.push({
        title: 'Đẩy nhanh về đích',
        highlight: `"${topJar.name}" đã đạt ${pct}% chỉ tiêu`,
        text: `Chỉ còn thiếu ${formatCurrency(remaining)} nữa! Tích lũy thêm một khoản nhỏ để sớm ăn mừng thành quả nhé.`,
        actionText: `Nạp ngay cho "${topJar.name}"`,
        actionType: 'deposit',
        jar: topJar,
        amount: Math.min(remaining, 200000),
        note1Icon: '🎯',
        note1Label: `Mốc kế tiếp: ${nextMilestone}%`,
        note1Desc: nextMilestone === 100 
          ? `Chỉ cần nạp thêm ${formatCurrency(remaining)} là về đích trọn vẹn!` 
          : `Cần thêm ${formatCurrency(amtToMilestone)} để chạm mốc ${nextMilestone}%.`,
        note2Icon: '⚡',
        note2Label: 'Chiến lược giữ nhịp',
        note2Desc: 'Chia nhỏ nạp đều đặn theo tuần giúp giảm 50% áp lực tài chính.'
      });
    }

    // Rule 3: Pacing with deadline
    const datedJar = jars.find((j) => {
      if (!j.targetDate) return false;
      const diff = new Date(j.targetDate).getTime() - Date.now();
      return diff > 0 && (Number(j.current) || 0) < (Number(j.target) || 0);
    });
    if (datedJar) {
      const remainingAmt = Math.max(0, (Number(datedJar.target) || 0) - (Number(datedJar.current) || 0));
      const diffDays = Math.max(1, Math.ceil((new Date(datedJar.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      const monthsRemaining = Math.max(1, Math.round(diffDays / 30));
      const suggested = Math.min(remainingAmt, Math.max(50000, Math.round(remainingAmt / monthsRemaining)));

      list.push({
        title: 'Kế hoạch định kỳ',
        highlight: `Mục tiêu "${datedJar.name}" cần ~${formatCurrency(suggested)}/tháng`,
        text: `Duy trì đều đặn mức nạp này trong ${monthsRemaining} tháng tới sẽ giúp bạn về đích đúng hẹn mà không bị áp lực.`,
        actionText: `Nạp ${formatCurrency(suggested)}`,
        actionType: 'deposit',
        jar: datedJar,
        amount: suggested,
        note1Icon: '⏱️',
        note1Label: 'Thời gian còn lại',
        note1Desc: `Còn ${monthsRemaining} tháng (${diffDays} ngày) tới ngày hẹn (${formatDate(datedJar.targetDate)}).`,
        note2Icon: '📈',
        note2Label: 'Kỷ luật tài chính',
        note2Desc: `Nạp đúng ${formatCurrency(suggested)}/tháng để đảm bảo 100% về đích đúng hạn.`
      });
    }

    // Rule 4: Balanced Portfolio
    list.push({
      title: 'Tối ưu danh mục',
      highlight: `Bạn đang theo đuổi ${jars.length} mục tiêu tiết kiệm`,
      text: 'Mẹo tài chính: Hãy tập trung đẩy mạnh 1-2 mục tiêu quan trọng trước để tạo đòn bẩy tâm lý thành công vượt trội.',
      actionText: 'Tạo thêm mục tiêu mới',
      actionType: 'create',
      jar: null,
      note1Icon: '⚖️',
      note1Label: 'Quy tắc 50/30/20',
      note1Desc: 'Dành 20% thu nhập hàng tháng cho các mục tiêu tích lũy tương lai.',
      note2Icon: '🛡️',
      note2Label: 'Mẹo phân bổ',
      note2Desc: 'Nên hoàn thành quỹ dự phòng khẩn cấp trước các hũ mua sắm xa xỉ.'
    });

    return list;
  }, [jars]);

  const currentSuggestion = smartSuggestions[recomIndex % smartSuggestions.length] || smartSuggestions[0];

  // ── 4. Progress Overview 3 Cards Data ──
  const progressOverview = useMemo(() => {
    if (jars.length === 0) {
      return { closest: null, onTrack: [], needsAttention: [] };
    }

    // 1. Closest
    const sortedByPercent = [...jars].sort((a, b) => {
      const pA = Number(a.current || 0) / Number(a.target || 1);
      const pB = Number(b.current || 0) / Number(b.target || 1);
      return pB - pA;
    });
    const closest = sortedByPercent[0] || null;

    // 2. Needs Attention & 3. On Track
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const needsAttention = [];
    const onTrack = [];

    jars.forEach((j) => {
      const cur = Number(j.current) || 0;
      const tgt = Number(j.target) || 1;
      const pct = cur / tgt;

      if (cur === 0 && tgt > 0) {
        needsAttention.push({
          jar: j,
          reason: 'Chưa có số dư khởi động',
          missing: tgt
        });
      } else if (j.targetDate) {
        const targetD = new Date(j.targetDate);
        targetD.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((targetD.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (targetD < today && cur < tgt) {
          needsAttention.push({
            jar: j,
            reason: 'Đã quá hạn mục tiêu',
            missing: Math.max(0, tgt - cur)
          });
        } else if (diffDays <= 45 && pct < 0.4) {
          needsAttention.push({
            jar: j,
            reason: `Còn ${diffDays} ngày (${Math.round(pct * 100)}%)`,
            missing: Math.max(0, tgt - cur)
          });
        } else {
          onTrack.push(j);
        }
      } else if (cur > 0) {
        onTrack.push(j);
      }
    });

    return { closest, onTrack, needsAttention };
  }, [jars]);

  // ── 5. Sorted Jars for List Section ──
  const sortedJars = useMemo(() => {
    const list = [...jars];
    switch (sortBy) {
      case 'newest':
        return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      case 'oldest':
        return list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      case 'progress_desc':
        return list.sort((a, b) => {
          const pA = Number(a.current || 0) / Number(a.target || 1);
          const pB = Number(b.current || 0) / Number(b.target || 1);
          return pB - pA;
        });
      case 'deadline_asc':
        return list.sort((a, b) => {
          if (a.targetDate && b.targetDate) return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
          if (a.targetDate) return -1;
          if (b.targetDate) return 1;
          return 0;
        });
      case 'name_asc':
        return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      default:
        return list;
    }
  }, [jars, sortBy]);

  // ── 6. Top 5 Recent Activities Across All Jars ──
  const recentActivities = useMemo(() => {
    const list = [];
    jars.forEach((jar) => {
      const history = Array.isArray(jar.history) ? jar.history : [];
      history.forEach((h) => {
        list.push({
          ...h,
          jarName: jar.name,
          jarCategory: jar.category || 'Mục tiêu chung',
          jarColor: jar.color || '#5356F1'
        });
      });
    });
    return list
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 5);
  }, [jars]);

  // Handlers
  const handleCreateNew = () => {
    setEditingJar(null);
    setIsJarModalOpen(true);
  };

  const handleEdit = (jar) => {
    setEditingJar(jar);
    setIsJarModalOpen(true);
  };

  const handleDeposit = (jar, customAmount = null) => {
    setActiveJar(jar);
    setTxAction('deposit');
    setIsTxModalOpen(true);
  };

  const handleWithdraw = (jar) => {
    setActiveJar(jar);
    setTxAction('withdraw');
    setIsTxModalOpen(true);
  };

  const handleOpenDetail = (jar) => {
    setSelectedDetailJar(jar);
    setIsDetailModalOpen(true);
  };

  const handleDelete = async (jar) => {
    const jarBalance = Number(jar.current || 0);
    const message =
      jarBalance > 0
        ? `Hũ "${jar.name}" hiện đang có ${formatCurrency(jarBalance)}. Nếu xóa hũ, khoản tiền này sẽ không còn được theo dõi trong danh sách hũ tiết kiệm. Bạn có chắc chắn muốn xóa không?`
        : `Bạn có chắc chắn muốn xóa hũ tiết kiệm "${jar.name}" không?`;

    const confirmed = await confirm({
      title: 'Xóa hũ tiết kiệm',
      message,
      confirmText: 'Xóa hũ',
      cancelText: 'Hủy',
      confirmVariant: 'danger'
    });

    if (confirmed) {
      try {
        await deleteJar(jar.id);
        addToast({
          type: 'success',
          message: `Đã xóa hũ "${jar.name}".`,
          duration: 4000
        });
      } catch (err) {
        addToast({
          type: 'error',
          message: err.message || 'Không thể xóa hũ tiết kiệm.',
          duration: 4000
        });
      }
    }
  };

  const handleOpenTips = (topic) => {
    setTipsTopic(topic);
    setIsTipsModalOpen(true);
  };

  return (
    <div className="jars-page-root" role="region" aria-label="Quản lý Hũ chi tiêu và Tiết kiệm">
      {/* ── ERROR STATE BANNER ── */}
      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #EF4444',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#DC2626',
            fontSize: '13px'
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchData}
            style={{
              background: '#EF4444',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* ── SECTION 1: HEADER & OVERVIEW (#jars-section-goals) ── */}
      <section id="jars-section-goals" className="jars-hero-overview-card">
        {/* Header Title Row */}
        <div className="jars-hero-top-row">
          <div className="jars-hero-titles">
            <h1 className="jars-hero-heading">Mục tiêu</h1>
            <p className="jars-hero-subtitle">
              Biến những khoản tiền nhỏ thành những mục tiêu lớn.
            </p>
          </div>

          <button
            type="button"
            className="jars-hero-cta-btn"
            onClick={handleCreateNew}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Tạo hũ mới</span>
          </button>
        </div>

        {/* 4 Metric Cards */}
        <div className="jars-hero-metrics-grid">
          {/* Card 1: Đã tích lũy */}
          <div className="jars-metric-card">
            <div className="jars-metric-top">
              <span className="jars-metric-label">Đã tích lũy</span>
              <div className="jars-metric-icon-box jars-metric-icon-box--blue">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                </svg>
              </div>
            </div>
            <strong className="jars-metric-value">{formatCurrency(totalCurrent)}</strong>
            <span className="jars-metric-trend">
              {trendIsPositive ? '↑' : '↓'} {trendPercent}% so với tháng trước
            </span>
          </div>

          {/* Card 2: Tổng mục tiêu */}
          <div className="jars-metric-card">
            <div className="jars-metric-top">
              <span className="jars-metric-label">Tổng mục tiêu</span>
              <div className="jars-metric-icon-box jars-metric-icon-box--purple">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" x2="4" y1="22" y2="15" />
                </svg>
              </div>
            </div>
            <strong className="jars-metric-value">{formatCurrency(totalTarget)}</strong>
            <span className="jars-metric-trend jars-metric-trend--neutral">
              Mục tiêu cả năm
            </span>
          </div>

          {/* Card 3: Đang thực hiện */}
          <div className="jars-metric-card">
            <div className="jars-metric-top">
              <span className="jars-metric-label">Đang thực hiện</span>
              <div className="jars-metric-icon-box jars-metric-icon-box--orange">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="3" width="14" height="3" rx="1" />
                  <path d="M6 6v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />
                  <circle cx="12" cy="13" r="3" />
                  <path d="M12 11.5v3" />
                </svg>
              </div>
            </div>
            <strong className="jars-metric-value">{activeJarsCount} hũ</strong>
            <span className="jars-metric-trend jars-metric-trend--neutral">
              Hoạt động ổn định
            </span>
          </div>

          {/* Card 4: Tỷ lệ hoàn thành */}
          <div className="jars-metric-card">
            <div className="jars-metric-top">
              <span className="jars-metric-label">Tỷ lệ hoàn thành</span>
              <div className="jars-metric-icon-box jars-metric-icon-box--teal">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                  <path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
              </div>
            </div>
            <strong className="jars-metric-value">{formatPercent(totalPercent)}</strong>
            <div className="jars-metric-mini-track">
              <div
                className="jars-metric-mini-fill"
                style={{ width: `${Math.max(totalPercent > 0 ? 4 : 0, totalPercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="jars-global-progress-banner">
          <div className="jars-global-progress-labels">
            <span>
              Bạn đã hoàn thành <strong>{formatPercent(totalPercent)}</strong> mục tiêu
            </span>
            <span>
              Còn thiếu: <strong>{formatCurrency(totalRemaining)}</strong>
            </span>
          </div>
          <div className="jars-global-progress-track">
            <div
              className="jars-global-progress-fill"
              style={{ width: `${Math.max(totalPercent > 0 ? 3 : 0, totalPercent)}%` }}
            />
          </div>
        </div>
      </section>

      {/* ── SECTIONS 2 & 3: BIỂU ĐỒ & GỢI Ý (2 COLUMNS) ── */}
      <section className="jars-insights-grid">
        {/* Section 2: Tháng này bạn đã tiết kiệm (Financial Analytics Card) */}
        <div className="jars-saving-trend-card">
          {/* Top Bar: Title & Big Amount on Left, Month Picker on Right */}
          <div className="jars-trend-top-bar">
            <div className="jars-trend-header-row">
              <span className="jars-trend-title">Tháng này bạn đã tiết kiệm</span>
              <strong className="jars-trend-amount">+{formatCurrency(detailedChartData.monthSavingsTotal)}</strong>
              <span className="jars-trend-badge">
                <span>{trendIsPositive ? '↑' : '↓'}</span>
                <span>{trendPercent}% so với tháng trước</span>
              </span>
            </div>

            {/* Month Filter Selector */}
            <div className="jars-chart-month-dropdown">
              <div className="jars-chart-month-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5356F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
                <span>
                  {availableMonths.find((m) => m.value === selectedMonthVal)?.label || 'Tháng này'}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <select
                className="jars-chart-month-native-select"
                value={selectedMonthVal}
                onChange={(e) => setSelectedMonthVal(e.target.value)}
                aria-label="Chọn tháng hiển thị biểu đồ"
              >
                {availableMonths.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SVG Chart Canvas with Y-Axis, Gridlines, Curve, Points, Glow & Tooltip */}
          <div className="jars-chart-canvas-wrap">
            <svg
              className="jars-chart-full-svg"
              viewBox={`0 0 ${detailedChartData.svgWidth} ${detailedChartData.svgHeight}`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="financialTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={jarChartTheme.gradStart} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={jarChartTheme.gradStart} stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y-Axis Labels */}
              {detailedChartData.yTicks.map((tick, idx) => (
                <g key={idx}>
                  <line
                    x1={detailedChartData.padLeft}
                    y1={tick.y}
                    x2={detailedChartData.padLeft + detailedChartData.chartW}
                    y2={tick.y}
                    stroke={jarChartTheme.grid}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={detailedChartData.padLeft - 8}
                    y={tick.y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill={jarChartTheme.label}
                    fontFamily="monospace"
                    fontWeight="500"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              {/* Smooth Bézier Gradient Fill */}
              <path d={detailedChartData.areaStr} fill="url(#financialTrendGrad)" />

              {/* Real Data Stroke Line */}
              <path
                d={detailedChartData.pathStr}
                fill="none"
                stroke={jarChartTheme.stroke}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Data Points */}
              {detailedChartData.coords.map((pt, i) => (
                <g key={i}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="3.5"
                    fill={jarChartTheme.pointFill}
                    stroke={jarChartTheme.pointStroke}
                    strokeWidth="2"
                  />
                  {/* Transparent hover hit target */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="12"
                    fill="transparent"
                    cursor="pointer"
                    onMouseEnter={() => setActivePointIndex(i)}
                    onMouseLeave={() => setActivePointIndex(null)}
                  />
                </g>
              ))}

              {/* Active Point Glow Indicator */}
              {(() => {
                const activePt =
                  activePointIndex !== null
                    ? detailedChartData.coords[activePointIndex]
                    : detailedChartData.lastCoord;
                if (!activePt) return null;
                return (
                  <g pointerEvents="none">
                    <circle cx={activePt.x} cy={activePt.y} r="10" fill={jarChartTheme.activeGlow} fillOpacity="0.25" />
                    <circle cx={activePt.x} cy={activePt.y} r="5" fill={jarChartTheme.activeGlow} />
                  </g>
                );
              })()}

              {/* X-Axis Major Labels */}
              {detailedChartData.xLabels.map((lbl, i) => (
                <text
                  key={i}
                  x={lbl.x}
                  y={detailedChartData.svgHeight - 6}
                  textAnchor="middle"
                  fontSize="11.5"
                  fill={lbl.isHighlighted ? jarChartTheme.labelHighlight : jarChartTheme.label}
                  fontWeight={lbl.isHighlighted ? '800' : '500'}
                >
                  {lbl.label}
                </text>
              ))}
            </svg>

            {/* Floating Interactive Tooltip */}
            {(() => {
              const activePt =
                activePointIndex !== null
                  ? detailedChartData.coords[activePointIndex]
                  : detailedChartData.lastCoord;
              if (!activePt) return null;
              const isNearRight = activePt.x > detailedChartData.padLeft + detailedChartData.chartW * 0.78;
              const isNearLeft = activePt.x < detailedChartData.padLeft + detailedChartData.chartW * 0.22;
              const transX = isNearRight ? '-80%' : isNearLeft ? '-20%' : '-50%';
              const arrowLeft = isNearRight ? '80%' : isNearLeft ? '20%' : '50%';
              return (
                <div
                  className="jars-chart-floating-tooltip"
                  style={{
                    left: `${(activePt.x / detailedChartData.svgWidth) * 100}%`,
                    top: `${(activePt.y / detailedChartData.svgHeight) * 100}%`,
                    transform: `translate(${transX}, -100%)`,
                    '--arrow-left': arrowLeft
                  }}
                >
                  <span className="jars-chart-tooltip-date">
                    {activePt.isToday ? `Hôm nay (${activePt.dateStr})` : activePt.dateStr}
                  </span>
                  <strong className="jars-chart-tooltip-amount">{formatCurrency(activePt.val)}</strong>
                </div>
              );
            })()}
          </div>

          {/* Footer Metrics Strip (3 Columns) */}
          <div className="jars-chart-footer-strip">
            <div className="jars-chart-footer-col">
              <div className="jars-chart-footer-icon-box">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </div>
              <div className="jars-chart-footer-text">
                <span>Trung bình mỗi ngày: </span>
                <strong>{formatCurrency(detailedChartData.dailyAverage)}</strong>
              </div>
            </div>

            <div className="jars-chart-footer-divider" />

            <div className="jars-chart-footer-col">
              <div className="jars-chart-footer-text">
                <span>Ngày cao nhất: </span>
                <strong>
                  {detailedChartData.highestDayStr} ({formatCurrency(detailedChartData.highestDayAmount)})
                </strong>
              </div>
            </div>

            <div className="jars-chart-footer-divider" />

            <div className="jars-chart-footer-col">
              <div className="jars-chart-footer-text">
                <span>Chuỗi tiết kiệm: </span>
                <strong>{detailedChartData.streakDays} ngày</strong>
                <span style={{ fontSize: '13px', marginLeft: '3px' }} aria-hidden="true">🔥</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Gợi ý cho bạn (Smart Financial Insights) */}
        <div className="jars-recommendation-card">
          {/* Top Header Row */}
          <div className="jars-recom-header-row">
            <span className="jars-recom-badge">
              <span>💡</span>
              <span>{currentSuggestion.title || 'Gợi ý cho bạn'}</span>
            </span>
            {smartSuggestions.length > 1 && (
              <button
                type="button"
                className="jars-recom-switch-btn"
                onClick={() => setRecomIndex((prev) => prev + 1)}
                title="Xem gợi ý khác"
              >
                <span>Gợi ý khác</span>
                <span>↻</span>
              </button>
            )}
          </div>

          {/* Main Visual & Content Body */}
          <div className="jars-recom-main-body">
            <div className="jars-recom-text-col">
              <div className="jars-recom-highlight">
                {currentSuggestion.highlight}
              </div>

              <p className="jars-recom-text">
                {currentSuggestion.text}
              </p>

              <div className="jars-recom-action-wrap">
                {currentSuggestion.actionType === 'deposit' && currentSuggestion.jar ? (
                  <button
                    type="button"
                    className="jars-recom-action-btn"
                    onClick={() => handleDeposit(currentSuggestion.jar)}
                  >
                    {currentSuggestion.actionText}
                  </button>
                ) : currentSuggestion.actionType === 'create' ? (
                  <button
                    type="button"
                    className="jars-recom-action-btn"
                    onClick={handleCreateNew}
                  >
                    {currentSuggestion.actionText}
                  </button>
                ) : null}
              </div>
            </div>

            {/* 3D Target Vector Art */}
            <div className="jars-recom-art-wrap" aria-hidden="true">
              <svg width="95" height="95" viewBox="0 0 120 120" fill="none">
                <defs>
                  <linearGradient id="outerTgt" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#4F46E5" />
                  </linearGradient>
                  <linearGradient id="midTgt" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="100%" stopColor="#E2E8F0" />
                  </linearGradient>
                  <linearGradient id="bullseye" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#EF4444" />
                    <stop offset="100%" stopColor="#B91C1C" />
                  </linearGradient>
                </defs>
                {/* 3D Shadow */}
                <ellipse cx="60" cy="98" rx="45" ry="14" fill="rgba(15, 23, 42, 0.08)" />
                {/* Outer Ring */}
                <ellipse cx="60" cy="55" rx="48" ry="38" fill="url(#outerTgt)" />
                {/* Ring 2 */}
                <ellipse cx="60" cy="55" rx="36" ry="28" fill="url(#midTgt)" />
                {/* Ring 3 */}
                <ellipse cx="60" cy="55" rx="24" ry="19" fill="url(#outerTgt)" />
                {/* Center Bullseye */}
                <ellipse cx="60" cy="55" rx="14" ry="11" fill="url(#bullseye)" />
                {/* Floating Spheres / Darts */}
                <circle cx="85" cy="28" r="8" fill="#F59E0B" />
                <circle cx="87" cy="26" r="3" fill="#FEF3C7" />
                <circle cx="34" cy="75" r="6" fill="#10B981" />
              </svg>
            </div>
          </div>

          {/* 2 Financial Notes Strip (Matches Section 2's Footer Strip) */}
          <div className="jars-recom-notes-grid">
            <div className="jars-recom-note-item">
              <div className="jars-recom-note-icon-box" aria-hidden="true">
                {currentSuggestion.note1Icon || '🎯'}
              </div>
              <div className="jars-recom-note-content">
                <span className="jars-recom-note-label">{currentSuggestion.note1Label}</span>
                <span className="jars-recom-note-desc">{currentSuggestion.note1Desc}</span>
              </div>
            </div>

            <div className="jars-recom-note-item">
              <div className="jars-recom-note-icon-box" aria-hidden="true">
                {currentSuggestion.note2Icon || '💡'}
              </div>
              <div className="jars-recom-note-content">
                <span className="jars-recom-note-label">{currentSuggestion.note2Label}</span>
                <span className="jars-recom-note-desc">{currentSuggestion.note2Desc}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: TỔNG QUAN TIẾN ĐỘ (#jars-section-progress) ── */}
      <section id="jars-section-progress" className="jars-progress-overview-section">
        <div className="jars-section-header-row">
          <h2 className="jars-section-title">
            <span>🎯</span>
            <span>Tổng quan tiến độ</span>
          </h2>
          <button
            type="button"
            className="jars-section-action-link"
            onClick={() => {
              const el = document.getElementById('jars-section-list');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span>Xem chi tiết</span>
            <span>→</span>
          </button>
        </div>

        <div className="jars-status-cards-grid">
          {/* 1. Gần đạt nhất */}
          <div className="jars-status-card jars-status-card--closest">
            <div className="jars-status-card-header">
              <div className="jars-status-card-header-left">
                <span>🏆</span>
                <span>Gần đạt nhất</span>
              </div>
            </div>
            <div className="jars-status-card-body">
              {progressOverview.closest ? (
                <>
                  <div className="jars-status-jar-row">
                    <span>{progressOverview.closest.name}</span>
                    <span className="jars-status-jar-percent">
                      {formatPercent(
                        Math.round(
                          ((Number(progressOverview.closest.current) || 0) /
                            (Number(progressOverview.closest.target) || 1)) *
                            100
                        )
                      )}
                    </span>
                  </div>
                  <div className="jars-status-track">
                    <div
                      className="jars-status-fill jars-status-fill--closest"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            ((Number(progressOverview.closest.current) || 0) /
                              (Number(progressOverview.closest.target) || 1)) *
                              100
                          )
                        )}%`
                      }}
                    />
                  </div>
                  <span className="jars-status-subtext">
                    Còn{' '}
                    <strong>
                      {formatCurrency(
                        Math.max(
                          0,
                          (Number(progressOverview.closest.target) || 0) -
                            (Number(progressOverview.closest.current) || 0)
                        )
                      )}
                    </strong>{' '}
                    để đạt mục tiêu
                  </span>
                </>
              ) : (
                <span className="jars-status-empty-text">Chưa có mục tiêu nào được tạo.</span>
              )}
            </div>
          </div>

          {/* 2. Đang đúng tiến độ */}
          <div className="jars-status-card jars-status-card--ontrack">
            <div className="jars-status-card-header">
              <div className="jars-status-card-header-left">
                <span>🎯</span>
                <span>Đang đúng tiến độ</span>
              </div>
              {progressOverview.onTrack.length > 0 && (
                <span className="jars-status-tag jars-status-tag--ontrack">
                  {progressOverview.onTrack.length} mục tiêu
                </span>
              )}
            </div>
            <div className="jars-status-card-body">
              {progressOverview.onTrack.length > 0 ? (
                <>
                  <div className="jars-status-jar-row">
                    <span>{progressOverview.onTrack[0].name}</span>
                    <span className="jars-status-jar-percent" style={{ color: '#059669' }}>
                      {formatPercent(
                        Math.round(
                          ((Number(progressOverview.onTrack[0].current) || 0) /
                            (Number(progressOverview.onTrack[0].target) || 1)) *
                            100
                        )
                      )}
                    </span>
                  </div>
                  <div className="jars-status-track">
                    <div
                      className="jars-status-fill jars-status-fill--ontrack"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            ((Number(progressOverview.onTrack[0].current) || 0) /
                              (Number(progressOverview.onTrack[0].target) || 1)) *
                              100
                          )
                        )}%`
                      }}
                    />
                  </div>
                  <span className="jars-status-subtext">
                    Đã tích lũy{' '}
                    <strong>{formatCurrency(Number(progressOverview.onTrack[0].current) || 0)}</strong> / {formatCurrency(Number(progressOverview.onTrack[0].target) || 0)}
                  </span>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="jars-status-tag jars-status-tag--ontrack" style={{ alignSelf: 'flex-start' }}>
                    Đang theo dõi
                  </span>
                  <span className="jars-status-empty-text">
                    Hãy nạp tiền vào các hũ để ghi nhận đà tăng trưởng!
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Cần chú ý */}
          <div className="jars-status-card jars-status-card--attention">
            <div className="jars-status-card-header">
              <div className="jars-status-card-header-left">
                <span>⚠️</span>
                <span>Cần chú ý</span>
              </div>
              {progressOverview.needsAttention.length > 0 && (
                <span className="jars-status-tag jars-status-tag--attention">
                  {progressOverview.needsAttention.length} mục tiêu
                </span>
              )}
            </div>
            <div className="jars-status-card-body">
              {progressOverview.needsAttention.length > 0 ? (
                <>
                  <div className="jars-status-jar-row">
                    <span>{progressOverview.needsAttention[0].jar.name}</span>
                    <span className="jars-status-tag jars-status-tag--attention">
                      {progressOverview.needsAttention[0].reason}
                    </span>
                  </div>
                  <span className="jars-status-subtext" style={{ color: '#B45309' }}>
                    Còn thiếu <strong>{formatCurrency(progressOverview.needsAttention[0].missing)}</strong> để đạt mục tiêu.
                  </span>
                  <button
                    type="button"
                    className="jars-status-action-btn"
                    onClick={() => handleDeposit(progressOverview.needsAttention[0].jar)}
                  >
                    <span>+ Nạp ngay</span>
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="jars-status-tag jars-status-tag--safe" style={{ alignSelf: 'flex-start' }}>
                    ✓ 100% An toàn
                  </span>
                  <span className="jars-status-empty-text" style={{ color: '#059669' }}>
                    Tuyệt vời! Tất cả các hũ đều đang tiến triển tốt, không có hũ nào trễ hạn.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: CÁC HŨ CỦA BẠN (#jars-section-list) ── */}
      <section id="jars-section-list" className="jars-list-section">
        {/* Toolbar Header */}
        <div className="jars-toolbar-row">
          <div className="jars-toolbar-left">
            <h2 className="jars-section-title" style={{ margin: 0 }}>
              Các hũ của bạn
            </h2>
            <span className="jars-count-badge">({jars.length})</span>
          </div>

          <div className="jars-toolbar-right">
            {/* Sort Dropdown */}
            <div className="jars-sort-select-wrap">
              <span>Sắp xếp:</span>
              <select
                className="jars-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="progress_desc">Tiến độ cao nhất</option>
                <option value="deadline_asc">Đến hạn sớm nhất</option>
                <option value="name_asc">Tên A-Z</option>
              </select>
            </div>

            {/* View Mode Grid/List */}
            <div className="jars-view-toggle">
              <button
                type="button"
                className={`jars-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                aria-label="Chế độ lưới"
                title="Chế độ xem lưới"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="7" height="7" x="3" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="14" rx="1" />
                  <rect width="7" height="7" x="3" y="14" rx="1" />
                </svg>
              </button>
              <button
                type="button"
                className={`jars-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                aria-label="Chế độ danh sách"
                title="Chế độ xem danh sách"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* LOADING STATE */}
        {isLoading && jars.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94A3B8' }}>
            <span className="spinner" style={{ width: 28, height: 28, marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: '14px' }}>Đang tải danh sách hũ chi tiêu...</p>
          </div>
        )}

        {/* EMPTY STATE */}
        {!isLoading && jars.length === 0 && (
          <EmptyState
            icon={
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#5356F1" strokeWidth="1.5">
                <path d="M19 11V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v5" />
                <rect width="20" height="9" x="2" y="11" rx="2" />
                <line x1="12" y1="11" x2="12" y2="20" />
              </svg>
            }
            title="Chưa có hũ chi tiêu nào"
            description="Tạo các hũ tiết kiệm như Sức khoẻ, Học tập, Mua xe, Du lịch để phân bổ tài chính thông minh và hoàn thành mục tiêu nhanh hơn."
            actionLabel="+ Tạo hũ tiết kiệm đầu tiên"
            onAction={handleCreateNew}
          />
        )}

        {/* LOADED STATE: GRID VIEW */}
        {!isLoading && jars.length > 0 && viewMode === 'grid' && (
          <div className="jars-grid-container">
            {sortedJars.map((jar) => {
              const currentAmt = Number(jar.current || 0);
              const targetAmt = Number(jar.target || 0);
              const percent = targetAmt > 0 ? Math.min(100, Math.round((currentAmt / targetAmt) * 100)) : 0;
              const remaining = Math.max(0, targetAmt - currentAmt);
              const isCompleted = targetAmt > 0 && currentAmt >= targetAmt;
              const accentColor = jar.color || '#5356F1';

              // Calculate monthly savings suggestion
              let monthlyHintText = 'Đặt ngày đến hạn để nhận gợi ý tích lũy hàng tháng';
              if (jar.targetDate && remaining > 0) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((new Date(jar.targetDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays > 0) {
                  const monthsLeft = Math.max(1, Math.round(diffDays / 30));
                  const perMonth = Math.round(remaining / monthsLeft);
                  monthlyHintText = `Cần khoảng ${formatCurrency(perMonth)} / tháng để đạt mục tiêu đúng hạn`;
                } else {
                  monthlyHintText = 'Đã đến hạn mục tiêu!';
                }
              } else if (isCompleted) {
                monthlyHintText = '🎉 Đã hoàn thành 100% mục tiêu xuất sắc!';
              }

              return (
                <div
                  key={jar.id}
                  className="jar-premium-card"
                  style={{ '--jar-accent-color': accentColor }}
                  onClick={() => handleOpenDetail(jar)}
                >
                  {/* Top Category Tag + Menu */}
                  <div className="jar-card-top-row" onClick={(e) => e.stopPropagation()}>
                    <span
                      className="jar-category-badge"
                      style={{
                        background: `${accentColor}18`,
                        color: accentColor
                      }}
                    >
                      {jar.category || 'MỤC TIÊU'}
                    </span>

                    {/* 3-dots dropdown */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className={`jar-card-menu-btn ${activeMenuJarId === jar.id ? 'is-active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuJarId(activeMenuJarId === jar.id ? null : jar.id);
                        }}
                        aria-label="Tùy chọn hũ"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>

                      {activeMenuJarId === jar.id && (
                        <div className="jar-card-dropdown-menu">
                          <button
                            type="button"
                            className="jar-dropdown-item"
                            onClick={() => {
                              setActiveMenuJarId(null);
                              handleOpenDetail(jar);
                            }}
                          >
                            Xem chi tiết
                          </button>
                          <button
                            type="button"
                            className="jar-dropdown-item"
                            onClick={() => {
                              setActiveMenuJarId(null);
                              handleEdit(jar);
                            }}
                          >
                            Chỉnh sửa
                          </button>
                          <button
                            type="button"
                            className="jar-dropdown-item jar-dropdown-item--danger"
                            onClick={() => {
                              setActiveMenuJarId(null);
                              handleDelete(jar);
                            }}
                          >
                            Xóa hũ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3D Glass Jar Illustration Graphic */}
                  <div className="jar-graphic-center-box">
                    <JarGlassGraphic
                      percent={percent}
                      color={accentColor}
                      icon={jar.icon}
                      width={80}
                      height={96}
                    />
                  </div>

                  {/* Jar Name & Amounts */}
                  <div className="jar-info-section">
                    <h3 className="jar-name-title" title={jar.name}>
                      {jar.name}
                    </h3>
                    <div className="jar-amounts-row">
                      <strong className="jar-current-amount">{formatCurrency(currentAmt)}</strong>
                      <span className="jar-target-amount">/ {formatCurrency(targetAmt)}</span>
                    </div>

                    <div className="jar-progress-track">
                      <div
                        className="jar-progress-fill"
                        style={{
                          width: `${Math.max(percent > 0 ? 3 : 0, percent)}%`,
                          background: isCompleted ? '#10B981' : accentColor
                        }}
                      />
                    </div>
                  </div>

                  {/* 2 Meta Columns: Còn thiếu / Đến hạn */}
                  <div className="jar-meta-cols-row">
                    <span>
                      Còn thiếu: <strong>{formatCurrency(remaining)}</strong>
                    </span>
                    <span>
                      {jar.targetDate ? (
                        <>Đến hạn: <strong>{formatDate(jar.targetDate, 'short')}</strong></>
                      ) : (
                        'Mục tiêu linh hoạt'
                      )}
                    </span>
                  </div>

                  {/* Smart Monthly Target Box */}
                  <div className="jar-smart-hint-box">
                    <span>{monthlyHintText}</span>
                  </div>

                  {/* Footer 3 Action Buttons */}
                  <div className="jar-card-footer-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="jar-btn-deposit"
                      onClick={() => handleDeposit(jar)}
                    >
                      + Nạp tiền
                    </button>

                    <button
                      type="button"
                      className="jar-btn-withdraw"
                      onClick={() => handleWithdraw(jar)}
                      disabled={currentAmt <= 0}
                    >
                      Rút tiền
                    </button>

                    <button
                      type="button"
                      className="jar-btn-detail-icon"
                      onClick={() => handleEdit(jar)}
                      aria-label={`Chỉnh sửa hũ ${jar.name}`}
                      title="Chỉnh sửa hũ"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Card "+ Tạo hũ mới" (Dashed Border) */}
            <div className="jar-card-add-new" onClick={handleCreateNew}>
              <div className="jar-card-add-icon-circle">+</div>
              <h3 className="jar-card-add-title">Tạo hũ mới</h3>
              <p className="jar-card-add-desc">Bắt đầu một mục tiêu mới ngay hôm nay!</p>
            </div>
          </div>
        )}

        {/* LOADED STATE: LIST VIEW */}
        {!isLoading && jars.length > 0 && viewMode === 'list' && (
          <div className="jars-list-mode-container">
            {sortedJars.map((jar) => {
              const currentAmt = Number(jar.current || 0);
              const targetAmt = Number(jar.target || 0);
              const percent = targetAmt > 0 ? Math.min(100, Math.round((currentAmt / targetAmt) * 100)) : 0;
              const remaining = Math.max(0, targetAmt - currentAmt);
              const accentColor = jar.color || '#5356F1';

              return (
                <div
                  key={jar.id}
                  className="jar-list-mode-row"
                  onClick={() => handleOpenDetail(jar)}
                >
                  <div className="jar-list-left">
                    <span style={{ fontSize: '24px' }}>{jar.icon || '🫙'}</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '14px', color: '#0F172A' }}>{jar.name}</strong>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: `${accentColor}18`,
                            color: accentColor
                          }}
                        >
                          {jar.category || 'MỤC TIÊU'}
                        </span>
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                        Còn thiếu: {formatCurrency(remaining)}
                      </span>
                    </div>
                  </div>

                  <div className="jar-list-center">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span><strong>{formatCurrency(currentAmt)}</strong> / {formatCurrency(targetAmt)}</span>
                      <strong style={{ color: accentColor }}>{formatPercent(percent)}</strong>
                    </div>
                    <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '99px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.max(percent > 0 ? 3 : 0, percent)}%`,
                          height: '100%',
                          background: accentColor,
                          borderRadius: '99px'
                        }}
                      />
                    </div>
                  </div>

                  <div className="jar-list-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="jar-btn-deposit"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => handleDeposit(jar)}
                    >
                      + Nạp
                    </button>
                    <button
                      type="button"
                      className="jar-btn-withdraw"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => handleWithdraw(jar)}
                      disabled={currentAmt <= 0}
                    >
                      Rút
                    </button>
                    <button
                      type="button"
                      className="jar-btn-detail-icon"
                      onClick={() => handleEdit(jar)}
                      aria-label={`Chỉnh sửa hũ ${jar.name}`}
                      title="Chỉnh sửa hũ"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Row "+ Tạo hũ mới" (Dashed Border) in List Mode */}
            <div className="jar-list-mode-add-row" onClick={handleCreateNew}>
              <div className="jar-list-mode-add-icon">+</div>
              <div>
                <span className="jar-list-mode-add-title">Tạo hũ mới</span>
                <span className="jar-list-mode-add-desc">— Bắt đầu một mục tiêu mới ngay hôm nay</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── SECTION 6: HOẠT ĐỘNG GẦN ĐÂY (#jars-section-history) ── */}
      <section id="jars-section-history" className="jars-recent-activities-section">
        <div className="jars-section-header-row">
          <h2 className="jars-section-title">
            <span>📜</span>
            <span>Hoạt động gần đây</span>
          </h2>
          <button
            type="button"
            className="jars-section-action-link"
            onClick={() => setIsHistoryModalOpen(true)}
          >
            <span>Xem tất cả</span>
            <span>→</span>
          </button>
        </div>

        <div className="jars-activity-list-card">
          {recentActivities.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              Chưa có hoạt động nạp hoặc rút tiền nào gần đây.
            </div>
          ) : (
            recentActivities.map((act, index) => {
              const isDeposit = act.type === 'deposit';
              return (
                <div key={act.id || index} className="jars-activity-item">
                  <div className="jars-activity-item-left">
                    <div
                      className={`jars-activity-icon-box ${
                        isDeposit ? 'jars-activity-icon-box--deposit' : 'jars-activity-icon-box--withdraw'
                      }`}
                    >
                      {isDeposit ? '+' : '−'}
                    </div>

                    <div className="jars-activity-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          className={`jars-activity-amount-text ${
                            isDeposit
                              ? 'jars-activity-amount-text--deposit'
                              : 'jars-activity-amount-text--withdraw'
                          }`}
                        >
                          {isDeposit ? '+' : '−'}
                          {formatCurrency(act.amount)}
                        </span>
                        <span className="jars-activity-desc-text">
                          {isDeposit ? 'Nạp vào' : 'Rút từ'} "{act.jarName}"
                        </span>
                      </div>
                      <span className="jars-activity-time-text">
                        {act.date ? formatDate(act.date, 'full') : '--'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="jars-section-action-link"
                    style={{ fontSize: '12px' }}
                    onClick={() => setIsHistoryModalOpen(true)}
                  >
                    Chi tiết
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ── SECTION 7: THÔNG TIN HỮU ÍCH ── */}
      <section className="jars-financial-tips-grid">
        {/* Tip 1 */}
        <div className="jars-tip-card" onClick={() => handleOpenTips('smart')} style={{ cursor: 'pointer' }}>
          <div className="jars-tip-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>
          <div className="jars-tip-body">
            <h3 className="jars-tip-title">Tại sao cần có mục tiêu?</h3>
            <p className="jars-tip-desc">
              Có mục tiêu rõ ràng giúp bạn có động lực tiết kiệm và đạt được những điều quan trọng trong cuộc sống.
            </p>
            <button type="button" className="jars-tip-link">
              <span>Tìm hiểu thêm</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Tip 2 */}
        <div className="jars-tip-card" onClick={() => handleOpenTips('50-30-20')} style={{ cursor: 'pointer' }}>
          <div className="jars-tip-icon-box" style={{ background: '#ECFDF5', color: '#10B981' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="jars-tip-body">
            <h3 className="jars-tip-title">Quy tắc 50/30/20</h3>
            <p className="jars-tip-desc">
              50% cho nhu cầu thiết yếu, 30% cho mong muốn cá nhân, 20% cho tiết kiệm và đầu tư.
            </p>
            <button type="button" className="jars-tip-link" style={{ color: '#10B981' }}>
              <span>Xem chi tiết & Tính toán</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── MODALS ── */}
      {isJarModalOpen && (
        <JarModal
          isOpen={isJarModalOpen}
          onClose={() => setIsJarModalOpen(false)}
          jarToEdit={editingJar}
        />
      )}

      {isTxModalOpen && activeJar && (
        <JarTransactionModal
          isOpen={isTxModalOpen}
          onClose={() => {
            setIsTxModalOpen(false);
            setActiveJar(null);
          }}
          jar={activeJar}
          initialAction={txAction}
        />
      )}

      {isDetailModalOpen && selectedDetailJar && (
        <JarDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedDetailJar(null);
          }}
          jar={selectedDetailJar}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          onEdit={handleEdit}
        />
      )}

      {isHistoryModalOpen && (
        <JarHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          jars={jars}
        />
      )}

      {isTipsModalOpen && (
        <FinancialTipsModal
          isOpen={isTipsModalOpen}
          onClose={() => setIsTipsModalOpen(false)}
          initialTopic={tipsTopic}
        />
      )}
    </div>
  );
}
