/***********************************************************************************************************************

	l10n/strings.js

	Copyright © 2013–2021 Thomas Michael Edwards <thomasmedwards@gmail.com>. All rights reserved.
	Use of this source code is governed by a BSD 2-clause "Simplified" License, which may be found in the LICENSE file.

***********************************************************************************************************************/
/* eslint-disable max-len, prefer-template */

/*
	ATTENTION TRANSLATORS

	Please use the `locale/l10n-template.js` file, from the root of the repository,
	as the template for your translation rather than this file.

	SEE: https://github.com/tmedwards/sugarcube-2/tree/develop/locale
*/
var l10nStrings = { // eslint-disable-line no-unused-vars, no-var
	/*
		General.
	*/
	identity : 'game',
	aborting : 'Aborting',
	cancel   : 'Cancel',
	close    : 'Close',
	ok       : 'OK',

	/*
		Errors.
	*/
	errorTitle              : 'Error',
	errorToggle             : 'Toggle the error view',
	errorNonexistentPassage : 'the passage "{passage}" does not exist', // NOTE: `passage` is supplied locally
	errorSaveDiskLoadFailed : 'failed to load save file from disk',
	errorSaveMissingData    : 'save is missing required data. Either the loaded file is not a save or the save has become corrupted',
	errorSaveIdMismatch     : 'save is from the wrong {identity}',

	/*
		Warnings.
	*/
	_warningIntroLacking  : 'Your browser either lacks or has disabled',
	_warningOutroDegraded : ', so this {identity} is running in a degraded mode. You may be able to continue, however, some parts may not work properly.',
	warningNoWebStorage   : '{_warningIntroLacking} the Web Storage API{_warningOutroDegraded}',
	warningDegraded       : '{_warningIntroLacking} some of the capabilities required by this {identity}{_warningOutroDegraded}',

	/*
		Debug bar.
	*/
	debugBarToggle      : 'Toggle the debug bar',
	debugBarNoWatches   : '\u2014 no watches set \u2014',
	debugBarAddWatch    : 'Add watch',
	debugBarDeleteWatch : 'Delete watch',
	debugBarWatchAll    : 'Watch all',
	debugBarWatchNone   : 'Delete all',
	debugBarLabelAdd    : 'Add',
	debugBarLabelWatch  : 'Watch',
	debugBarLabelTurn   : 'Turn', // (noun) chance to act (in a game), moment, period
	debugBarLabelViews  : 'Views',
	debugBarViewsToggle : 'Toggle the debug views',
	debugBarWatchToggle : 'Toggle the watch panel',

	/*
		UI bar.
	*/
	uiBarToggle   : 'Toggle the UI bar',
	uiBarBackward : 'Go backward within the {identity} history',
	uiBarForward  : 'Go forward within the {identity} history',
	uiBarJumpto   : 'Jump to a specific point within the {identity} history',

	/*
		Jump To.
	*/
	jumptoTitle       : 'Jump To',
	jumptoTurn        : 'Turn', // (noun) chance to act (in a game), moment, period
	jumptoUnavailable : 'No jump points currently available\u2026',

	/*
		Saves.
	*/
	savesTitle       : 'Saves',
	savesDisallowed  : 'Saving has been disallowed on this passage.',
	savesIncapable   : '{_warningIntroLacking} the capabilities required to support saves, so saves have been disabled for this session.',
	savesLabelAuto   : 'Autosave',
	savesLabelDelete : 'Delete',
	savesLabelExport : 'Save to Disk\u2026',
	savesLabelImport : 'Load from Disk\u2026',
	savesLabelLoad   : 'Load',
	savesLabelClear  : 'Delete All Saves',
	savesLabelSave   : 'Save',
	savesLabelSlot   : 'Slot',
	savesUnavailable : 'No save slots found\u2026',
	savesUnknownDate : 'unknown',

	/*
		idb related
	*/
	savesDisallowedReplay     : 'The scene viewer is currently in use, preventing the use of the save system.',
	savesExportReminder       : 'Saves here will be lost if your browser cache is cleared. Exporting is recommended to prevent the loss of saves from occurring.',
	savesHeaderSaveLoad       : 'Save/Load',
	savesHeaderIDName         : 'ID/Name',
	savesHeaderDetails        : 'Details',
	savesDescTitle            : 'Title: ',
	savesDescName             : 'Save Name: ',
	savesDescId               : 'Save Id: ',
	savesDescDate             : ', Date: ',
	savesPagerJump            : ' Jump to most recent manual save ',
	savesPagerPage            : 'Page: ',
	savesPagerSavesPerPage    : ' Saves per page: ',
	savesOptionsConfirmOn     : ' Require confirmation on: ',
	savesOptionsUseLegacy     : ' Use old legacy save storage: ',
	savesWarningSaveOnSlot    : 'Save on slot ',
	savesWarningOverwriteSlot : 'Overwrite save in slot ',
	savesWarningOverwriteID   : 'Save ID does not match, continue with overwrite?',
	savesWarningDeleteInSlot  : 'Delete save in slot ',
	savesWarningLoad          : 'Load slot ',
	savesWarningDeleteAll     : 'WARNING - DO YOU REALLY WANT TO DELETE ALL SAVES?',


	/*
		Settings.
	*/
	settingsTitle : 'Settings',
	settingsOff   : 'Off',
	settingsOn    : 'On',
	settingsReset : 'Reset to Defaults',

	/*
		Restart.
	*/
	restartTitle  : 'Restart',
	restartPrompt : 'Are you sure that you want to restart? Unsaved progress will be lost.',

	/*
		Share.
	*/
	shareTitle : 'Share',

	/*
		Alert.
	*/
	alertTitle : 'Alert',

	/*
		Autoload.
	*/
	autoloadTitle  : 'Autoload',
	autoloadCancel : 'Go to start',
	autoloadOk     : 'Load autosave',
	autoloadPrompt : 'An autosave exists. Load it now or go to the start?',

	/*
		Macros.
	*/
	macroBackText   : 'Back',  // (verb) rewind, revert
	macroReturnText : 'Return' // (verb) go/send back
};
