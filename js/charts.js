/**
 * ============================================
 * CHARTS MODULE — Phase 4
 * Dashboard charts (Weekly Progress, Priority
 * Distribution) + full Reports page analytics
 * ============================================
 */
const Charts = (() => {
    const PRIORITY_COLORS = { low: '#22C55E', medium: '#F59E0B', high: '#F97316', urgent: '#EF4444' };

    let weeklyChartInstance = null;
    let priorityChartInstance = null;

    let productivityChartInstance = null;
    let reportPriorityChartInstance = null;
    let completionTrendChartInstance = null;
    let projectProgressChartInstance = null;

    let dashboardInitialized = false;
    let reportsInitialized = false;
    let currentPeriod = 'week'; // 'week' | 'month'

    /* Shared Chart.js defaults to match the design system */
    function applyChartDefaults() {
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#475569';
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.legend.labels.boxWidth = 8;
        Chart.defaults.plugins.legend.labels.boxHeight = 8;
    }

    /* ============================================
       DASHBOARD CHARTS (lazy — first time Dashboard shows)
       ============================================ */
    function onDashboardShow() {
        if (!dashboardInitialized) {
            applyChartDefaults();
            buildDashboardCharts();
            dashboardInitialized = true;
        } else {
            refreshDashboardCharts();
        }
    }

    function buildDashboardCharts() {
        const weeklyCtx = document.getElementById('weeklyChart');
        const priorityCtx = document.getElementById('priorityChart');
        if (!weeklyCtx || !priorityCtx) return;

        destroyExistingChart(weeklyCtx);
        destroyExistingChart(priorityCtx);

        const weekly = getWeeklyCompletionData();
        weeklyChartInstance = new Chart(weeklyCtx, {
            type: 'bar',
            data: {
                labels: weekly.labels,
                datasets: [{
                    label: 'Tasks Completed',
                    data: weekly.counts,
                    backgroundColor: '#2563EB',
                    borderRadius: 6,
                    maxBarThickness: 34
                }]
            },
            options: baseBarOptions()
        });

        const priority = getPriorityDistribution();
        priorityChartInstance = new Chart(priorityCtx, {
            type: 'doughnut',
            data: {
                labels: priority.labels,
                datasets: [{
                    data: priority.counts,
                    backgroundColor: priority.colors,
                    borderWidth: 0
                }]
            },
            options: baseDoughnutOptions()
        });
    }

    function refreshDashboardCharts() {
        if (weeklyChartInstance) {
            const weekly = getWeeklyCompletionData();
            weeklyChartInstance.data.labels = weekly.labels;
            weeklyChartInstance.data.datasets[0].data = weekly.counts;
            weeklyChartInstance.update();
        }
        if (priorityChartInstance) {
            const priority = getPriorityDistribution();
            priorityChartInstance.data.labels = priority.labels;
            priorityChartInstance.data.datasets[0].data = priority.counts;
            priorityChartInstance.update();
        }
    }

    /* ============================================
       REPORTS PAGE (lazy — first time Reports shows)
       ============================================ */
    let repEl = {};

    function onReportsPageShow() {
        cacheReportDom();

        if (!reportsInitialized) {
            applyChartDefaults();
            bindPeriodToggle();
            buildReportCharts();
            reportsInitialized = true;
        } else {
            refreshReportCharts();
        }

        updateReportSummary();
    }

    function cacheReportDom() {
        repEl = {
            periodBtns: document.querySelectorAll('.period-btn'),
            productivityTitle: document.getElementById('reportProductivityTitle'),
            reportCompleted: document.getElementById('reportCompleted'),
            reportPending: document.getElementById('reportPending'),
            reportCompletionRate: document.getElementById('reportCompletionRate'),
            reportAvgTime: document.getElementById('reportAvgTime')
        };
    }

    function bindPeriodToggle() {
        repEl.periodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                repEl.periodBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentPeriod = btn.dataset.period;
                repEl.productivityTitle.textContent = currentPeriod === 'week'
                    ? 'Productivity — Tasks Per Week'
                    : 'Productivity — Tasks Per Month';
                refreshReportCharts();
                updateReportSummary();
            });
        });
    }

    function buildReportCharts() {
        const prodCtx = document.getElementById('productivityChart');
        const prCtx = document.getElementById('reportPriorityChart');
        const trendCtx = document.getElementById('completionTrendChart');
        const projCtx = document.getElementById('projectProgressChart');
        if (!prodCtx) return;

        destroyExistingChart(prodCtx);
        destroyExistingChart(prCtx);
        destroyExistingChart(trendCtx);
        destroyExistingChart(projCtx);

        const prod = getProductivityData(currentPeriod);
        productivityChartInstance = new Chart(prodCtx, {
            type: 'bar',
            data: {
                labels: prod.labels,
                datasets: [{
                    label: 'Tasks Completed',
                    data: prod.counts,
                    backgroundColor: '#2563EB',
                    borderRadius: 6,
                    maxBarThickness: 40
                }]
            },
            options: baseBarOptions()
        });

        const priority = getPriorityDistribution();
        reportPriorityChartInstance = new Chart(prCtx, {
            type: 'doughnut',
            data: {
                labels: priority.labels,
                datasets: [{ data: priority.counts, backgroundColor: priority.colors, borderWidth: 0 }]
            },
            options: baseDoughnutOptions()
        });

        const trend = getCompletionTrend(currentPeriod);
        completionTrendChartInstance = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: trend.labels,
                datasets: [{
                    label: 'Completion Rate %',
                    data: trend.rates,
                    borderColor: '#22C55E',
                    backgroundColor: 'rgba(34,197,94,0.12)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3,
                    pointBackgroundColor: '#22C55E'
                }]
            },
            options: {
                ...baseBarOptions(),
                scales: {
                    ...baseBarOptions().scales,
                    y: { ...baseBarOptions().scales.y, max: 100, ticks: { callback: (v) => v + '%' } }
                }
            }
        });

        const projData = getProjectProgressData();
        projectProgressChartInstance = new Chart(projCtx, {
            type: 'bar',
            data: {
                labels: projData.labels,
                datasets: [{
                    label: 'Completion %',
                    data: projData.percents,
                    backgroundColor: projData.colors,
                    borderRadius: 6,
                    maxBarThickness: 28
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { max: 100, grid: { color: gridColor() }, ticks: { callback: (v) => v + '%' } },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    function refreshReportCharts() {
        if (!productivityChartInstance) { buildReportCharts(); return; }

        const prod = getProductivityData(currentPeriod);
        productivityChartInstance.data.labels = prod.labels;
        productivityChartInstance.data.datasets[0].data = prod.counts;
        productivityChartInstance.update();

        const priority = getPriorityDistribution();
        reportPriorityChartInstance.data.labels = priority.labels;
        reportPriorityChartInstance.data.datasets[0].data = priority.counts;
        reportPriorityChartInstance.update();

        const trend = getCompletionTrend(currentPeriod);
        completionTrendChartInstance.data.labels = trend.labels;
        completionTrendChartInstance.data.datasets[0].data = trend.rates;
        completionTrendChartInstance.update();

        const projData = getProjectProgressData();
        projectProgressChartInstance.data.labels = projData.labels;
        projectProgressChartInstance.data.datasets[0].data = projData.percents;
        projectProgressChartInstance.data.datasets[0].backgroundColor = projData.colors;
        projectProgressChartInstance.update();
    }

    function updateReportSummary() {
        const tasks = Tasks.getAll().filter(t => !t.archived);
        const windowDays = currentPeriod === 'week' ? 7 : 30;
        const windowStart = new Date();
        windowStart.setHours(0, 0, 0, 0);
        windowStart.setDate(windowStart.getDate() - windowDays);

        const completedInWindow = tasks.filter(t =>
            t.status === 'completed' && t.completedAt && new Date(t.completedAt) >= windowStart
        );

        const dueInWindow = tasks.filter(t =>
            t.dueDate && new Date(t.dueDate) >= windowStart
        );

        const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;

        const rateBase = dueInWindow.length;
        const completionRate = rateBase > 0
            ? Math.round((dueInWindow.filter(t => t.status === 'completed').length / rateBase) * 100)
            : (completedInWindow.length > 0 ? 100 : 0);

        repEl.reportCompleted.textContent = completedInWindow.length;
        repEl.reportPending.textContent = pending;
        repEl.reportCompletionRate.textContent = completionRate + '%';
        repEl.reportAvgTime.textContent = getAvgCompletionTime(tasks);
    }

    /* ============================================
       DATA CALCULATIONS
       ============================================ */
    function getWeeklyCompletionData() {
        const labels = [];
        const counts = [];
        const tasks = Tasks.getAll();

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - i);
            const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
            labels.push(dayLabel);

            const count = tasks.filter(t => {
                if (t.status !== 'completed' || !t.completedAt) return false;
                const cd = new Date(t.completedAt);
                return cd.toDateString() === d.toDateString();
            }).length;
            counts.push(count);
        }

        return { labels, counts };
    }

    function getPriorityDistribution() {
        const tasks = Tasks.getAll().filter(t => !t.archived && t.status !== 'completed' && t.status !== 'cancelled');
        const order = ['low', 'medium', 'high', 'urgent'];
        const labels = order.map(p => Tasks.PRIORITY_CONFIG[p].label);
        const counts = order.map(p => tasks.filter(t => t.priority === p).length);
        const colors = order.map(p => PRIORITY_COLORS[p]);
        return { labels, counts, colors };
    }

    function getProductivityData(period) {
        const tasks = Tasks.getAll();
        const labels = [];
        const counts = [];

        if (period === 'week') {
            // Last 8 weeks
            for (let i = 7; i >= 0; i--) {
                const weekEnd = new Date();
                weekEnd.setHours(23, 59, 59, 999);
                weekEnd.setDate(weekEnd.getDate() - (i * 7));
                const weekStart = new Date(weekEnd);
                weekStart.setDate(weekStart.getDate() - 6);
                weekStart.setHours(0, 0, 0, 0);

                labels.push(`${weekStart.getMonth() + 1}/${weekStart.getDate()}`);

                const count = tasks.filter(t => {
                    if (t.status !== 'completed' || !t.completedAt) return false;
                    const cd = new Date(t.completedAt);
                    return cd >= weekStart && cd <= weekEnd;
                }).length;
                counts.push(count);
            }
        } else {
            // Last 6 months
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setDate(1);
                d.setMonth(d.getMonth() - i);
                const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
                labels.push(monthLabel);

                const count = tasks.filter(t => {
                    if (t.status !== 'completed' || !t.completedAt) return false;
                    const cd = new Date(t.completedAt);
                    return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
                }).length;
                counts.push(count);
            }
        }

        return { labels, counts };
    }

    function getCompletionTrend(period) {
        const tasks = Tasks.getAll();
        const labels = [];
        const rates = [];

        const buckets = period === 'week' ? 8 : 6;

        for (let i = buckets - 1; i >= 0; i--) {
            let cutoff;
            let label;
            if (period === 'week') {
                cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - (i * 7));
                label = `${cutoff.getMonth() + 1}/${cutoff.getDate()}`;
            } else {
                cutoff = new Date();
                cutoff.setDate(1);
                cutoff.setMonth(cutoff.getMonth() - i + 1);
                cutoff.setDate(0); // last day of that month
                label = cutoff.toLocaleDateString('en-US', { month: 'short' });
            }
            cutoff.setHours(23, 59, 59, 999);

            const createdByThen = tasks.filter(t => new Date(t.createdAt) <= cutoff);
            const completedByThen = createdByThen.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt) <= cutoff);

            const rate = createdByThen.length > 0 ? Math.round((completedByThen.length / createdByThen.length) * 100) : 0;
            labels.push(label);
            rates.push(rate);
        }

        return { labels, rates };
    }

    function getProjectProgressData() {
        if (typeof Projects === 'undefined') return { labels: [], percents: [], colors: [] };
        const projects = Projects.getAll().filter(p => !p.archived);

        const labels = projects.map(p => p.name);
        const percents = projects.map(p => Projects.getProjectStats(p).completionPct);
        const colors = projects.map(p => p.color || '#2563EB');

        return { labels, percents, colors };
    }

    function getAvgCompletionTime(tasks) {
        const completed = tasks.filter(t => t.status === 'completed' && t.completedAt && t.createdAt);
        if (completed.length === 0) return '—';

        const totalMs = completed.reduce((sum, t) => {
            return sum + (new Date(t.completedAt) - new Date(t.createdAt));
        }, 0);
        const avgMs = totalMs / completed.length;
        const avgHours = avgMs / (1000 * 60 * 60);

        if (avgHours < 1) return Math.round(avgMs / (1000 * 60)) + 'm';
        if (avgHours < 24) return avgHours.toFixed(1) + 'h';
        return (avgHours / 24).toFixed(1) + 'd';
    }

    /* ============================================
       CHART.JS BASE OPTIONS (theme-matched)
       ============================================ */
    /* Safely tear down any Chart.js instance already bound to a canvas
       before creating a new one — guards against double-init edge cases */
    function destroyExistingChart(canvasEl) {
        if (!canvasEl) return;
        const existing = Chart.getChart(canvasEl);
        if (existing) existing.destroy();
    }

    function gridColor() {
        return getComputedStyle(document.documentElement).getPropertyValue('--border-light').trim() || '#F1F5F9';
    }

    function baseBarOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: gridColor() }, ticks: { precision: 0 } }
            }
        };
    }

    function baseDoughnutOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: { legend: { position: 'bottom' } }
        };
    }

    return { onDashboardShow, onReportsPageShow, refreshDashboardCharts, refreshReportCharts };
})();
