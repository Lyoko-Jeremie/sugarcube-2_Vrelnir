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
	if (navigator.language !== 'zh-CN') {
		return;
	}

	/* General. */
	l10nStrings.identity = '游戏';
	l10nStrings.aborting = '终止';
	l10nStrings.cancel   = '取消';
	l10nStrings.close    = '关闭';
	l10nStrings.ok       = '确认';

	/* Errors. */
	l10nStrings.errorTitle              = '错误';
	l10nStrings.errorNonexistentPassage = '段落"{passage}"不存在';
	l10nStrings.errorSaveMissingData    = '存档缺少必须的数据，可能被读取的文件不是存档或者存档被损坏';
	l10nStrings.errorSaveIdMismatch     = '保存{identity}是错误的';

	/* Warnings. */
	l10nStrings._warningIntroLacking  = '你的浏览器可能损坏或者被禁用';
	l10nStrings._warningOutroDegraded = '，所以{identity}在受限制模式中运行。你可以继续运行，但是一些内容可能不能正确工作。';
	l10nStrings.warningNoWebStorage   = '{_warningIntroLacking} Web Storage API {_warningOutroDegraded}';
	l10nStrings.warningDegraded       = '{_warningIntroLacking} {identity}需要的功能 {_warningOutroDegraded}';

	/* Debug View. */
	l10nStrings.debugViewTitle  = '调试模式';
	l10nStrings.debugViewToggle = '切换调试模式';

	/* UI bar. */
	l10nStrings.uiBarToggle   = '打开/关闭导航栏';
	l10nStrings.uiBarBackward = '后退';
	l10nStrings.uiBarForward  = '前进';
	l10nStrings.uiBarJumpto   = '跳到{identity}的历史记录中的某一点';

	/* Jump To. */
	l10nStrings.jumptoTitle       = '跳到';
	l10nStrings.jumptoTurn        = '转到';
	l10nStrings.jumptoUnavailable = '目前没有跳跃点\u2026';

	/* Saves. */
	l10nStrings.savesTitle       = '存档';
	l10nStrings.savesDisallowed  = '在这个段落中不允许存档';
	l10nStrings.savesEmptySlot   = '\u2014 插槽空 \u2014';
	l10nStrings.savesIncapable   = '{_warningIntroLacking}支持存档所需的功能，因此本次游戏的存档功能已被禁用';
	l10nStrings.savesLabelAuto   = '自动存档';
	l10nStrings.savesLabelDelete = '删除';
	l10nStrings.savesLabelExport = '另存为\u2026';
	l10nStrings.savesLabelImport = '读取\u2026';
	l10nStrings.savesLabelLoad   = '读取';
	l10nStrings.savesLabelClear  = '全部删除';
	l10nStrings.savesLabelSave   = '保存';
	l10nStrings.savesLabelSlot   = '插槽';
	l10nStrings.savesSavedOn     = '保存在：';
	l10nStrings.savesUnavailable = '未找到存档插槽\u2026';
	l10nStrings.savesUnknownDate = '未知';

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

	/* Autoload. */
	l10nStrings.autoloadTitle  = '自动保存';
	l10nStrings.autoloadCancel = '前往最初的段落';
	l10nStrings.autoloadOk     = '读取自动存档';
	l10nStrings.autoloadPrompt = '有一个自动存档，读取它还是前往最初的段落？';

	/* Macros. */
	l10nStrings.macroBackText   = '返回';
	l10nStrings.macroReturnText = '返回';

	/* idb_backend.js */
	l10nStrings.idbHtmlSaveLoadButton            = '保存/加载';
	l10nStrings.idbHtmlSaveName                  = 'ID/名称';
	l10nStrings.idbHtmlSaveDetails               = '描述';
	l10nStrings.idbHtmlClearButton               = '删除全部';
	l10nStrings.idbHtmlSaveButton                = '保存';
	l10nStrings.idbHtmlLoadButton                = '加载';
	l10nStrings.idbHtmlDeleteButton              = '删除';
	l10nStrings.idbHtmlCancelButton              = '取消';
	l10nStrings.idbHtmlSaveTitle                 = '标题：';
	l10nStrings.idbHtmlSaveSlotName              = '存档名：';
	l10nStrings.idbHtmlSaveId                    = '存档 ID：';
	l10nStrings.idbHtmlSaveDateTime              = '日期：';
	l10nStrings.idbCannotSaveReplayScene         = '目前正在使用场景查看器，无法正常保存。';
	l10nStrings.idbCannotSave                    = "你现在无法存档！";
	l10nStrings.idbSaveWillLost                  = '此处的存档皆暂存于浏览器缓存中，清除浏览器缓存将导致存档丢失。建议定期导出存档以防游戏进度丢失。';
	l10nStrings.idbLostSaves                     = '我存档呢？';
	l10nStrings.idbLostSavesTooltip              = '你找不到存档的原因可能是你的保存方式不同。试试修改存档列表最下方的“使用旧版储存方式”选项。';
	l10nStrings.idbJumpToLatestButton            = '跳转到最近一次手动保存';
	l10nStrings.idbHtmlPager                     = '页数：';
	l10nStrings.idbHtmlPagerP                    = '每页存档个数：';
	l10nStrings.idbHtmlRequireConfirmationSave   = '保存时需要确认';
	l10nStrings.idbHtmlRequireConfirmationLoad   = '加载时需要确认';
	l10nStrings.idbHtmlRequireConfirmationDelete = '删除时需要确认';
	l10nStrings.idbHtmlUseLegacy                 = '使用旧版储存方式';
	l10nStrings.idbHtmlConfirmSave               = '保存存档到槽 ';
	l10nStrings.idbHtmlConfirmSaveOverwrite      = '覆盖存档到槽 ';
	l10nStrings.idbHtmlConfirmSaveIdNotMatch     = '存档 ID 不匹配，是否继续覆盖？';
	l10nStrings.idbHtmlConfirmDelete             = '删除存档槽： ';
	l10nStrings.idbHtmlConfirmDeleteAuto         = '自动存档槽';
	l10nStrings.idbHtmlConfirmLoad               = '加载存档槽： ';
	l10nStrings.idbHtmlConfirmLoadAuto           = '自动存档槽';
	l10nStrings.idbHtmlConfirmClearWARNING       = '警告：你确定要删除所有存档吗？';
	l10nStrings.idbHtmlConfirmClearAll           = '删除所有存档';
})();
