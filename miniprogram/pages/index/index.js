function padNumber(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function formatTime(date) {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const hour = padNumber(date.getHours());
  const minute = padNumber(date.getMinutes());
  const second = padNumber(date.getSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getCodeType(scanType) {
  return scanType === 'QR_CODE' ? 'QR_CODE' : 'BAR_CODE';
}

Page({
  data: {
    scanResult: null,
    recentRecords: []
  },

  handleScan: function () {
    wx.scanCode({
      success: (res) => {
        const codeValue = res.result || '';
        const codeType = getCodeType(res.scanType);
        const scanTime = formatTime(new Date());
        const record = {
          id: `${Date.now()}`,
          codeValue,
          codeType,
          scanTime
        };

        this.setData({
          scanResult: record,
          recentRecords: [record].concat(this.data.recentRecords).slice(0, 6)
        });

        wx.showToast({
          title: '扫码成功',
          icon: 'success'
        });
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.indexOf('cancel') > -1) {
          return;
        }

        wx.showToast({
          title: '扫码失败',
          icon: 'none'
        });
      }
    });
  }
});
