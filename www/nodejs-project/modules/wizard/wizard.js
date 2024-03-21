
const { EventEmitter } = require('events')

class WizardUtils extends EventEmitter {
    constructor(){
        super()
    }
    isMobile(){
        return !!global.paths.cordova
    }
    validateURL(url){
		if(url && url.length > 11){
			let u = url.toLowerCase()
			if(u.substr(0, 4) == 'http' && u.indexOf('://') != -1 && u.indexOf('.') != -1){
				return true
			}
            let m = u.match(new RegExp('^([a-z]{1,6}):', 'i'))
            if(m && m.length > 1 && (m[1].length == 1 || m[1].toLowerCase() == 'file')){ // drive letter or file protocol
                return true
            } else {
                if(u.length >= 2 && u.startsWith('/') && u.charAt(1) != '/'){ // unix path
                    return true
                }
            }
		}
    }
}

class Wizard extends WizardUtils {
    constructor(){
        super()
        this.on('restart', () => {
            this.init().catch(console.error)
        })
    }
    async init(){
        if(!global.lang.isTrusted) {
            const options = require('../options')
            await options.showLanguageEntriesDialog()
        }
        await this.lists()
        await this.performance()
        this.active = false
        global.config.set('setup-completed', true)
    }
    async lists(){
        this.active = true
        if(!global.ALLOW_ADDING_LISTS) {
            if(!global.config.get('legal-notice-shown')) {
                global.config.set('legal-notice-shown', true)
                const opts = [
                    {template: 'question', text: global.lang.LEGAL_NOTICE, fa: 'fas fa-info-circle'},
                    {template: 'message', text: global.lang.ABOUT_LEGAL_NOTICE},
                    {template: 'option', text: 'OK', id: 'ok', fa: 'fas fa-check-circle'}
                ]
                await global.menu.dialog(opts, 'ok', true)
            }
            return true
        }
        let text = global.lang.ASK_IPTV_LIST_FIRST.split('. ').join(".\r\n"), def = 'ok', opts = [
            {template: 'question', text: global.paths.manifest.window.title, fa: 'fas fa-star'},
            {template: 'message', text},
            {template: 'option', text: global.lang.ADD_LIST, fa: 'fas fa-plus-square', id: 'ok'}
        ]
        if(global.ALLOW_COMMUNITY_LISTS){
            opts.push({template: 'option', text: global.lang.DONT_HAVE_LIST, details: global.lang.LOAD_COMMUNITY_LISTS, fa: 'fas fa-times-circle', id: 'sh'})
        } else {
            opts.push({template: 'option', text: global.lang.ADD_LATER, fa: 'fas fa-clock', id: 'no'})
        }
        let choose = await global.menu.dialog(opts, def, true)
        if(choose == 'no') {
            return true
        } else if(choose == 'sh') {
            return await this.communityMode()
        } else {
            return await this.input()
        }
    }
    async input(){
        this.active = true
        const { manager } = require('../lists')
        let err, ret = await manager.addListDialog(false).catch(e => err = e)
        console.log('ASKED', ret, global.traceback())
        if(typeof(err) != 'undefined'){
            global.displayErr(global.lang.INVALID_URL_MSG)
            return await this.lists()
        }
        return true
    }
    async communityMode(){  
        const { manager } = require('../lists')
        let err, ret = await manager.communityModeDialog().catch(e => err = e)
        console.warn('communityMode', err, ret)
        if(ret !== true) {
            return await this.lists()
        }
    }
    async performance(){
        const diag = require('../diagnostics')
        let ram = await diag.checkMemory().catch(console.error)
        if(typeof(ram) == 'number' && (ram / 1024) >= 2048){ // at least 2G of RAM
            return true
        }

        const options = require('../options')
        await options.performance(true)
        return true
    }
}

module.exports = Wizard
