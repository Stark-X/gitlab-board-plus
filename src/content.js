// GitLab Board Plus - 内容脚本
console.log('🚀 GitLab Board Plus content script loaded');

// 调试模式检测
const DEBUG_MODE = window.location.search.includes('debug=true') || 
                   localStorage.getItem('gitlab-board-plus-debug') === 'true';

if (DEBUG_MODE) {
  console.log('🔧 Debug mode enabled');
  // 动态加载调试脚本
  const debugScript = document.createElement('script');
  debugScript.src = chrome.runtime.getURL('debug-boards.js');
  debugScript.onload = () => console.log('🛠️ Debug script loaded');
  document.head.appendChild(debugScript);
}

// 快捷过滤管理器类
class FiltersShortcutsManager {
  constructor(container, boardEnhancer) {
    this.container = container;
    this.boardEnhancer = boardEnhancer;
    this.activeFilters = new Set();
    this.filterGroups = [];
    this.currentUser = null;
    this.projectMembers = [];
    this.milestones = [];
    
    this.initializeData();
  }

  // 初始化数据
  async initializeData() {
    try {
      // 获取当前用户信息
      this.currentUser = this.boardEnhancer.getCurrentUser();
      
      // 初始化过滤组配置
      this.initializeFilterGroups();
      
      // 首次渲染基础结构
      this.render();
      
      // 异步加载动态数据
      setTimeout(() => {
        this.loadDynamicData();
      }, 500);
      
    } catch (error) {
      console.error('❌ Error initializing shortcuts data:', error);
      // 即使出错也要渲染基础界面
      this.render();
    }
  }

  // 初始化过滤组配置
  initializeFilterGroups() {
    // 删除顶级选项，使用重置按钮替代
    this.topLevelItems = [];

    // 分组过滤选项
    this.filterGroups = [
      {
        id: 'assignee',
        name: '指派人',
        icon: '👤',
        type: 'multiple',
        loadDynamic: true,
        items: [
          {
            id: 'assigned-to-me',
            name: '我',
            icon: '👤',
            filter: 'assignee:@me',
            active: false,
            isDefault: true
          }
        ]
      },
      {
        id: 'author',
        name: '创建人',
        icon: '✍️',
        type: 'multiple',
        loadDynamic: true,
        items: [
          {
            id: 'created-by-me',
            name: '我',
            icon: '✍️',
            filter: 'author:@me',
            active: false,
            isDefault: true
          }
        ]
      },
      {
        id: 'milestone',
        name: '里程碑',
        icon: '🎯',
        type: 'multiple',
        loadDynamic: true,
        items: []
      },
      {
        id: 'label',
        name: '标签',
        icon: '🏷️',
        type: 'multiple',
        loadDynamic: true,
        items: []
      }
    ];
  }

  // 加载动态数据
  async loadDynamicData() {
    try {
      // 并行加载各种数据
      await Promise.all([
        this.loadProjectMembers(),
        this.loadMilestones(),
        this.loadLabels()
      ]);
      
      // 数据加载完成后重新渲染
      this.render();
      
    } catch (error) {
      console.error('❌ Error loading dynamic data:', error);
    }
  }

  // 加载项目成员
  async loadProjectMembers() {
    try {
      // 从页面中提取成员信息
      const members = await this.extractMembersFromPage();
      
      // 更新指派人和创建人组
      const assigneeGroup = this.filterGroups.find(g => g.id === 'assignee');
      const authorGroup = this.filterGroups.find(g => g.id === 'author');
      
      if (assigneeGroup && members.length > 0) {
        // 添加其他成员到指派人组（除了默认的"我"）
        members.forEach(member => {
          if (member.username !== this.currentUser?.username) {
            assigneeGroup.items.push({
              id: `assignee-${member.username}`,
              name: member.name || member.username,
              icon: '👤',
              filter: `assignee:@${member.username}`,
              active: false,
              userData: member
            });
          }
        });
      }
      
      if (authorGroup && members.length > 0) {
        // 添加其他成员到创建人组（除了默认的"我"）
        members.forEach(member => {
          if (member.username !== this.currentUser?.username) {
            authorGroup.items.push({
              id: `author-${member.username}`,
              name: member.name || member.username,
              icon: '✍️',
              filter: `author:@${member.username}`,
              active: false,
              userData: member
            });
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Error loading project members:', error);
    }
  }

  // 从页面提取成员信息
  async extractMembersFromPage() {
    try {
      // 使用Map来存储成员信息，避免Set无法正确去重对象的问题
      const membersMap = new Map();
      
      // 方法1: 从已有的issue卡片中提取指派人信息
      const assigneeElements = document.querySelectorAll('[data-testid="assignee-avatar"], .board-card-assignee img, .assignee-avatar img');
      assigneeElements.forEach(el => {
        const username = el.getAttribute('data-username') || 
                        el.getAttribute('data-user-id') ||
                        el.getAttribute('alt')?.match(/@(\w+)/)?.[1];
        const name = el.getAttribute('alt') || el.getAttribute('title');
        if (username && !membersMap.has(username)) {
          membersMap.set(username, { username, name: name || username });
        }
      });
      
      // 方法2: 从用户头像和链接中提取
      const userLinks = document.querySelectorAll('a[href*="/users/"], a[href*="/-/user/"]');
      userLinks.forEach(link => {
        const href = link.getAttribute('href');
        const match = href.match(/\/users\/([^\/\?]+)/);
        if (match) {
          const username = match[1];
          const name = link.textContent.trim() || link.getAttribute('title');
          if (!membersMap.has(username)) {
            membersMap.set(username, { username, name: name || username });
          }
        }
      });
      
      // 方法3: 从GitLab的assignee dropdown中提取（如果存在）
      const assigneeOptions = document.querySelectorAll('[data-testid="assignee-dropdown"] .gl-dropdown-item, .assignee-dropdown .dropdown-item');
      assigneeOptions.forEach(option => {
        const username = option.getAttribute('data-username') || 
                        option.querySelector('[data-username]')?.getAttribute('data-username');
        const name = option.textContent.trim();
        if (username && !membersMap.has(username)) {
          membersMap.set(username, { username, name: name || username });
        }
      });
      
      const members = Array.from(membersMap.values());
      console.log(`✅ Extracted ${members.length} members from page:`, members);
      
      return members;
      
    } catch (error) {
      console.error('❌ Error extracting members from page:', error);
      return [];
    }
  }

  // 加载里程碑
  async loadMilestones() {
    try {
      const milestones = await this.extractMilestonesFromPage();
      
      const milestoneGroup = this.filterGroups.find(g => g.id === 'milestone');
      if (milestoneGroup && milestones.length > 0) {
        milestoneGroup.items = milestones.map(milestone => ({
          id: `milestone-${milestone.id}`,
          name: milestone.title,
          icon: '🎯',
          filter: `milestone:"${milestone.title}"`,
          active: false,
          milestoneData: milestone
        }));
      }
      
    } catch (error) {
      console.error('❌ Error loading milestones:', error);
    }
  }

  // 从页面提取里程碑信息
  async extractMilestonesFromPage() {
    try {
      const milestones = new Set();
      
      // 从issue卡片中提取里程碑信息
      const milestoneElements = document.querySelectorAll('[data-testid="milestone-title"], .milestone-title');
      milestoneElements.forEach(el => {
        const title = el.textContent.trim();
        if (title) {
          milestones.add({ id: title, title });
        }
      });
      
      return Array.from(milestones);
      
    } catch (error) {
      console.error('❌ Error extracting milestones from page:', error);
      return [];
    }
  }

  // 加载标签
  async loadLabels() {
    try {
      const labels = await this.extractLabelsFromPage();
      
      const labelGroup = this.filterGroups.find(g => g.id === 'label');
      if (labelGroup && labels.length > 0) {
        labelGroup.items = labels.map(label => ({
          id: `label-${label.name}`,
          name: label.name,
          icon: '🏷️',
          filter: `label:"${label.name}"`,
          active: false,
          labelData: label,
          style: label.color ? `background-color: ${label.color}` : ''
        }));
      }
      
    } catch (error) {
      console.error('❌ Error loading labels:', error);
    }
  }

  // 从页面提取标签信息
  async extractLabelsFromPage() {
    try {
      const labels = new Set();
      
      // 从issue卡片中提取标签信息
      const labelElements = document.querySelectorAll('.label, [data-testid="label"]');
      labelElements.forEach(el => {
        const name = el.textContent.trim();
        const color = el.style.backgroundColor || el.getAttribute('data-color');
        if (name) {
          labels.add({ name, color });
        }
      });
      
      return Array.from(labels);
      
    } catch (error) {
      console.error('❌ Error extracting labels from page:', error);
      return [];
    }
  }

  // 渲染快捷过滤界面
  render() {
    const shortcutsContent = `
      <div class="shortcuts-content">
        ${this.renderTopLevelItems()}
        ${this.renderFilterGroups()}
      </div>
    `;
    
    this.container.innerHTML = shortcutsContent;
    
    // 添加搜索功能
    this.addSearchFunction();
    
    // 绑定事件
    this.bindEvents();
    
    // 恢复分组折叠状态
    this.restoreGroupCollapsedStates();
    
    // 设置激活状态
    this.setActiveFiltersFromUrl();
  }

  // 渲染顶级过滤选项
  renderTopLevelItems() {
    if (!this.topLevelItems || this.topLevelItems.length === 0) {
      return '';
    }
    
    return `
      <div class="top-level-items">
        ${this.topLevelItems.map(item => this.renderFilterItem(item, item.type)).join('')}
      </div>
    `;
  }

  // 渲染过滤组
  renderFilterGroups() {
    return this.filterGroups.map(group => this.renderFilterGroup(group)).join('');
  }

  // 渲染单个过滤组
  renderFilterGroup(group) {
    return `
      <div class="filter-group" data-group-id="${group.id}">
        <div class="filter-group-header">
          <span class="group-icon">${group.icon}</span>
          <span class="group-name">${group.name}</span>
          ${group.loadDynamic ? '<span class="group-loading">⟳</span>' : ''}
        </div>
        <div class="filter-group-items">
          ${group.items.map(item => this.renderFilterItem(item, group.type)).join('')}
        </div>
      </div>
    `;
  }

  // 渲染单个过滤项
  renderFilterItem(item, groupType) {
    const activeClass = item.active ? 'active' : '';
    
    return `
      <div class="filter-item ${activeClass}" 
           data-item-id="${item.id}" 
           data-filter="${item.filter}"
           data-group-type="${groupType}">
        <input type="checkbox" ${item.active ? 'checked' : ''} title="多选模式：勾选此项可与其他选项组合使用" />
        <div class="item-content" title="单选模式：点击此处清除其他所有过滤器，只应用此条件">
          <span class="item-icon">${item.icon}</span>
          <span class="item-name">${item.name}</span>
        </div>
      </div>
    `;
  }

  // 绑定事件
  bindEvents() {
    // 单选模式：点击按钮内容区域
    const itemContents = this.container.querySelectorAll('.item-content');
    itemContents.forEach(content => {
      content.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = content.closest('.filter-item');
        this.handleFilterItemSingleClick(item, e);
      });
    });

    // 多选模式：点击checkbox
    const checkboxes = this.container.querySelectorAll('.filter-item input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('click', (e) => {
        // 阻止事件冒泡到父元素
        e.stopPropagation();
        const item = checkbox.closest('.filter-item');
        this.handleFilterItemCheckboxClick(item, checkbox, e);
      });
    });

    // 重置按钮事件（现在在搜索区域）
    const resetBtn = this.container.querySelector('.shortcuts-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleResetFilters();
      });
    }

    // 分组折叠/展开事件
    const groupHeaders = this.container.querySelectorAll('.filter-group-header');
    groupHeaders.forEach(header => {
      header.addEventListener('click', (e) => {
        // 如果点击的是加载图标，不处理折叠/展开
        if (e.target.classList.contains('group-loading')) {
          return;
        }
        this.handleGroupToggle(header);
      });
    });
  }

  // 处理过滤项单选点击（点击按钮文字/图标区域）
  handleFilterItemSingleClick(item, event) {
    const itemId = item.getAttribute('data-item-id');
    const filter = item.getAttribute('data-filter');
    
    // 所有直接点击都是单选模式：清除所有选项，激活当前选项
    this.handleSingleSelection(item, itemId, filter);
    
    // 应用过滤
    this.applyCurrentFilters();
  }

  // 处理checkbox点击（多选模式）
  handleFilterItemCheckboxClick(item, checkbox, event) {
    const itemId = item.getAttribute('data-item-id');
    const filter = item.getAttribute('data-filter');
    
    // 多选模式：切换当前选项状态
    this.handleMultipleSelection(item, itemId, filter);
    
    // 应用过滤
    this.applyCurrentFilters();
  }

  // 处理单选
  handleSingleSelection(item, itemId, filter) {
    // 清除所有激活状态
    this.clearAllActiveStates();
    
    // 激活当前项
    item.classList.add('active');
    
    // 勾选当前项的checkbox
    const checkbox = item.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = true;
    }
    
    // 更新活跃过滤器集合
    this.activeFilters.clear();
    if (filter) {
      this.activeFilters.add(filter);
    }
  }

  // 处理多选
  handleMultipleSelection(item, itemId, filter) {
    const checkbox = item.querySelector('input[type="checkbox"]');
    const isActive = item.classList.contains('active');
    
    if (isActive) {
      // 取消激活
      item.classList.remove('active');
      if (checkbox) checkbox.checked = false;
      this.activeFilters.delete(filter);
    } else {
      // 激活当前项
      item.classList.add('active');
      if (checkbox) checkbox.checked = true;
      if (filter) {
        this.activeFilters.add(filter);
      }
    }
  }

  // 清除所有激活状态
  clearAllActiveStates() {
    // 清除顶级选项和分组选项的激活状态
    const activeItems = this.container.querySelectorAll('.filter-item.active');
    activeItems.forEach(item => {
      item.classList.remove('active');
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = false;
    });
  }

  // 应用当前过滤器
  applyCurrentFilters() {
    const filterQuery = Array.from(this.activeFilters).join(' ');
    console.log('🔍 Applying filters:', filterQuery);
    
    // 通过URL参数或搜索框应用过滤
    this.boardEnhancer.applySearchFilter(
      this.boardEnhancer.getSearchInput(),
      filterQuery
    );
  }

  // 根据URL设置激活状态
  setActiveFiltersFromUrl() {
    try {
      const url = new URL(window.location.href);
      const assignee = url.searchParams.get('assignee_username');
      const author = url.searchParams.get('author_username');
      const milestone = url.searchParams.get('milestone_title');
      const labels = url.searchParams.getAll('label_name');
      
      // 重置状态
      this.clearAllActiveStates();
      this.activeFilters.clear();
      
      // 根据URL参数设置激活状态
      let hasActiveFilters = false;
      
      if (assignee) {
        this.activateFilterByValue('assignee', assignee);
        hasActiveFilters = true;
      }
      
      if (author) {
        this.activateFilterByValue('author', author);
        hasActiveFilters = true;
      }
      
      if (milestone) {
        this.activateFilterByValue('milestone', milestone);
        hasActiveFilters = true;
      }
      
      labels.forEach(label => {
        this.activateFilterByValue('label', label);
        hasActiveFilters = true;
      });
      
      // 如果没有任何激活的过滤器，激活默认的"全部"
      if (!hasActiveFilters) {
        this.activateDefaultFilter();
      }
      
    } catch (error) {
      console.error('❌ Error setting active filters from URL:', error);
      this.activateDefaultFilter();
    }
  }

  // 根据值激活过滤器
  activateFilterByValue(type, value) {
    const items = this.container.querySelectorAll(`.filter-item[data-filter*="${type}:"]`);
    items.forEach(item => {
      const filter = item.getAttribute('data-filter');
      if (filter.includes(value)) {
        item.classList.add('active');
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = true;
        this.activeFilters.add(filter);
      }
    });
  }

  // 处理重置过滤器
  handleResetFilters() {
    console.log('🔄 Resetting all filters');
    
    // 清除所有激活状态
    this.clearAllActiveStates();
    
    // 清空过滤器集合
    this.activeFilters.clear();
    
    // 应用空过滤器（显示所有内容）
    this.applyCurrentFilters();
    
    // 添加重置动画效果
    const resetBtn = this.container.querySelector('.shortcuts-reset-btn');
    if (resetBtn) {
      resetBtn.classList.add('resetting');
      setTimeout(() => {
        resetBtn.classList.remove('resetting');
      }, 600);
    }
  }

  // 激活默认过滤器（在取消所有多选项时调用）
  activateDefaultFilter() {
    // 由于删除了"全部"选项，这里不需要激活任何选项
    // 只是确保所有过滤器都被清除
    this.activeFilters.clear();
  }

  // 处理分组折叠/展开
  handleGroupToggle(header) {
    const group = header.closest('.filter-group');
    if (group) {
      group.classList.toggle('collapsed');
      
      // 保存折叠状态到本地存储
      const groupId = group.getAttribute('data-group-id');
      const isCollapsed = group.classList.contains('collapsed');
      this.saveGroupCollapsedState(groupId, isCollapsed);
    }
  }

  // 保存分组折叠状态
  saveGroupCollapsedState(groupId, isCollapsed) {
    try {
      const key = 'gitlab-board-plus-group-collapsed-states';
      const states = JSON.parse(localStorage.getItem(key) || '{}');
      states[groupId] = isCollapsed;
      localStorage.setItem(key, JSON.stringify(states));
    } catch (error) {
      console.error('❌ Error saving group collapsed state:', error);
    }
  }

  // 恢复分组折叠状态
  restoreGroupCollapsedStates() {
    try {
      const key = 'gitlab-board-plus-group-collapsed-states';
      const states = JSON.parse(localStorage.getItem(key) || '{}');
      
      Object.entries(states).forEach(([groupId, isCollapsed]) => {
        if (isCollapsed) {
          const group = this.container.querySelector(`[data-group-id="${groupId}"]`);
          if (group) {
            group.classList.add('collapsed');
          }
        }
      });
    } catch (error) {
      console.error('❌ Error restoring group collapsed states:', error);
    }
  }

  // 添加搜索功能
  addSearchFunction() {
    const searchContainer = document.createElement('div');
    searchContainer.className = 'shortcuts-search';
    searchContainer.innerHTML = `
      <div class="search-row">
        <input type="text" 
               placeholder="搜索过滤选项..." 
               class="shortcuts-search-input" />
      </div>
      <div class="reset-row">
        <button class="shortcuts-reset-btn" title="清除所有过滤条件">
          <span class="reset-icon">🔄</span>
          <span class="reset-text">清除重置</span>
        </button>
      </div>
    `;
    
    // 插入到内容区域最前面
    const content = this.container.querySelector('.shortcuts-content');
    if (content) {
      content.insertAdjacentElement('afterbegin', searchContainer);
      
      // 绑定搜索事件
      const searchInput = searchContainer.querySelector('.shortcuts-search-input');
      searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
    }
  }

  // 处理搜索
  handleSearch(query) {
    const normalizedQuery = query.toLowerCase().trim();
    
    // 搜索顶级选项
    if (this.topLevelItems) {
      this.topLevelItems.forEach(item => {
        const itemElement = this.container.querySelector(`[data-item-id="${item.id}"]`);
        if (!itemElement) return;
        
        const isVisible = normalizedQuery === '' || 
                         item.name.toLowerCase().includes(normalizedQuery) ||
                         item.filter.toLowerCase().includes(normalizedQuery);
        
        itemElement.style.display = isVisible ? 'flex' : 'none';
      });
    }
    
    // 搜索分组选项
    this.filterGroups.forEach(group => {
      const groupElement = this.container.querySelector(`[data-group-id="${group.id}"]`);
      if (!groupElement) return;
      
      let hasVisibleItems = false;
      
      group.items.forEach(item => {
        const itemElement = groupElement.querySelector(`[data-item-id="${item.id}"]`);
        if (!itemElement) return;
        
        const isVisible = normalizedQuery === '' || 
                         item.name.toLowerCase().includes(normalizedQuery) ||
                         item.filter.toLowerCase().includes(normalizedQuery);
        
        itemElement.style.display = isVisible ? 'flex' : 'none';
        if (isVisible) hasVisibleItems = true;
      });
      
      // 隐藏没有可见项的分组
      groupElement.style.display = hasVisibleItems ? 'flex' : 'none';
    });
  }


}

class GitLabBoardEnhancer {
  constructor() {
    this.currentUrl = window.location.href;
    this.projectId = this.extractProjectId();
    
    // 标记脚本已注入
    window.gitlabBoardPlusInjected = true;
    
    // 只在 GitLab 页面初始化
    if (this.isGitLabPage()) {
      this.init();
    }
  }

  // 检查是否是 GitLab 页面
  isGitLabPage() {
    // 检查页面是否包含 GitLab 的特征元素或路径
    const hasGitLabPath = window.location.pathname.includes('/-/');
    const hasGitLabElements = document.querySelector('.navbar-gitlab') || 
                             document.querySelector('[data-qa-selector="gitlab_logo"]') ||
                             document.querySelector('.header-logo') ||
                             document.querySelector('.tanuki-logo') ||
                             document.querySelector('.gitlab-logo') ||
                             document.body.classList.contains('ui_indigo') ||
                             document.title.toLowerCase().includes('gitlab');
    
    // 检查页面 HTML 中是否包含 GitLab 相关的 meta 标签或脚本
    const hasGitLabMeta = document.querySelector('meta[content*="GitLab"]') ||
                         document.querySelector('script[src*="gitlab"]') ||
                         document.querySelector('link[href*="gitlab"]');
    
    const result = hasGitLabPath || hasGitLabElements || hasGitLabMeta;
    
    if (result) {
      console.log('检测到 GitLab 页面:', {
        url: window.location.href,
        hasGitLabPath,
        hasGitLabElements: !!hasGitLabElements,
        hasGitLabMeta: !!hasGitLabMeta
      });
    }
    
    return result;
  }

  // 初始化增强功能
  init() {
    console.log('GitLab Board Plus 内容脚本已加载');
    
    // 等待页面加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.enhance();
      });
    } else {
      this.enhance();
    }

    // 监听页面变化（GitLab 是 SPA）
    this.observePageChanges();
  }

  // 提取项目 ID
  extractProjectId() {
    const match = window.location.pathname.match(/^\/([^\/]+\/[^\/]+)/);
    return match ? match[1] : null;
  }

  // 检测当前页面类型
  detectPageType() {
    const path = window.location.pathname;
    
    if (path.includes('/-/boards')) {
      return 'board';
    // } else if (path.includes('/-/issues')) {
    //   return 'issues';
    // } else if (path.includes('/merge_requests')) {
    //   return 'merge_requests';
    // } else if (path.includes('/-/milestones')) {
    //   return 'milestones';
    }
    
    return 'other';
  }

  // 应用增强功能
  enhance() {
    const pageType = this.detectPageType();

    switch (pageType) {
      case 'board':
        this.enhanceBoard();
        break;
      case 'issues':
        this.enhanceIssues();
        break;
      case 'merge_requests':
        this.enhanceMergeRequests();
        break;
      default:
        this.enhanceGeneral();
    }
  }

  // 增强 Board 页面
  enhanceBoard() {
    console.log('增强 Board 页面功能');
    
    // 重新组织整个 boards-app 结构
    this.restructureBoardsApp();
  }

  // 重新组织 boards-app 结构
  restructureBoardsApp() {
    const boardsApp = document.querySelector('.boards-app');
    if (!boardsApp) {
      console.warn('Boards app not found');
      return;
    }

    // 检查是否已经处理过
    if (boardsApp.classList.contains('gitlab-board-plus-restructured')) {
      console.log('Boards app already restructured');
      return;
    }

    console.log('Starting boards app restructuring...');

    try {
      // 创建新的结构
      const newStructure = this.createNewBoardStructure();
      
      // 将原有内容移动到新结构中
      this.moveExistingContent(boardsApp, newStructure);
      
      // 创建快捷过滤模块
      const filtersShortcuts = newStructure.querySelector('.issues-filters-shortcuts');
      if (filtersShortcuts) {
        this.createFiltersShortcuts(filtersShortcuts);
      }
      
      // 将新结构插入到页面中
      boardsApp.innerHTML = '';
      boardsApp.appendChild(newStructure);
      
      // 标记已完成重构
      boardsApp.classList.add('gitlab-board-plus-restructured');

      console.log('✅ Board restructuring completed');
      
      // 创建 board tabs - 延迟一点确保 DOM 更新完成
      setTimeout(() => {
        this.createBoardTabsAfterRestructure();
      }, 100);
      
    } catch (error) {
      console.error('❌ Error during board restructuring:', error);
    }
  }

  // 创建新的 board 结构
  createNewBoardStructure() {
    // 按照期望布局：boards-tabs 容器 > (顶部: tabs UI, 下方: 左右布局)
    const boardsTabs = document.createElement('div');
    boardsTabs.setAttribute('data-testid', 'boards-tabs');
    boardsTabs.className = 'boards-tabs-container';
    
    // 顶部：真正的 tabs UI 容器
    const tabsWrapper = document.createElement('div');
    tabsWrapper.className = 'boards-tabs-wrapper';
    
    // 下方：左右布局容器
    const contentContainer = document.createElement('div');
    contentContainer.className = 'boards-content-container';
    
    // 左侧：看板快捷过滤模块
    const filtersShortcuts = document.createElement('div');
    filtersShortcuts.className = 'issues-filters-shortcuts';
    
    // 右侧：过滤模块+看板列表的容器
    const rightContainer = document.createElement('div');
    rightContainer.className = 'boards-right-container';
    
    // 右侧内的过滤模块容器（将在moveExistingContent中填充）
    const filtersContainer = document.createElement('div');
    filtersContainer.className = 'issues-filters-container';
    
    // 右侧内的看板列表容器（将在moveExistingContent中填充）
    const boardsListContainer = document.createElement('div');
    boardsListContainer.className = 'boards-list-container';
    
    // 组装右侧容器
    rightContainer.appendChild(filtersContainer);
    rightContainer.appendChild(boardsListContainer);
    
    // 组装左右布局容器
    contentContainer.appendChild(filtersShortcuts);
    contentContainer.appendChild(rightContainer);
    
    // 组装最终结构：tabs 在顶部，左右布局在下方
    boardsTabs.appendChild(tabsWrapper);
    boardsTabs.appendChild(contentContainer);
    
    return boardsTabs;
  }

  moveExistingContent(boardsApp, newStructure) {
    try {
      // 保存原有的元素引用
      const originalIssuesFilters = boardsApp.querySelector('.issues-filters');
      const originalBoardsList = boardsApp.querySelector('[data-qa-selector="boards_list"]');
      const originalVPortal = boardsApp.querySelector('.v-portal');
      
      // 获取新结构中的目标区域
      const filtersContainer = newStructure.querySelector('.issues-filters-container');
      const boardsListContainer = newStructure.querySelector('.boards-list-container');
      
      // 将原有的 issues-filters 整体移动到过滤容器
      if (originalIssuesFilters && filtersContainer) {
        filtersContainer.appendChild(originalIssuesFilters);
        console.log('✅ Moved original issues-filters to filters container');
      }
      
      // 移动 boards 列表
      if (originalBoardsList && boardsListContainer) {
        boardsListContainer.appendChild(originalBoardsList);
        console.log('✅ Moved boards list to boards list container');
      }
      
      // 移动 v-portal（如果存在）
      if (originalVPortal && boardsListContainer) {
        boardsListContainer.appendChild(originalVPortal);
        console.log('✅ Moved v-portal to boards list container');
      }
      
    } catch (error) {
      console.error('❌ Error moving existing content:', error);
    }
  }

  // 创建快捷过滤模块
  createFiltersShortcuts(container) {
    // 创建快捷过滤管理器
    this.shortcutsManager = new FiltersShortcutsManager(container, this);
    this.shortcutsManager.render();
  }

  // 应用过滤模版
  applyFilterTemplate(templateType) {
    console.log(`🔍 Applying filter template: ${templateType}`);
    
    // 使用URL参数的方式来应用过滤
    this.applyFilterViaUrl(templateType);
  }

  // 通过URL参数应用过滤
  applyFilterViaUrl(templateType) {
    try {
      const currentUrl = new URL(window.location.href);
      
      // 清除现有的过滤参数
      this.clearFilterParams(currentUrl);
      
      // 根据模版类型添加相应的URL参数
      switch (templateType) {
        case 'default':
          // 默认情况下不添加任何参数，已经在clearFilterParams中清除了
          break;
        case 'assigned-to-me':
          // 获取当前用户信息
          const currentUser = this.getCurrentUser();
          if (currentUser) {
            currentUrl.searchParams.set('assignee_username', currentUser);
          } else {
            // 如果无法获取用户名，使用GitLab的特殊参数
            currentUrl.searchParams.set('assignee_id', 'me');
          }
          break;
        case 'created-by-me':
          // 获取当前用户信息
          const currentAuthor = this.getCurrentUser();
          if (currentAuthor) {
            currentUrl.searchParams.set('author_username', currentAuthor);
          } else {
            // 如果无法获取用户名，使用GitLab的特殊参数
            currentUrl.searchParams.set('author_id', 'me');
          }
          break;
      }
      
      console.log(`🔄 Navigating to: ${currentUrl.toString()}`);
      
      // 直接导航到新的URL
      window.location.href = currentUrl.toString();
      
    } catch (error) {
      console.error('❌ Error applying filter via URL:', error);
      // 如果URL方式失败，回退到搜索框方式
      this.fallbackToSearchInput(templateType);
    }
  }

  // 清除过滤相关的URL参数
  clearFilterParams(url) {
    // GitLab boards 页面常用的过滤参数
    const filterParams = [
      'assignee_username',
      'assignee_id', 
      'author_username',
      'author_id',
      'milestone_title',
      'label_name',
      'search',
      'state',
      'scope',
      'sort'
    ];
    
    filterParams.forEach(param => {
      url.searchParams.delete(param);
    });
  }

  // 根据模版类型获取描述
  getFilterDescriptionByType(templateType) {
    switch (templateType) {
      case 'default':
        return '';
      case 'assigned-to-me':
        return '指派给我的问题';
      case 'created-by-me':
        return '我创建的问题';
      default:
        return templateType;
    }
  }

  // 回退到搜索框方式（如果URL方式失败）
  fallbackToSearchInput(templateType) {
    console.log('🔄 Falling back to search input method');
    
    const searchInput = this.getSearchInput();
    if (!searchInput) {
      console.warn('❌ Search input not found for fallback');
      return;
    }

    let filterQuery = '';
    
    switch (templateType) {
      case 'default':
        filterQuery = '';
        break;
      case 'assigned-to-me':
        const currentUser = this.getCurrentUser();
        if (currentUser) {
          filterQuery = `assignee:@${currentUser}`;
        } else {
          filterQuery = 'assignee:@me';
        }
        break;
      case 'created-by-me':
        const currentAuthor = this.getCurrentUser();
        if (currentAuthor) {
          filterQuery = `author:@${currentAuthor}`;
        } else {
          filterQuery = 'author:@me';
        }
        break;
    }
    
    this.applySearchFilter(searchInput, filterQuery);
  }

  // 根据当前URL参数设置活跃模版
  setActiveFilterTemplate() {
    const url = new URL(window.location.href);
    const assignee = url.searchParams.get('assignee_username');
    const author = url.searchParams.get('author_username');
    
    let activeTemplate = 'default';
    
    // 根据URL参数判断当前应该激活的模版
    if (assignee === this.getCurrentUser()?.username) {
      activeTemplate = 'assigned-to-me';
    } else if (author === this.getCurrentUser()?.username) {
      activeTemplate = 'created-by-me';
    }
    
    // 设置活跃状态
    const shortcutItems = document.querySelectorAll('.shortcut-item');
    shortcutItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-template') === activeTemplate);
    });
  }

  // 清除过滤模版
  clearFilterTemplate() {
    console.log('🧹 Clearing filter template');
    
    // 重置为默认模版
    const defaultTemplate = document.querySelector('.filter-template-item[data-template="default"]');
    if (defaultTemplate) {
      // 移除所有活跃状态
      document.querySelectorAll('.filter-template-item').forEach(t => t.classList.remove('active'));
      // 设置默认为活跃
      defaultTemplate.classList.add('active');
      
      // 应用默认过滤（清空所有过滤参数）
      this.applyFilterTemplate('default');
    }
  }

  // 获取搜索输入框
  getSearchInput() {
    // 尝试多种选择器来找到搜索输入框
    const selectors = [
      '[data-testid="issue-board-filtered-search"] input',
      '.filtered-search-input-container input',
      '.filtered-search input',
      '.gl-filtered-search-input',
      'input[placeholder*="Search"]',
      'input[placeholder*="Filter"]'
    ];
    
    for (const selector of selectors) {
      const input = document.querySelector(selector);
      if (input) {
        console.log(`✅ Found search input with selector: ${selector}`);
        return input;
      }
    }
    
    console.warn('❌ Search input not found');
    return null;
  }

  // 获取当前用户
  getCurrentUser() {
    try {
      // 尝试从多个地方获取当前用户信息
      
      // 方法1: 从页面的 gon 对象获取（GitLab 的全局对象）
      if (window.gon && window.gon.current_username) {
        console.log(`✅ Found current user from gon: ${window.gon.current_username}`);
        return window.gon.current_username;
      }
      
      // 方法2: 从用户菜单获取
      const userMenu = document.querySelector('[data-qa-selector="user_menu"]') ||
                      document.querySelector('.header-user-dropdown-toggle') ||
                      document.querySelector('.user-menu') ||
                      document.querySelector('.navbar-nav .dropdown');
      
      if (userMenu) {
        // 尝试从用户头像的alt属性获取
        const userImg = userMenu.querySelector('img');
        if (userImg && userImg.alt) {
          console.log(`✅ Found current user from avatar alt: ${userImg.alt}`);
          return userImg.alt;
        }
        
        // 尝试从用户头像的data属性获取
        if (userImg && userImg.dataset.user) {
          console.log(`✅ Found current user from avatar data: ${userImg.dataset.user}`);
          return userImg.dataset.user;
        }
        
        // 尝试从链接href获取用户名
        const userLink = userMenu.querySelector('a[href*="/"]');
        if (userLink) {
          const href = userLink.getAttribute('href');
          const userMatch = href.match(/\/([^\/]+)$/);
          if (userMatch && userMatch[1] && !userMatch[1].includes('.')) {
            console.log(`✅ Found current user from link: ${userMatch[1]}`);
            return userMatch[1];
          }
        }
      }
      
      // 方法3: 从页面的 data 属性获取
      const bodyData = document.body.dataset;
      if (bodyData.user || bodyData.username) {
        const username = bodyData.user || bodyData.username;
        console.log(`✅ Found current user from body data: ${username}`);
        return username;
      }
      
      // 方法4: 从 meta 标签获取
      const userMeta = document.querySelector('meta[name="user-login"]') ||
                      document.querySelector('meta[name="current-user"]') ||
                      document.querySelector('meta[name="current-user-id"]');
      if (userMeta) {
        const username = userMeta.getAttribute('content');
        console.log(`✅ Found current user from meta: ${username}`);
        return username;
      }
      
      // 方法5: 从当前URL路径尝试提取（如果在用户profile页面）
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/users/')) {
        const userMatch = currentPath.match(/\/users\/([^\/]+)/);
        if (userMatch && userMatch[1]) {
          console.log(`✅ Found current user from URL path: ${userMatch[1]}`);
          return userMatch[1];
        }
      }
      
      console.warn('❌ Could not determine current user from any source');
      return null;
    } catch (error) {
      console.error('❌ Error getting current user:', error);
      return null;
    }
  }

  // 应用搜索过滤
  applySearchFilter(searchInput, filterQuery) {
    try {
      console.log(`🔍 Applying search filter: "${filterQuery}"`);
      
      // 清空当前搜索内容
      searchInput.value = '';
      
      // 触发 input 事件清空之前的搜索
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // 如果有过滤查询，应用它
      if (filterQuery) {
        // 延迟一点时间确保清空操作完成
        setTimeout(() => {
          // 设置新的搜索值
          searchInput.value = filterQuery;
          
          // 触发多种事件来确保搜索生效
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          searchInput.dispatchEvent(new Event('change', { bubbles: true }));
          
          // 模拟按 Enter 键提交搜索
          setTimeout(() => {
            searchInput.dispatchEvent(new KeyboardEvent('keydown', { 
              key: 'Enter', 
              keyCode: 13, 
              bubbles: true 
            }));
            searchInput.dispatchEvent(new KeyboardEvent('keyup', { 
              key: 'Enter', 
              keyCode: 13, 
              bubbles: true 
            }));
          }, 100);
        }, 200);
      }
      
      // 显示用户反馈
      this.showFilterFeedback(filterQuery);
      
      console.log(`✅ Search filter applied successfully`);
    } catch (error) {
      console.error('❌ Error applying search filter:', error);
    }
  }

  // 显示过滤反馈
  showFilterFeedback(filterQuery) {
    // 查找或创建反馈元素
    let feedback = document.querySelector('.filter-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.className = 'filter-feedback';
      
      // 将反馈插入到搜索区域
      const searchSection = document.querySelector('.gitlab-board-plus-search-section');
      if (searchSection) {
        searchSection.appendChild(feedback);
      }
    }
    
    // 设置反馈内容
    if (filterQuery) {
      feedback.innerHTML = `
        <span class="feedback-icon">🔍</span>
        <span class="feedback-text">已应用过滤: <strong>${filterQuery}</strong></span>
        <button class="feedback-close" onclick="this.parentElement.style.display='none'">×</button>
      `;
      feedback.style.display = 'flex';
      
      // 3秒后自动隐藏
      setTimeout(() => {
        if (feedback) {
          feedback.style.display = 'none';
        }
      }, 3000);
    } else {
      feedback.innerHTML = `
        <span class="feedback-icon">✨</span>
        <span class="feedback-text">已清除所有过滤条件</span>
        <button class="feedback-close" onclick="this.parentElement.style.display='none'">×</button>
      `;
      feedback.style.display = 'flex';
      
      // 2秒后自动隐藏
      setTimeout(() => {
        if (feedback) {
          feedback.style.display = 'none';
        }
      }, 2000);
    }
  }

  async createBoardTabs(container, currentBoardId, boardsDropdown) {
    // 检查是否已经有 tabs，如果有则不再修改
    const existingTabs = container.querySelectorAll('.boards-tab');
    if (existingTabs.length > 0) {
      console.log('Tabs already exist, no modifications allowed');
      return;
    }
    
    // 标记容器已初始化，防止重复创建
    if (container.hasAttribute('data-tabs-initialized')) {
      console.log('Tabs container already initialized, skipping');
      return;
    }
    
    // 清空容器（仅当没有现有 tabs 时）
    container.innerHTML = '';
    
    // 创建 tabs wrapper
    const tabsWrapper = document.createElement('div');
    tabsWrapper.className = 'boards-tabs-wrapper';
    container.appendChild(tabsWrapper);
    
    // 尝试加载 boards 数据
    console.log('🔄 Loading boards data...');
    let boards = [];
    
    try {
      // 先尝试从已展开的下拉框获取数据
      boards = this.extractBoardsFromDropdown(boardsDropdown);
      
      // 如果没有数据，尝试展开下拉框获取数据
      if (boards.length === 0) {
        console.log('No immediate boards found, trying to load data...');
        boards = await this.loadBoardsData(boardsDropdown);
      }
    } catch (error) {
      console.error('Error loading boards data:', error);
    }
    
    // 如果仍然没有数据，创建当前 board 的 tab
    if (boards.length === 0) {
      console.log('No boards data available, creating current board tab');
      const currentBoardName = this.getCurrentBoardName(boardsDropdown);
      this.createSingleBoardTab(tabsWrapper, currentBoardName, currentBoardId, true);
    } else {
      console.log(`✅ Found ${boards.length} boards, creating tabs`);
      // 为每个 board 创建 tab
      boards.forEach(board => {
        const isActive = board.id === currentBoardId || 
                        board.name === this.getCurrentBoardName(boardsDropdown) ||
                        board.url === window.location.pathname;
        this.createBoardTab(tabsWrapper, board, isActive);
      });
    }
    
    // 标记容器已初始化
    container.setAttribute('data-tabs-initialized', 'true');
    console.log(`✅ Tabs created and locked: ${tabsWrapper.children.length} tabs`);
    
    // 设置观察器（但由于 tabs 已锁定，实际上不会触发重建）
    this.observeBoardsDropdown(boardsDropdown, tabsWrapper, currentBoardId);
  }

  // 后台尝试加载更多 boards（不阻塞主流程）
  tryLoadMoreBoards(boardsDropdown, currentBoardId) {
    console.log('Trying to load more boards in background...');
    
    // 简单尝试点击下拉框，但不等待结果
    setTimeout(() => {
      try {
        const dropdownButton = boardsDropdown.querySelector('.gl-dropdown-toggle') ||
                              boardsDropdown.querySelector('button[aria-haspopup="true"]');
        
        if (dropdownButton && dropdownButton.getAttribute('aria-expanded') !== 'true') {
          dropdownButton.click();
          
          // 等待一小段时间后关闭
          setTimeout(() => {
            if (dropdownButton.getAttribute('aria-expanded') === 'true') {
              dropdownButton.click(); // 关闭下拉框
            }
          }, 1000);
        }
      } catch (error) {
        console.log('Background board loading failed (non-critical):', error);
      }
    }, 500);
  }

  async loadBoardsData(boardsDropdown) {
    return new Promise((resolve) => {
      console.log('🔄 Starting to load boards data...');
      
      // 查找下拉框按钮
      const dropdownButton = boardsDropdown.querySelector('.gl-dropdown-toggle') ||
                            boardsDropdown.querySelector('button[aria-haspopup="true"]') ||
                            boardsDropdown.querySelector('button[data-toggle="dropdown"]') ||
                            boardsDropdown.querySelector('.dropdown-toggle');
      
      if (!dropdownButton) {
        console.warn('❌ Cannot find dropdown button');
        resolve([]);
        return;
      }

      console.log('✅ Found dropdown button:', dropdownButton);

      let hasFoundBoards = false;
      
      // 创建观察器来监听下拉框内容的加载
      const observer = new MutationObserver((mutations) => {
        if (hasFoundBoards) return; // 防止重复处理
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'attributes') {
            // 尝试提取 boards
            const boards = this.extractBoardsFromDropdown(boardsDropdown);
            if (boards.length > 0) {
              hasFoundBoards = true;
              console.log(`🎉 Found ${boards.length} boards via observer`);
              observer.disconnect();
              
              // 延迟关闭下拉框，确保数据提取完成
              setTimeout(() => {
                this.closeDropdown(boardsDropdown);
                resolve(boards);
              }, 100);
            }
          }
        });
      });

      // 观察多个可能的容器
      const observeTargets = [
        boardsDropdown,
        boardsDropdown.querySelector('.dropdown-menu'),
        boardsDropdown.querySelector('[data-qa-selector="boards_dropdown"]'),
        boardsDropdown.querySelector('.gl-dropdown-contents'),
        document.querySelector('.dropdown-menu'), // 有时下拉框内容在 body 下
        document.body // 最后的备选方案
      ].filter(Boolean);

      observeTargets.forEach(target => {
        if (target) {
          observer.observe(target, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-expanded', 'class']
          });
        }
      });

      // 设置超时，避免无限等待
      const timeout = setTimeout(() => {
        if (!hasFoundBoards) {
          observer.disconnect();
          this.closeDropdown(boardsDropdown);
          console.warn('⏰ Timeout waiting for boards data');
          resolve([]);
        }
      }, 8000);

      // 触发下拉框展开
      try {
        // 检查下拉框是否已经展开
        const isExpanded = dropdownButton.getAttribute('aria-expanded') === 'true' ||
                          dropdownButton.classList.contains('show') ||
                          boardsDropdown.classList.contains('show');
        
        console.log('🔍 Dropdown expanded state:', isExpanded);
        
        if (!isExpanded) {
          console.log('👆 Clicking dropdown button to expand...');
          
          // 尝试多种点击方式
          dropdownButton.click();
          
          // 如果第一次点击没有效果，尝试其他方式
          setTimeout(() => {
            if (dropdownButton.getAttribute('aria-expanded') !== 'true') {
              console.log('🔄 Trying alternative click methods...');
              
              // 尝试触发 mousedown/mouseup 事件
              dropdownButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              dropdownButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              dropdownButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
          }, 200);
          
          // 检查是否有立即可用的数据
          setTimeout(() => {
            if (!hasFoundBoards) {
              const immediateBoards = this.extractBoardsFromDropdown(boardsDropdown);
              if (immediateBoards.length > 0) {
                hasFoundBoards = true;
                clearTimeout(timeout);
                observer.disconnect();
                this.closeDropdown(boardsDropdown);
                console.log(`⚡ Found ${immediateBoards.length} boards immediately`);
                resolve(immediateBoards);
              }
            }
          }, 500);
          
        } else {
          // 如果已经展开，直接尝试提取数据
          console.log('📋 Dropdown already expanded, extracting data...');
          setTimeout(() => {
            if (!hasFoundBoards) {
              const boards = this.extractBoardsFromDropdown(boardsDropdown);
              if (boards.length > 0) {
                hasFoundBoards = true;
                clearTimeout(timeout);
                observer.disconnect();
                console.log(`📊 Found ${boards.length} boards from already opened dropdown`);
                resolve(boards);
              } else {
                console.log('❌ No boards found in already opened dropdown');
                // 尝试重新点击
                dropdownButton.click();
              }
            }
          }, 200);
        }
        
      } catch (error) {
        console.error('❌ Error triggering dropdown:', error);
        clearTimeout(timeout);
        observer.disconnect();
        resolve([]);
      }
    });
  }

  closeDropdown(boardsDropdown) {
    try {
      // 尝试多种方式关闭下拉框
      const dropdownButton = boardsDropdown.querySelector('.gl-dropdown-toggle') ||
                            boardsDropdown.querySelector('button[aria-haspopup="true"]');
      
      if (dropdownButton) {
        const isExpanded = dropdownButton.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
          dropdownButton.click();
        }
      }
      
      // 或者通过按 ESC 键关闭
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      
    } catch (error) {
      console.warn('Error closing dropdown:', error);
    }
  }

  extractBoardsFromDropdown(boardsDropdown) {
    const boards = [];
    
    try {
      // 查找 dropdown 内容区域的多种可能选择器
      let dropdownContent = boardsDropdown.querySelector('[data-qa-selector="boards_dropdown_content"]') ||
                           boardsDropdown.querySelector('.dropdown-content') ||
                           boardsDropdown.querySelector('.gl-dropdown-contents') ||
                           boardsDropdown.querySelector('.dropdown-menu') ||
                           boardsDropdown.querySelector('[role="menu"]') ||
                           boardsDropdown.querySelector('.gl-dropdown-inner');
      
      if (!dropdownContent) {
        console.log('🔍 No dropdown content found, searching in entire dropdown...');
        dropdownContent = boardsDropdown;
      }
    
      // 查找所有 board 选项的多种方式
      let boardItems = [];
      
      // 尝试不同的选择器组合
      const selectors = [
        '.gl-dropdown-item button[role="menuitem"]',
        '.gl-dropdown-item a[role="menuitem"]', 
        '.gl-dropdown-item',
        'li[role="presentation"] button',
        'li[role="presentation"] a',
        '[role="menuitem"]',
        'button[data-board-id]',
        'a[href*="/boards/"]'
      ];
      
      for (const selector of selectors) {
        boardItems = dropdownContent.querySelectorAll(selector);
        if (boardItems.length > 0) {
          console.log(`✅ Found ${boardItems.length} items using selector: ${selector}`);
          break;
        }
      }
      
      if (boardItems.length === 0) {
        console.log('❌ No board items found with any selector');
        return boards;
      }
    
      boardItems.forEach((item, index) => {
        // 获取可点击元素
        let clickableElement = item;
        if (item.tagName !== 'BUTTON' && item.tagName !== 'A') {
          clickableElement = item.querySelector('button[role="menuitem"]') || 
                           item.querySelector('a[role="menuitem"]') ||
                           item.querySelector('button') || 
                           item.querySelector('a');
        }
        
        if (clickableElement && !clickableElement.querySelector('[data-qa-selector="create_new_board_button"]')) {
          // 获取 board 名称
          let boardName = '';
          
          // 尝试多种方式获取文本
          const textElement = clickableElement.querySelector('.gl-dropdown-item-text-primary') ||
                             clickableElement.querySelector('.gl-dropdown-item-text-wrapper') ||
                             clickableElement.querySelector('.gl-dropdown-button-text') ||
                             clickableElement.querySelector('.board-item-name') ||
                             clickableElement;
          
          if (textElement) {
            boardName = textElement.textContent.trim();
            
            // 过滤掉无效的项目
            if (boardName && 
                !boardName.includes('No matching boards found') && 
                !boardName.includes('Create new board') &&
                !boardName.includes('Switch board') &&
                !boardName.includes('Loading') &&
                boardName !== '' &&
                boardName.length > 0) {
              
              // 尝试获取 board ID 和 URL
              const boardId = this.extractBoardIdFromItem(item, clickableElement);
              const boardUrl = this.extractBoardUrlFromItem(item, clickableElement);
              
              console.log(`📋 Found board: "${boardName}" (ID: ${boardId}, URL: ${boardUrl})`);
              
              boards.push({
                id: boardId || `board_${index}`,
                name: boardName,
                url: boardUrl,
                element: clickableElement
              });
            }
          }
        }
      });
    
      console.log(`✅ Extracted ${boards.length} valid boards`);
      return boards;
    } catch (error) {
      console.warn('❌ Error extracting boards from dropdown:', error);
      return boards;
    }
  }

  extractBoardIdFromItem(item, clickableElement) {
    // 尝试从各种属性中提取 board ID
    const dataId = clickableElement.getAttribute('data-board-id') || 
                   clickableElement.getAttribute('data-id') ||
                   item.getAttribute('data-board-id') ||
                   item.getAttribute('data-id');
    
    if (dataId) return dataId;
    
    // 尝试从 href 中提取 board ID
    const href = clickableElement.getAttribute('href');
    if (href) {
      const boardMatch = href.match(/\/boards\/(\d+)/);
      if (boardMatch) {
        return boardMatch[1];
      }
    }
    
    // 尝试从 onclick 或其他事件处理器中提取
    const onclick = clickableElement.getAttribute('onclick');
    if (onclick) {
      const boardMatch = onclick.match(/board[_-]?id['":\s]*(\d+)/i);
      if (boardMatch) {
        return boardMatch[1];
      }
    }
    
    // 如果没有找到 ID，返回 null（将使用索引作为 fallback）
    return null;
  }

  extractBoardUrlFromItem(item, clickableElement) {
    // 尝试从 href 属性获取 URL
    const href = clickableElement.getAttribute('href');
    if (href) {
      return href;
    }
    
    // 尝试从父元素获取 href
    const parentLink = item.querySelector('a[href*="/boards/"]');
    if (parentLink) {
      return parentLink.getAttribute('href');
    }
    
    // 尝试从数据属性获取 URL
    const dataUrl = clickableElement.getAttribute('data-url') ||
                   clickableElement.getAttribute('data-href') ||
                   item.getAttribute('data-url') ||
                   item.getAttribute('data-href');
    
    if (dataUrl) {
      return dataUrl;
    }
    
    return null;
  }

  getCurrentBoardName(boardsDropdown) {
    try {
      // 尝试从下拉框按钮的文本获取当前 board 名称
      const dropdownButton = boardsDropdown.querySelector('.gl-dropdown-toggle') ||
                            boardsDropdown.querySelector('button[aria-haspopup="true"]') ||
                            boardsDropdown.querySelector('.dropdown-toggle');
      
      if (dropdownButton) {
        // 尝试多种方式获取按钮文本
        const textElements = [
          dropdownButton.querySelector('.gl-dropdown-button-text'),
          dropdownButton.querySelector('.gl-button-text'),
          dropdownButton.querySelector('.dropdown-toggle-text'),
          dropdownButton.querySelector('.board-name'),
          dropdownButton.querySelector('span:not(.gl-icon)'),
          dropdownButton
        ];
        
        for (const textElement of textElements) {
          if (textElement) {
            const text = textElement.textContent.trim();
            if (text && 
                text !== 'Switch board' && 
                text !== 'Board' && 
                text !== '' &&
                !text.includes('Select board') &&
                !text.includes('Choose board')) {
              console.log(`📋 Found current board name: "${text}"`);
              return text;
            }
          }
        }
      }
      
      // 尝试从页面标题获取
      const pageTitle = document.title;
      const titleMatch = pageTitle.match(/(.+?)\s*·\s*Boards/);
      if (titleMatch) {
        return titleMatch[1].trim();
      }
      
      // 尝试从面包屑导航获取
      const breadcrumb = document.querySelector('.breadcrumbs-list .breadcrumb-item-text');
      if (breadcrumb) {
        return breadcrumb.textContent.trim();
      }
      
      // 尝试从 URL 获取 board ID
      const urlMatch = window.location.pathname.match(/\/boards\/(\d+)/);
      if (urlMatch) {
        return `Board ${urlMatch[1]}`;
      }
      
      // 最后的备选方案
      return '当前 Board';
    } catch (error) {
      console.warn('❌ Error getting current board name:', error);
      return '当前 Board';
    }
  }

  createSingleBoardTab(container, boardName, boardId, isActive = true) {
    const tab = document.createElement('div');
    tab.className = `boards-tab ${isActive ? 'active' : ''}`;
    tab.dataset.boardId = boardId;
    
    tab.innerHTML = `
      <span class="tab-icon">📋</span>
      <span class="tab-name" title="${boardName || '当前 Board'}">${boardName || '当前 Board'}</span>
    `;
    
    // 添加点击事件
    tab.addEventListener('click', () => {
      // 如果有原始的下拉框，触发对应的 board 切换
      const boardsDropdown = document.querySelector('[data-testid="boards-selector"]');
      if (boardsDropdown) {
        // 这里可以添加切换 board 的逻辑
        console.log(`Switch to board: ${boardName} (${boardId})`);
      }
    });
    
    container.appendChild(tab);
  }

  createBoardTab(container, board, isActive = false) {
    const tab = document.createElement('div');
    tab.className = `boards-tab ${isActive ? 'active' : ''}`;
    tab.dataset.boardId = board.id;
    tab.dataset.boardUrl = board.url || '';
    
    tab.innerHTML = `
      <span class="tab-icon">📋</span>
      <span class="tab-name" title="${board.name}">${board.name}</span>
    `;
    
    // 添加点击事件
    tab.addEventListener('click', () => {
      console.log(`🎯 Switching to board: "${board.name}" (ID: ${board.id})`);
      
      // 更新活跃状态
      container.querySelectorAll('.boards-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // 尝试多种方式切换 board
      this.switchToBoard(board);
    });
    
    container.appendChild(tab);
  }

  switchToBoard(board) {
    console.log(`🔄 Attempting to switch to board:`, board);
    
    // 方法1: 如果有 URL，直接跳转
    if (board.url) {
      console.log(`🌐 Navigating via URL: ${board.url}`);
      if (board.url.startsWith('/')) {
        // 相对路径，添加当前域名
        window.location.href = window.location.origin + board.url;
      } else if (board.url.startsWith('http')) {
        // 绝对路径
        window.location.href = board.url;
      } else {
        // 构建完整路径
        this.navigateToBoard(board);
      }
      return;
    }
    
    // 方法2: 尝试点击原始下拉框中的元素
    if (board.element && typeof board.element.click === 'function') {
      console.log(`👆 Clicking board element`);
      try {
        // 确保下拉框是展开的
        const boardsDropdown = document.querySelector('[data-testid="boards-selector"]');
        if (boardsDropdown) {
          const dropdownButton = boardsDropdown.querySelector('.gl-dropdown-toggle');
          if (dropdownButton && dropdownButton.getAttribute('aria-expanded') !== 'true') {
            dropdownButton.click();
            // 等待下拉框展开后再点击
            setTimeout(() => {
              board.element.click();
            }, 200);
          } else {
            board.element.click();
          }
        } else {
          board.element.click();
        }
      } catch (error) {
        console.error('❌ Error clicking board element:', error);
        // 如果点击失败，尝试 URL 跳转
        this.navigateToBoard(board);
      }
    } else {
      // 方法3: 通过 URL 跳转
      console.log(`🔗 Fallback to URL navigation`);
      this.navigateToBoard(board);
    }
  }

  navigateToBoard(board) {
    // 构建 board URL（这需要根据实际的 GitLab URL 结构调整）
    const currentUrl = window.location.href;
    const urlParts = currentUrl.split('/boards/');
    
    if (urlParts.length > 1) {
      // 替换 board ID
      const newUrl = `${urlParts[0]}/boards/${board.id}`;
      window.location.href = newUrl;
    }
  }

  observeBoardsDropdown(boardsDropdown, tabsContainer, currentBoardId) {
    // 如果 tabs 已经初始化，则不再监听变化
    if (tabsContainer.hasAttribute('data-tabs-initialized')) {
      console.log('Tabs are locked, no observation needed');
      return;
    }
    
    // 创建 MutationObserver 来监听 dropdown 内容的变化（仅用于初始化）
    const observer = new MutationObserver((mutations) => {
      // 如果 tabs 已经创建，停止观察
      if (tabsContainer.hasAttribute('data-tabs-initialized')) {
        console.log('Tabs initialized, stopping observation');
        observer.disconnect();
        return;
      }
      
      let shouldUpdate = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          // 只在还没有 tabs 时才考虑更新
          const existingTabs = tabsContainer.querySelectorAll('.boards-tab');
          if (existingTabs.length === 0) {
            shouldUpdate = true;
          }
        }
      });
      
      // 只有在真正需要初始化时才创建 tabs
      if (shouldUpdate) {
        // 延迟更新，避免频繁重建
        clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(async () => {
          // 再次检查是否已经初始化
          if (!tabsContainer.hasAttribute('data-tabs-initialized')) {
            await this.createBoardTabs(tabsContainer, currentBoardId, boardsDropdown);
          }
        }, 300);
      }
    });
    
    // 监听 dropdown 内容区域
    const dropdownContent = boardsDropdown.querySelector('[data-qa-selector="boards_dropdown_content"]');
    if (dropdownContent) {
      observer.observe(dropdownContent, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }
    
    // 也监听 dropdown 按钮的变化（当前 board 名称）
    const dropdownButton = boardsDropdown.querySelector('.gl-dropdown-toggle');
    if (dropdownButton) {
      observer.observe(dropdownButton, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }
  }

  // 获取当前 Board ID
  getCurrentBoardId() {
    const match = window.location.pathname.match(/\/boards\/(\d+)/);
    return match ? match[1] : null;
  }

  // 添加 Board 统计信息
  addBoardStatistics() {
    const rightPanel = document.querySelector('.gitlab-board-plus-right-panel');
    if (!rightPanel || document.querySelector('.gitlab-board-plus-stats')) {
      return;
    }

    const statsContainer = document.createElement('div');
    statsContainer.className = 'gitlab-board-plus-stats';
    statsContainer.innerHTML = `
      <div class="board-stats">
        <span class="stat-item">
          <strong>总计:</strong> <span id="total-issues">-</span>
        </span>
        <span class="stat-item">
          <strong>已分配:</strong> <span id="assigned-issues">-</span>
        </span>
        <span class="stat-item">
          <strong>逾期:</strong> <span id="overdue-issues">-</span>
        </span>
      </div>
    `;

    // 插入到搜索区域之后
    const searchSection = rightPanel.querySelector('.gitlab-board-plus-search-section');
    if (searchSection) {
      searchSection.appendChild(statsContainer);
    }

    // 计算统计信息
    this.updateBoardStatistics();
  }

  // 更新 Board 统计信息
  updateBoardStatistics() {
    const cards = document.querySelectorAll('.board-card');
    const totalIssues = cards.length;
    
    let assignedIssues = 0;
    let overdueIssues = 0;

    cards.forEach(card => {
      if (card.querySelector('.board-card-assignee')) {
        assignedIssues++;
      }
      if (this.isOverdue(card)) {
        overdueIssues++;
      }
    });

    // 更新显示
    const totalElement = document.getElementById('total-issues');
    const assignedElement = document.getElementById('assigned-issues');
    const overdueElement = document.getElementById('overdue-issues');

    if (totalElement) totalElement.textContent = totalIssues;
    if (assignedElement) assignedElement.textContent = assignedIssues;
    if (overdueElement) overdueElement.textContent = overdueIssues;
  }

  // 检查是否逾期
  isOverdue(card) {
    const dueDateElement = card.querySelector('.board-card-due-date');
    if (!dueDateElement) return false;
    
    const dueDate = new Date(dueDateElement.textContent);
    return dueDate < new Date();
  }

  // 增强拖拽功能
  enhanceDragAndDrop() {
    // 添加拖拽时的视觉反馈
    document.addEventListener('dragstart', (e) => {
      if (e.target.closest('.board-card')) {
        e.target.closest('.board-card').classList.add('dragging');
      }
    });

    document.addEventListener('dragend', (e) => {
      if (e.target.closest('.board-card')) {
        e.target.closest('.board-card').classList.remove('dragging');
      }
    });
  }

  // 增强 Issues 页面
  enhanceIssues() {
    console.log('增强 Issues 页面功能');
    // 这里可以添加 Issues 页面的增强功能
  }

  // 增强 Merge Requests 页面
  enhanceMergeRequests() {
    console.log('增强 Merge Requests 页面功能');
    // 这里可以添加 MR 页面的增强功能
  }

  // 通用增强功能
  enhanceGeneral() {
    console.log('应用通用增强功能');
    // 添加项目快速切换等通用功能
  }

  // 监听页面变化
  observePageChanges() {
    let lastUrl = location.href;
    
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.currentUrl = url;
        this.projectId = this.extractProjectId();
        
        // 延迟执行，等待新页面内容加载
        setTimeout(() => {
          // 只在 GitLab 页面执行增强功能
          if (this.isGitLabPage()) {
            this.enhance();
          }
        }, 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // 重构后的快捷过滤事件绑定已移至 FiltersShortcutsManager 类中处理
  
  // 保留此方法用于向后兼容，但功能已转移到 FiltersShortcutsManager
  bindShortcutsEvents(container) {
    console.log('🔄 Shortcuts events now handled by FiltersShortcutsManager');
  }

  // 保留此方法用于向后兼容，但功能已转移到 FiltersShortcutsManager
  setActiveShortcutFromUrl(container) {
    console.log('🔄 Active shortcut URL sync now handled by FiltersShortcutsManager');
  }

  // 创建 board tabs 后处理逻辑
  createBoardTabsAfterRestructure() {
    try {
      console.log('🔄 Creating board tabs after restructure...');
      
      // 查找 boards-selector 
      const boardsSelector = document.querySelector('[data-testid="boards-selector"]');
      if (!boardsSelector) {
        console.warn('❌ boards-selector not found for tabs creation');
        return;
      }
      
      // 获取当前 board ID
      const currentBoardId = this.getCurrentBoardId();
      console.log('Current board ID:', currentBoardId);
      
      // 查找已经创建的 tabs 容器
      const tabsContainer = document.querySelector('.boards-tabs-wrapper');
      if (!tabsContainer) {
        console.warn('❌ boards-tabs-wrapper not found for tabs');
        return;
      }
      
      // 创建 board tabs
      this.createBoardTabs(tabsContainer, currentBoardId, boardsSelector);
      
      console.log('✅ Board tabs creation completed');
      
    } catch (error) {
      console.error('❌ Error creating board tabs after restructure:', error);
    }
  }
}

// 初始化增强器
const enhancer = new GitLabBoardEnhancer();

// 将增强器实例暴露到全局对象以便调试
window.gitlabBoardEnhancer = enhancer; 