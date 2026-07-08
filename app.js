(function ($) {
  // ==================== 配置区 ====================
  // 托盘类型选项列表，在此数组中加入选项
  var PALLET_TYPES = [
    { label: '20尺', value: '20' },
    { label: '40尺', value: '40' },
    { label: '鹅盘', value: '鹅盘' },
  ];

  // ==================== 常量 ====================
  var STORAGE_KEY = 'ship_loading_records';
  var MAX_CONTAINERS = 2;
  var PAGE_SIZE = 20;

  // ==================== 缓存 DOM ====================
  var $palletGroup = $('#palletGroup');
  var $containerGroup = $('#containerGroup');
  var $btnAdd = $('#btnAdd');
  var $recordList = $('#recordList');
  var $recordCount = $('#recordCount');
  var $btnExport = $('#btnExport');
  var $btnDeleteHistory = $('#btnDeleteHistory');
  var $toastEl = $('#toast');
  var $toastMsg = $('#toastMsg');

  // ==================== 数据 ====================
  var records = [];
  var displayLimit = PAGE_SIZE;
  var expanded = false;

  // ==================== 初始化 ====================
  function init() {
    loadRecords();
    renderSelectOptions();
    bindEvents();
    renderRecordList();
  }

  function loadRecords() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      records = raw ? JSON.parse(raw) : [];
    } catch (e) {
      records = [];
    }
  }

  function saveRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      showToast('存储空间不足，请清理旧记录');
    }
  }

  function renderSelectOptions() {
    // 渲染托盘类型 radio chips
    renderRadioChips($palletGroup, 'pallet', PALLET_TYPES);
  }

  function renderRadioChips($group, name, options) {
    $group.empty();
    if (options.length === 0) {
      $group.append($('<span class="radio-chip-empty">暂无选项</span>'));
      return;
    }
    $.each(options, function (i, opt) {
      var label, value;
      if (typeof opt === 'object') {
        label = opt.label;
        value = opt.value;
      } else {
        label = opt;
        value = opt;
      }
      var id = 'radio_' + name + '_' + i;
      var $chip = $('<div>').addClass('radio-chip');
      var $input = $('<input>').attr({
        type: 'radio',
        name: name,
        value: value,
        id: id,
      });
      var $label = $('<label>').addClass('radio-chip__label').attr('for', id).text(label);
      $chip.append($input).append($label);
      $group.append($chip);
    });
  }

  // ==================== 事件 ====================
  var $exportModal = $('#exportDateModal');
  var $exportDateList = $('#exportDateList');
  var $btnCancelExport = $('#btnCancelExport');
  var $btnConfirmExport = $('#btnConfirmExport');

  function bindEvents() {
    $btnAdd.on('click', handleAddRecord);
    $btnExport.on('click', handleExport);
    $btnDeleteHistory.on('click', handleDeleteHistory);
    $btnCancelExport.on('click', hideExportModal);
    $btnConfirmExport.on('click', confirmExport);
    $exportModal.on('click', '.weui-mask', hideExportModal);

    // 弹窗日期行点击切换选中
    $exportModal.on('click', '.export-date-item', function () {
      $(this).toggleClass('export-date-item--checked');
      updateConfirmBtnText();
    });

    // 箱号 +/- 按钮事件（事件委托）
    $containerGroup.on('click', '.btn-add-container', function () {
      addContainerInput();
    });
    $containerGroup.on('click', '.btn-remove-container', function () {
      removeContainerInput($(this));
    });

    // 记录列表删除事件（事件委托）
    $recordList.on('click', '.record-card__del', function () {
      var id = $(this).attr('data-id');
      handleDeleteRecord(id);
    });

    // 展开更多按钮
    $recordList.on('click', '.list-expand-btn', function () {
      expandAll();
    });
  }

  // ==================== 箱号输入框操作 ====================
  function getContainerCount() {
    return $containerGroup.find('.container-item').length;
  }

  function createContainerBtn(iconClass, title, text) {
    return $('<span>')
      .addClass('btn-icon ' + iconClass)
      .attr('title', title)
      .text(text);
  }

  function makeContainerItem(index, showPlus) {
    var $item = $('<div>').addClass('container-item');
    var $row = $('<div>').addClass('container-row');

    $row.append(
      $('<input>').addClass('weui-input container-input').attr({
        type: 'text',
        inputmode: 'numeric',
        placeholder: '请输入箱号',
      }),
    );

    var btnClass = showPlus ? 'btn-add-container' : 'btn-remove-container';
    var btnTitle = showPlus ? '添加箱号' : '移除箱号';
    var btnText = showPlus ? '+' : '−';
    $row.append(createContainerBtn(btnClass, btnTitle, btnText));

    $item.append($row);
    return $item;
  }

  function addContainerInput() {
    var count = getContainerCount();
    if (count >= MAX_CONTAINERS) {
      showToast('最多只能添加 ' + MAX_CONTAINERS + ' 个箱号');
      return;
    }

    var newIndex = count + 1;
    var isMax = newIndex === MAX_CONTAINERS;
    var $newItem = makeContainerItem(newIndex, !isMax);
    $containerGroup.append($newItem);

    // 更新之前所有项的按钮：移除旧按钮、根据状态加上新按钮
    refreshContainerButtons();
  }

  function removeContainerInput($targetBtn) {
    var count = getContainerCount();
    if (count <= 1) {
      showToast('至少保留一个箱号输入框');
      return;
    }

    $targetBtn.closest('.container-item').remove();
    refreshContainerLabels();
    refreshContainerButtons();
  }

  function refreshContainerButtons() {
    var $items = $containerGroup.find('.container-item');
    var count = $items.length;

    $items.each(function (index) {
      var $row = $(this).find('.container-row');
      var $oldBtn = $row.find('.btn-add-container, .btn-remove-container');
      $oldBtn.remove();

      if (index === count - 1 && count < MAX_CONTAINERS) {
        // 最后一个，未达上限 → 显示 +
        $row.append(createContainerBtn('btn-add-container', '添加箱号', '+'));
      } else {
        // 已达上限或非最后一个 → 显示 −
        $row.append(createContainerBtn('btn-remove-container', '移除箱号', '−'));
      }
    });
  }

  function refreshContainerLabels() {
    // 不再需要更新 label，箱号 label 已固定为 "箱号"
  }

  function getContainerValues() {
    var values = [];
    $containerGroup.find('.container-input').each(function () {
      var val = $.trim($(this).val());
      if (val) {
        values.push(val);
      }
    });
    return values;
  }

  // ==================== 添加记录 ====================
  function handleAddRecord() {
    var palletType = $palletGroup.find('input[type="radio"]:checked').val() || '';
    var containerNumbers = getContainerValues();

    // 清除所有错误态
    clearErrors();

    // 验证
    var hasError = false;
    if (!palletType) {
      markError($palletGroup);
      hasError = true;
    }
    if (containerNumbers.length === 0) {
      markContainerError($containerGroup);
      hasError = true;
    }

    if (hasError) {
      showToast('请完善必填信息');
      return;
    }

    // 构建记录
    var record = {
      id: String(Date.now()),
      palletType: palletType,
      containerNumbers: containerNumbers,
      recordTime: formatTime(new Date()),
    };

    records.unshift(record);
    saveRecords();

    // 增量更新 DOM
    $recordList.find('.empty-state').remove();
    prependRecordCard(record);

    if (expanded) {
      // 已展开：完整 id 超限则移除
      if ($recordList.find('.record-card').length > records.length) {
        removeRecordCard($recordList.find('.record-card').last().attr('data-id'));
      }
    } else {
      displayLimit = Math.min(displayLimit + 1, records.length);
      // 截断超出部分
      while ($recordList.find('.record-card').length > displayLimit) {
        $recordList.find('.record-card').last().remove();
      }
    }

    updateRecordCount();
    renderExpandBtn();
    resetForm();
    showToast('记录添加成功');
  }

  // ==================== 删除记录 ====================
  function handleDeleteRecord(id) {
    weui.dialog({
      title: '提示',
      content: '确定要删除这条记录吗？',
      buttons: [
        {
          label: '取消',
          type: 'default',
          onClick: function () {},
        },
        {
          label: '删除',
          type: 'primary',
          onClick: function () {
            records = $.grep(records, function (r) {
              return r.id !== id;
            });
            saveRecords();
            removeRecordCard(id);
            if (!expanded) {
              displayLimit = Math.min(displayLimit - 1, records.length);
            }
            updateRecordCount();
            renderExpandBtn();
            showToast('记录已删除');
          },
        },
      ],
    });
  }

  // ==================== 删除历史（按天） ====================
  var deleteMode = false;

  function handleDeleteHistory() {
    if (records.length === 0) {
      showToast('暂无历史记录');
      return;
    }

    deleteMode = true;

    // 按日期分组
    var dateGroups = {};
    $.each(records, function (_, r) {
      var dateKey = extractDate(r.recordTime);
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = [];
      }
      dateGroups[dateKey].push(r);
    });

    var dates = Object.keys(dateGroups).sort().reverse();

    // 渲染弹窗列表（删除模式）
    var html = '';
    $.each(dates, function (_, dateKey) {
      var count = dateGroups[dateKey].length;
      html +=
        '<div class="export-date-item" data-date="' +
        dateKey +
        '">' +
        '<span class="export-date-item__label">' +
        dateKey +
        '</span>' +
        '<span class="export-date-item__count">' +
        count +
        ' 条</span>' +
        '<span class="export-date-item__check"></span>' +
        '</div>';
    });

    $exportDateList.html(html);
    $exportModal.find('.export-date-dialog__hd').text('选择要删除的日期');
    $btnConfirmExport.text('删除').addClass('weui-btn_warn').removeClass('weui-btn_primary').show();
    $exportModal.show();
  }

  // ==================== 导出 JSON ====================
  function handleExport() {
    if (records.length === 0) {
      showToast('暂无记录可导出');
      return;
    }

    // 按日期分组
    var dateGroups = {};
    $.each(records, function (_, r) {
      var dateKey = extractDate(r.recordTime);
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = [];
      }
      dateGroups[dateKey].push(r);
    });

    var dates = Object.keys(dateGroups).sort().reverse();

    // 渲染弹窗列表
    var html = '';
    $.each(dates, function (_, dateKey) {
      var count = dateGroups[dateKey].length;
      html +=
        '<div class="export-date-item" data-date="' +
        dateKey +
        '">' +
        '<span class="export-date-item__label">' +
        dateKey +
        '</span>' +
        '<span class="export-date-item__count">' +
        count +
        ' 条</span>' +
        '<span class="export-date-item__check"></span>' +
        '</div>';
    });

    $exportDateList.html(html);
    $btnConfirmExport.hide();
    $exportModal.find('.export-date-dialog__hd').text('选择导出日期');
    $exportModal.show();
  }

  function hideExportModal() {
    $exportModal.hide();
    deleteMode = false;
    // 恢复弹窗默认标题
    $exportModal.find('.export-date-dialog__hd').text('选择导出日期');
    $btnConfirmExport.removeClass('weui-btn_warn').addClass('weui-btn_primary');
  }

  function updateConfirmBtnText() {
    var count = $exportDateList.find('.export-date-item--checked').length;
    if (count > 0) {
      $btnConfirmExport.text(deleteMode ? '删除' : '导出').show();
    } else {
      if (deleteMode) {
        $btnConfirmExport
          .text('删除')
          .addClass('weui-btn_warn')
          .removeClass('weui-btn_primary')
          .show();
      } else {
        $btnConfirmExport.hide();
      }
    }
  }

  function confirmExport() {
    var checkedDates = [];
    $exportDateList.find('.export-date-item--checked').each(function () {
      checkedDates.push($(this).data('date'));
    });

    if (checkedDates.length === 0) {
      showToast('请至少选择一天');
      return;
    }

    if (deleteMode) {
      // 删除模式
      weui.dialog({
        title: '提示',
        content:
          '确定要删除这 ' +
          checkedDates.length +
          ' 天的数据吗（共 ' +
          checkedDates.reduce(function (acc, d) {
            return (
              acc +
              $.grep(records, function (r) {
                return extractDate(r.recordTime) === d;
              }).length
            );
          }, 0) +
          ' 条）？此操作不可恢复！',
        buttons: [
          {
            label: '取消',
            type: 'default',
            onClick: function () {},
          },
          {
            label: '删除',
            type: 'primary',
            onClick: function () {
              var dateSet = {};
              $.each(checkedDates, function (_, d) {
                dateSet[d] = true;
              });
              records = $.grep(records, function (r) {
                return !dateSet[extractDate(r.recordTime)];
              });
              displayLimit = PAGE_SIZE;
              expanded = false;
              saveRecords();
              renderRecordList();
              updateRecordCount();
              showToast('已删除选中日期的数据');
            },
          },
        ],
      });
      hideExportModal();
      return;
    }

    // 导出模式：按选中日期筛选记录
    var dateSet = {};
    $.each(checkedDates, function (_, d) {
      dateSet[d] = true;
    });
    var filtered = $.grep(records, function (r) {
      return dateSet[extractDate(r.recordTime)] === true;
    });

    // 关闭弹窗并导出
    hideExportModal();

    var exportData = {
      exportTime: formatTime(new Date()),
      filterDates: checkedDates,
      totalCount: filtered.length,
      records: filtered,
    };

    var jsonStr = JSON.stringify(exportData, null, 2);
    var blob = new Blob([jsonStr], { type: 'application/json' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = '船舶配载记录_' + filtered.length + '条_' + formatDate(new Date()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('导出成功（' + filtered.length + ' 条）');
  }

  function extractDate(timeStr) {
    return timeStr.split(' ')[0];
  }

  // ==================== 渲染列表 ====================
  function buildRecordCard(r) {
    var $card = $('<div>').addClass('record-card').attr('data-id', r.id);
    var $body = $('<div>').addClass('record-card__body');

    // 第一行：托盘类型
    $body.append($('<div>').addClass('record-card__row record-card__row--tags').text(r.palletType));

    // 第二行：箱号标签
    var $valueSpan = $('<span>').addClass('record-card__value');
    $.each(r.containerNumbers, function (_, cn) {
      $valueSpan.append($('<span>').addClass('record-card__tag').text(cn));
    });

    $body.append(
      $('<div>')
        .addClass('record-card__row')
        .append($('<span>').addClass('record-card__label').text('箱号'))
        .append($valueSpan),
    );

    // 时间
    $body.append($('<div>').addClass('record-card__time').text(r.recordTime));

    $body.append($('<span>').addClass('record-card__del').attr('data-id', r.id).text('删除'));

    return $card.append($body);
  }

  function renderRecordList() {
    displayLimit = PAGE_SIZE;
    expanded = false;
    $recordCount.text('共 ' + records.length + ' 条');

    if (records.length === 0) {
      $recordList.html(
        '<div class="empty-state">' +
          '<div class="empty-state__icon">📭</div>' +
          '<div class="empty-state__text">暂无记录</div>' +
          '</div>',
      );
      return;
    }

    var $fragment = $(document.createDocumentFragment());
    var limit = Math.min(records.length, PAGE_SIZE);
    for (var i = 0; i < limit; i++) {
      $fragment.append(buildRecordCard(records[i]));
    }

    $recordList.empty().append($fragment);

    renderExpandBtn();
  }

  function prependRecordCard(r) {
    $recordList.find('.empty-state').remove();
    $recordList.prepend(buildRecordCard(r));
  }

  function expandAll() {
    if (expanded) return;
    expanded = true;

    var $fragment = $(document.createDocumentFragment());
    for (var i = PAGE_SIZE; i < records.length; i++) {
      $fragment.append(buildRecordCard(records[i]));
    }
    $recordList.find('.list-expand').remove();
    $recordList.append($fragment);
  }

  function renderExpandBtn() {
    $recordList.find('.list-expand').remove();

    if (expanded || records.length <= PAGE_SIZE) return;

    var remaining = records.length - PAGE_SIZE;
    var $wrap = $('<div>').addClass('list-expand');
    var $btn = $('<span>')
      .addClass('list-expand-btn')
      .text('展开全部（共 ' + remaining + ' 条）');
    $wrap.append($btn);
    $recordList.append($wrap);
  }

  function removeRecordCard(id) {
    $recordList.find('.record-card[data-id="' + id + '"]').remove();
    if ($recordList.find('.record-card').length === 0) {
      showEmptyState();
    }
  }

  function updateRecordCount() {
    $recordCount.text('共 ' + records.length + ' 条');
  }

  function showEmptyState() {
    $recordList.html(
      '<div class="empty-state">' +
        '<div class="empty-state__icon">📭</div>' +
        '<div class="empty-state__text">暂无记录</div>' +
        '</div>',
    );
  }

  // ==================== 重置表单 ====================
  function resetForm() {
    $palletGroup.find('input[type="radio"]').prop('checked', false);

    // 重置箱号输入框为1个
    var $items = $containerGroup.find('.container-item');
    $items.each(function (index) {
      if (index === 0) {
        $(this).find('.container-input').val('');
      } else {
        $(this).remove();
      }
    });

    refreshContainerButtons();
  }

  // ==================== 工具函数 ====================
  function formatTime(date) {
    var y = date.getFullYear();
    var M = pad(date.getMonth() + 1);
    var d = pad(date.getDate());
    var h = pad(date.getHours());
    var m = pad(date.getMinutes());
    var s = pad(date.getSeconds());
    return y + '/' + M + '/' + d + ' ' + h + ':' + m + ':' + s;
  }

  function formatDate(date) {
    var y = date.getFullYear();
    var M = pad(date.getMonth() + 1);
    var d = pad(date.getDate());
    return '' + y + M + d;
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  // ==================== 表单校验辅助 ====================
  function markError($radioGroup) {
    $radioGroup.closest('.form-group').addClass('form-group--error');
    // 用户操作时自动清除错误态
    $radioGroup.one('change', function () {
      $radioGroup.closest('.form-group').removeClass('form-group--error');
    });
  }

  function markContainerError($group) {
    $group.closest('.form-group').addClass('form-group--error');
    $group.find('.container-row').addClass('container-row--error');
    // 用户输入时自动清除错误态
    $group.one('input', '.container-input', function () {
      $group.closest('.form-group').removeClass('form-group--error');
      $group.find('.container-row').removeClass('container-row--error');
    });
  }

  function clearErrors() {
    $('.form-group--error').removeClass('form-group--error');
    $('.container-row--error').removeClass('container-row--error');
  }

  function showToast(msg) {
    $toastMsg.text(msg);
    $toastEl.show();

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      $toastEl.hide();
    }, 1800);
  }

  // ==================== 启动 ====================
  init();
})(jQuery);
