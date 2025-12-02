/***********************************************************************************************************************

	chs.js – 简体中文

	Localization by: Liyro Pen.

	Copyright © 2017 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

	For more information about the guidelines used to create this localization, see:
		http://www.motoslave.net/sugarcube/2/docs/#guide-localization

***********************************************************************************************************************/
/* global l10nStrings */
/* eslint-disable strict */

(function () {
	/* General. */
	l10nStrings.identity = '游戏';
	l10nStrings.aborting = '终止';
	l10nStrings.cancel   = '取消';
	l10nStrings.close    = '关闭';
	l10nStrings.ok       = '确认';

	/* Errors. */
	l10nStrings.errorTitle              = '出错';
	l10nStrings.errorToggle             = '打开/关闭错误视图',
	l10nStrings.errorNonexistentPassage = '段落"{passage}"不存在';
	l10nStrings.errorSaveDiskLoadFailed = '从本地读取存档文件失败',
	l10nStrings.errorSaveMissingData    = '存档缺少必要数据，可能是读取的文件非存档或存档已损坏';
	l10nStrings.errorSaveIdMismatch     = '来自{identity}的存档有误';

	/* Warnings. */
	l10nStrings._warningIntroLacking  = '你的浏览器可能损坏，或限制了';
	l10nStrings._warningOutroDegraded = '，因此{identity}在受限制模式中运行。你可以继续运行，但部分内容可能出现异常。';
	l10nStrings.warningNoWebStorage   = '{_warningIntroLacking} Web Storage API{_warningOutroDegraded}';
	l10nStrings.warningDegraded       = '{_warningIntroLacking}{identity}所需功能{_warningOutroDegraded}';
	
	/* Debug Bar. */
	l10nStrings.debugBarToggle      = '打开/关闭调试栏',
	l10nStrings.debugBarNoWatches   = '\u2014 未设置监控 \u2014',
	l10nStrings.debugBarAddWatch    = '添加监控',
	l10nStrings.debugBarDeleteWatch = '删除监控',
	l10nStrings.debugBarWatchAll    = '监控全部',
	l10nStrings.debugBarWatchNone   = '删除全部',
	l10nStrings.debugBarLabelAdd    = '添加',
	l10nStrings.debugBarLabelWatch  = '监视',
	l10nStrings.debugBarLabelTurn   = '回合', // (noun) chance to act (in a game), moment, period
	l10nStrings.debugBarLabelViews  = '视图',
	l10nStrings.debugBarViewsToggle = '打开/关闭调试视图',
	l10nStrings.debugBarWatchToggle = '打开/关闭监控面板',

	/* UI bar. */
	l10nStrings.uiBarToggle   = '打开/关闭导航栏';
	l10nStrings.uiBarBackward = '后退';
	l10nStrings.uiBarForward  = '前进';
	l10nStrings.uiBarJumpto   = '跳到{identity}的历史记录中的某一点';

	/* Jump To. */
	l10nStrings.jumptoTitle       = '跳到';
	l10nStrings.jumptoTurn        = '转到';
	l10nStrings.jumptoUnavailable = '目前没有可用的跳跃点\u2026';

	/* Saves. */
	l10nStrings.savesTitle       = '存档';
	l10nStrings.savesDisallowed  = '在本段落中不允许存档';
	l10nStrings.savesIncapable   = '{_warningIntroLacking}支持存档所需的功能，因此本次游戏的存档功能已被禁用';
	l10nStrings.savesLabelAuto   = '自动存档';
	l10nStrings.savesLabelDelete = '删除';
	l10nStrings.savesLabelExport = '另存为\u2026';
	l10nStrings.savesLabelImport = '读取\u2026';
	l10nStrings.savesLabelLoad   = '读取';
	l10nStrings.savesLabelClear  = '全部删除';
	l10nStrings.savesLabelSave   = '保存';
	l10nStrings.savesLabelSlot   = '存档槽';
	l10nStrings.savesUnavailable = '未找到存档插槽\u2026';
	l10nStrings.savesUnknownDate = '未知';

	/* idb related */
	l10nStrings.savesDisallowedReplay     = '目前正在使用场景查看器，无法正常保存。';
	l10nStrings.savesExportReminder       = '警告：如果你清除了浏览器缓存，此处的存档也将丢失！请定时导出存档！';
	l10nStrings.savesHeaderSaveLoad       = '保存/加载';
	l10nStrings.savesHeaderIDName         = 'ID/名称';
	l10nStrings.savesHeaderDetails        = '描述';
	l10nStrings.savesDescTitle            = '标题：';
	l10nStrings.savesDescName             = '存档名：';
	l10nStrings.savesDescId               = '存档 ID：';
	l10nStrings.savesDescDate             = '日期：';
	l10nStrings.savesPagerJump            = '跳转到最近一次手动保存';
	l10nStrings.savesPagerPage            = '页数：';
	l10nStrings.savesPagerSavesPerPage    = '每页存档个数：';
	l10nStrings.savesOptionsConfirmOn     = '保存时需要确认';
	l10nStrings.savesOptionsOverwrite     = '覆盖';
	l10nStrings.savesOptionsUseLegacy     = '使用旧版储存方式';
	l10nStrings.savesWarningSaveOnSlot    = '保存存档到槽 ';
	l10nStrings.savesWarningOverwriteSlot = '覆盖存档到槽 ';
	l10nStrings.savesWarningOverwriteID   = '存档 ID 不匹配，是否继续覆盖？';
	l10nStrings.savesWarningDeleteInSlot  = '删除存档槽：';
	l10nStrings.savesWarningLoad          = '加载存档槽：';
	l10nStrings.savesWarningDeleteAll     = '警告：你确定要删除所有存档吗？';
	l10nStrings.savesLabelToClipboard     = '保存至剪贴板\u2026';

	/* Settings. */
	l10nStrings.settingsTitle = '设置';
	l10nStrings.settingsOff   = '关闭';
	l10nStrings.settingsOn    = '开启';
	l10nStrings.settingsReset = '重置为默认值';

	/* Restart. */
	l10nStrings.restartTitle  = '重新开始';
	l10nStrings.restartPrompt = '你确定要重新开始吗？未保存的进度将会丢失。';

	/* Share. */
	l10nStrings.shareTitle = '分享';

	/* Alert */
	l10nStrings.alertTitle = '警告',

	/* Autoload. */
	l10nStrings.autoloadTitle  = '自动加载';
	l10nStrings.autoloadCancel = '前往最初的段落';
	l10nStrings.autoloadOk     = '读取自动存档';
	l10nStrings.autoloadPrompt = '有一个自动存档，读取它还是前往最初的段落？';

	/* Macros. */
	l10nStrings.macroBackText   = '返回上一步';
	l10nStrings.macroReturnText = '返回/退出';
})();
