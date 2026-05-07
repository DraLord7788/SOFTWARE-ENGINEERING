// pages/index/index.js
Page({
  data: {
    score: '',
    stressTags: ['重大变故', '持续性高压', '偶发性中压', '日常琐事'],
    selectedTag: '',
    currentIndexDisplay: '暂无' // 留给界面装X用的指数展示
  },

  onLoad() {
    this.initCanvas();
  },

  // 1. 初始化 Canvas 画布 (交互展示模块 M3)
  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#moodChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return; // 防御性拦截，避免白屏报错
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        this.canvasCtx = ctx;
        this.drawChart(); 
      });
  },

  // 2. 核心大脑：移动平均加权算法 (分析处理模块 M2)
  calculateMoodIndex(historyArray) {
    const weightMap = {
      '重大变故': 1.5, '持续性高压': 1.2,
      '偶发性中压': 1.0, '日常琐事': 0.5
    };
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < historyArray.length; i++) {
      let record = historyArray[i];
      let w = weightMap[record.tag] || 1.0; 
      numerator += record.score * w;
      denominator += w;
    }
    if (denominator === 0) return 0; 
    return (numerator / denominator).toFixed(1);
  },

  // 3. 绘制平滑曲线：展示加权指数 (视觉与逻辑统一)
  drawChart() {
    if (!this.canvasCtx) return;
    const ctx = this.canvasCtx;
    const history = wx.getStorageSync('moodHistory') || [];
    
    ctx.clearRect(0, 0, 300, 200); 
    if (history.length < 2) return; // 数据不够不画线

    ctx.beginPath();
    ctx.strokeStyle = '#07c160'; // 微信绿
    ctx.lineWidth = 3;

    history.forEach((item, index) => {
      const x = (index / (history.length - 1)) * 280 + 10;
      // 注意！这里画的是你存进来的加权指数 weightedIndex，最高 10 分！
      const y = 180 - (item.weightedIndex / 10) * 160; 
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  },

  // 4. 表单输入绑定
  onScoreInput(e) { this.setData({ score: e.detail.value }); },
  onTagChange(e) { this.setData({ selectedTag: this.data.stressTags[e.detail.value] }); },

  // 5. 提交数据与总控 (存储运维模块 M4)
  submitData() {
    const rawScore = this.data.score;
    const currentTag = this.data.selectedTag;
    
    if (!rawScore || !currentTag) {
      wx.showToast({ title: '数据不完整！', icon: 'none' });
      return; 
    }
    const numScore = parseInt(rawScore, 10);
    if (isNaN(numScore) || numScore < 1 || numScore > 10) {
      wx.showToast({ title: '分值须为1-10', icon: 'none' });
      return; 
    }

    let historyData = wx.getStorageSync('moodHistory') || [];
    
    // 预计算！先把当前这条模拟加进去，算出最新的加权指数
    const tempHistory = [...historyData, { score: numScore, tag: currentTag }];
    const currentIndex = parseFloat(this.calculateMoodIndex(tempHistory));

    const finalData = {
      score: numScore,
      tag: currentTag,
      timestamp: new Date().getTime(),
      weightedIndex: currentIndex // 把指数直接死死绑定在每一条记录上！
    };

    historyData.push(finalData);

    // 【保命核心】10MB 空间 LRU 清理策略落地：强行截断，只留最后 20 条！
    if (historyData.length > 20) {
      historyData = historyData.slice(-20);
    }

    wx.setStorageSync('moodHistory', historyData);
    this.setData({ currentIndexDisplay: currentIndex }); // 更新界面文字
    this.drawChart(); // 重绘曲线

    // 梯度预警
    if (currentIndex < 4.0) {
      wx.showModal({
        title: '⚠️ 情绪过载预警',
        content: `指数降至 ${currentIndex}！系统检测到高压堆积，请停止工作！`,
        showCancel: false 
      });
    } else {
      wx.showToast({ title: '记录成功！', icon: 'success' });
    }
  },

  // 6. 撤销机制
  undoLastRecord() {
    let historyData = wx.getStorageSync('moodHistory') || [];
    if (historyData.length === 0) {
      wx.showToast({ title: '暂无记录', icon: 'none' });
      return;
    }
    historyData.pop();
    wx.setStorageSync('moodHistory', historyData);
    
    const newIndex = historyData.length > 0 ? historyData[historyData.length - 1].weightedIndex : '暂无';
    this.setData({ currentIndexDisplay: newIndex });
    
    // 清空画布并重新绘制
    this.canvasCtx.clearRect(0, 0, 300, 200);
    this.drawChart();
    wx.showToast({ title: '撤销成功', icon: 'success' });
  }
});