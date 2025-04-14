// ==UserScript==
// @name         滚动到底部和顶部
// @namespace    http://tampermonkey.net/
// @version      0.3.0
// @description  实现网页滚动到底部、顶部，处理懒加载内容，支持按钮拖拽，支持忽略当前网站，支持临时关闭当前网站，优化右键菜单
// @match        https://*
// @run-at       document-body
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // 检查是否在iframe中运行
  if (window.self !== window.top) {
    // 在iframe中运行，不执行脚本
    return;
  }

  // 检查当前网站是否在忽略列表中
  const currentHost = window.location.hostname;
  const ignoredSites = JSON.parse(localStorage.getItem('scrollScript_ignoredSites') || '[]');

  // 如果当前网站在忽略列表中，则不执行脚本
  if (ignoredSites.includes(currentHost)) {
    return;
  }

  // 检查页面是否有滚动条
  function hasScrollbar() {
    return document.documentElement.scrollHeight > window.innerHeight;
  }

  // 全局变量，跟踪是否刚刚完成拖拽操作
  let justDragged = false;

  // 全局变量，存储右键菜单和按钮容器
  let contextMenu = null;
  let buttonContainer = null;

  // 创建控制按钮容器
  function createButtonContainer() {
    const container = document.createElement('div');
    container.style.cssText = `
          position: fixed;
          right: 80px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          opacity: 0.7;
          transition: opacity 0.3s;
      `;
    container.addEventListener('mouseover', () => container.style.opacity = '1');
    container.addEventListener('mouseout', () => container.style.opacity = '0.2');
    makeDraggable(container);

    // 添加右键菜单
    container.addEventListener('contextmenu', showContextMenu);

    return container;
  }

  // 创建右键菜单
  function createContextMenu() {
    const menu = document.createElement('div');
    menu.id = 'scroll-context-menu';
    menu.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.15);
      padding: 5px 0;
      z-index: 10000000;
      display: none;
      width: 140px;
      box-sizing: border-box;
      max-width: 140px;
      overflow: hidden;
      font-family: Arial, sans-serif;
      font-size: 14px;
      transition: opacity 0.2s ease;
    `;

    // 创建一个菜单项
    function createMenuItem(text, icon, onClick) {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 4px;
        margin: 2px 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        gap: 5px;
      `;

      // 创建图标元素
      const iconElem = document.createElement('div');
      iconElem.style.cssText = `
        flex-shrink: 0;
        width: 14px;
        height: 14px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 12px;
      `;
      iconElem.textContent = icon;

      // 创建文本元素
      const textElem = document.createElement('div');
      textElem.style.cssText = `
        flex-grow: 1;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      textElem.textContent = text;

      // 组装
      item.appendChild(iconElem);
      item.appendChild(textElem);

      // 添加悬停效果
      item.addEventListener('mouseover', () => {
        item.style.backgroundColor = '#f2f2f2';
      });
      item.addEventListener('mouseout', () => {
        item.style.backgroundColor = 'transparent';
      });

      // 添加点击事件
      item.addEventListener('click', onClick);

      return item;
    }

    // 创建菜单项
    const closeOption = createMenuItem('关闭按钮', '✕', hideScrollButtons);
    const ignoreOption = createMenuItem('忽略此网站', '⛔', ignoreCurrentSite);

    menu.appendChild(closeOption);
    menu.appendChild(ignoreOption);
    document.body.appendChild(menu);

    return menu;
  }

  // 显示右键菜单
  function showContextMenu(e) {
    e.preventDefault();

    if (!contextMenu) {
      contextMenu = createContextMenu();
    }

    // 使用更可靠的方式获取视口宽度和高度
    const viewportWidth = Math.min(
      document.documentElement.clientWidth,
      window.innerWidth || 0
    );
    const viewportHeight = Math.min(
      document.documentElement.clientHeight,
      window.innerHeight || 0
    );

    // 设置固定宽度，防止内容撑开
    contextMenu.style.width = '140px';
    contextMenu.style.visibility = 'hidden';
    contextMenu.style.display = 'block';
    contextMenu.style.left = '0';  // 临时位置，只用于获取高度
    contextMenu.style.top = '0';

    const menuHeight = contextMenu.offsetHeight;

    // 计算最佳位置
    let posX, posY;

    // 水平位置计算 - 优先放在点击位置，如果靠近右边界则显示在左侧
    if (e.clientX + 160 > viewportWidth) { // 增加余量，确保不触发滚动条
      posX = Math.max(e.clientX - 150, 10); // 放在左侧，确保至少有10px边距
    } else {
      posX = e.clientX;
    }

    // 垂直位置计算 - 保持在可视区域内
    if (e.clientY + menuHeight + 20 > viewportHeight) {
      posY = viewportHeight - menuHeight - 20; // 确保底部有20px边距
    } else {
      posY = e.clientY;
    }

    // 设置菜单最终位置并显示
    contextMenu.style.left = posX + 'px';
    contextMenu.style.top = posY + 'px';
    contextMenu.style.visibility = 'visible';

    // 点击其他区域关闭菜单
    const closeMenu = function(e) {
      contextMenu.style.display = 'none';
      document.removeEventListener('click', closeMenu);
    };

    // 延迟添加关闭事件，防止立即触发
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 100);
  }

  // 隐藏滚动按钮
  function hideScrollButtons() {
    if (buttonContainer) {
      buttonContainer.style.display = 'none';
    }
  }

  // 忽略当前网站
  function ignoreCurrentSite() {
    const currentHost = window.location.hostname;
    let ignoredSites = JSON.parse(localStorage.getItem('scrollScript_ignoredSites') || '[]');

    // 添加当前网站到忽略列表
    if (!ignoredSites.includes(currentHost)) {
      ignoredSites.push(currentHost);
      localStorage.setItem('scrollScript_ignoredSites', JSON.stringify(ignoredSites));
    }

    // 隐藏按钮
    hideScrollButtons();
  }

  // 创建控制按钮
  function createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
          width: 70px;
          height: 35px;
          padding: 5px;
          background-color: #4158D0;
          background-image: linear-gradient(43deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%);
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
      `;

    // 使用click事件，但检查是否刚刚进行了拖拽
    button.addEventListener('click', function(e) {
      if (justDragged) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      onClick(e);
    });

    return button;
  }

  // 使元素可拖拽
  function makeDraggable(element) {
    let startX = 0, startY = 0;
    let startPosRight = 0, startPosTop = 0;
    let isDragging = false;
    let dragThreshold = 5; // 拖拽阈值，移动超过这个距离才算拖拽

    // 确保元素有初始位置
    if (!element.style.top) {
      element.style.top = (window.innerHeight - element.offsetHeight - 150) + 'px';
    }

    element.addEventListener('mousedown', dragMouseDown);

    function dragMouseDown(e) {
      // 只在左键点击时处理
      if (e.button !== 0) return;

      e.preventDefault();

      // 记录初始位置
      startX = e.clientX;
      startY = e.clientY;
      startPosRight = parseInt(element.style.right || '0');
      startPosTop = parseInt(element.style.top || '0');

      isDragging = false;
      justDragged = false;

      document.addEventListener('mousemove', elementDrag);
      document.addEventListener('mouseup', closeDragElement);
    }

    function elementDrag(e) {
      e.preventDefault();

      // 计算移动距离
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);

      // 如果移动距离超过阈值，标记为拖拽
      if (!isDragging && (dx > dragThreshold || dy > dragThreshold)) {
        isDragging = true;
      }

      // 直接基于起始位置和当前鼠标位置计算新位置
      // 注意：right值需要反向计算（鼠标向右移动，right值减小）
      if (isDragging) {
        const moveX = e.clientX - startX;
        const moveY = e.clientY - startY;

        element.style.right = (startPosRight - moveX) + 'px';
        element.style.top = (startPosTop + moveY) + 'px';
      }
    }

    function closeDragElement(e) {
      document.removeEventListener('mousemove', elementDrag);
      document.removeEventListener('mouseup', closeDragElement);

      if (isDragging) {
        justDragged = true;

        // 重置justDragged状态，给一个足够的时间窗口防止松开后点击
        setTimeout(() => {
          justDragged = false;
        }, 300);

        // 防止拖拽结束时触发点击
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  // 滚动函数（通用于顶部和底部）
  function smoothScroll(toTop) {
    return new Promise((resolve) => {
      let lastScrollHeight = document.documentElement.scrollHeight;
      let scrollAttempts = 0;
      const maxScrollAttempts = 50; // 最大滚动尝试次数

      function scroll() {
        if (toTop) {
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        } else {
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: 'smooth'
          });
        }
        scrollAttempts++;

        setTimeout(() => {
          const currentScrollHeight = document.documentElement.scrollHeight;
          if (currentScrollHeight !== lastScrollHeight && scrollAttempts < maxScrollAttempts) {
            lastScrollHeight = currentScrollHeight;
            scroll();
          } else {
            resolve();
          }
        }, 500); // 增加等待时间，给平滑滚动和懒加载内容更多时间
      }
      scroll();
    });
  }

  // 滚动到顶部
  function scrollToTop() {
    smoothScroll(true);
  }

  // 滚动到底部
  function scrollToBottom() {
    smoothScroll(false);
  }

  // 监听页面变化，动态检测是否需要显示按钮
  function initScrollButtons() {
    // 如果页面有滚动条，创建按钮
    if (hasScrollbar()) {
      // 创建并添加按钮容器和按钮
      buttonContainer = createButtonContainer();
      const topButton = createButton('↑ 顶部', scrollToTop);
      const bottomButton = createButton('↓ 底部', scrollToBottom);

      buttonContainer.appendChild(topButton);
      buttonContainer.appendChild(bottomButton);
      document.body.appendChild(buttonContainer);
    }
  }

  // DOM加载完成后初始化按钮
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollButtons);
  } else {
    initScrollButtons();
  }

  // 监听窗口大小变化，处理按钮的显示/隐藏
  window.addEventListener('resize', function() {
    if (hasScrollbar()) {
      // 如果有滚动条但没有按钮，创建按钮
      if (!buttonContainer || buttonContainer.style.display === 'none') {
        initScrollButtons();
      }
    } else {
      // 如果没有滚动条但有按钮，隐藏按钮
      if (buttonContainer) {
        hideScrollButtons();
      }
    }
  });
})();
