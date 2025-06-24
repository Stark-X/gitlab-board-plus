// GitLab Board Plus - 过滤管理器
console.log('🎯 GitLab Board Plus filters manager loaded');

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
      this.currentUser = GitLabUtils.getCurrentUser();
      
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
            isDefault: true,
            userData: this.currentUser // 使用当前用户数据
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
            isDefault: true,
            userData: this.currentUser // 使用当前用户数据
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
      // 使用 GraphQL API 获取成员信息
      const members = await GitLabUtils.fetchProjectMembersFromAPI();
      
      // 更新指派人和创建人组
      const assigneeGroup = this.filterGroups.find(g => g.id === 'assignee');
      const authorGroup = this.filterGroups.find(g => g.id === 'author');
      
      if (assigneeGroup && members.length > 0) {
        // 添加其他成员到指派人组（除了默认的"我"）
        members.forEach(member => {
          if (member.username !== this.currentUser?.username) {
            assigneeGroup.items.push({
              id: `assignee-${member.username}`,
              name: member.username, // 直接使用 username
              icon: null, // 不使用 emoji，使用头像
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
              name: member.username, // 直接使用 username
              icon: null, // 不使用 emoji，使用头像
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

  // 加载里程碑
  async loadMilestones() {
    try {
      const milestones = await GitLabUtils.extractMilestonesFromPage();
      
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

  // 加载标签
  async loadLabels() {
    try {
      const labels = await GitLabUtils.extractLabelsFromPage();
      
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
    
    // 渲染图标或头像
    let iconHtml = '';
    if (item.userData && item.userData.avatarUrl) {
      // 如果有用户数据和头像URL，显示头像
      iconHtml = `<img class="user-avatar" src="${item.userData.avatarUrl}" alt="${item.name}" title="${item.userData.name || item.name}">`;
    } else if (item.icon) {
      // 否则显示普通图标
      iconHtml = `<span class="item-icon">${item.icon}</span>`;
    }
    
    return `
      <div class="filter-item ${activeClass}" 
           data-item-id="${item.id}" 
           data-filter="${item.filter}"
           data-group-type="${groupType}">
        <input type="checkbox" ${item.active ? 'checked' : ''} title="多选模式：勾选此项可与其他选项组合使用" />
        <div class="item-content" title="单选模式：点击此处清除其他所有过滤器，只应用此条件">
          ${iconHtml}
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
      GitLabUtils.getSearchInput(),
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

// 导出过滤管理器类
window.FiltersShortcutsManager = FiltersShortcutsManager; 