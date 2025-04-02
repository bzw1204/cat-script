// ==UserScript==
// @name         滚动到底部和顶部
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  实现网页滚动到底部、顶部，处理懒加载内容，支持按钮拖拽
// @match        https://*
// @grant        none
// @author       baizw
// @github       https://github.com/bzw1204/cat-script
// ==/UserScript==

(function () {
  'use strict';

  // 全局变量，跟踪是否刚刚完成拖拽操作
  let justDragged = false;

  // 创建控制按钮容器
  function createButtonContainer() {
    const container = document.createElement('div');
    container.style.cssText = `
          position: fixed;
          right: 80px;
          bottom: 20px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          opacity: 0.7;
          transition: opacity 0.3s;
      `;
    container.addEventListener('mouseover', () => container.style.opacity = '1');
    container.addEventListener('mouseout', () => container.style.opacity = '0.7');
    makeDraggable(container);
    return container;
  }

  // 创建控制按钮
  function createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
          width: 80px;
          height: 40px;
          padding: 10px;
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
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let isDragging = false;
    let dragThreshold = 5; // 拖拽阈值，移动超过这个距离才算拖拽

    element.addEventListener('mousedown', dragMouseDown);

    function dragMouseDown(e) {
      // 只在左键点击时处理，移除对e.target的限制
      if (e.button !== 0) return;

      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      isDragging = false;
      justDragged = false;

      document.addEventListener('mousemove', elementDrag);
      document.addEventListener('mouseup', closeDragElement);
    }

    function elementDrag(e) {
      e.preventDefault();

      // 计算移动距离
      const dx = Math.abs(e.clientX - pos3);
      const dy = Math.abs(e.clientY - pos4);

      // 如果移动距离超过阈值，标记为拖拽
      if (!isDragging && (dx > dragThreshold || dy > dragThreshold)) {
        isDragging = true;
      }

      // 更新位置
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;

      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.right = (parseInt(element.style.right || '0') + pos1) + "px";
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

        // 阻止可能的点击事件
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
          window.scrollTo(0, 0);
        } else {
          window.scrollTo(0, document.documentElement.scrollHeight);
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
        }, 300); // 等待0.3秒，给懒加载内容时间加载
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

  // 创建并添加按钮容器和按钮
  const buttonContainer = createButtonContainer();
  const topButton = createButton('↑ 顶部', scrollToTop);
  const bottomButton = createButton('↓ 底部', scrollToBottom);

  buttonContainer.appendChild(topButton);
  buttonContainer.appendChild(bottomButton);
  document.body.appendChild(buttonContainer);
})();
