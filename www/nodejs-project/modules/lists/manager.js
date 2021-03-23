
const Events = require('events'), fs = require('fs'), path = require('path'), async = require('async')
const sanitize = require('sanitize-filename'), LegalIPTV = require('../legal-iptv')

class Manager extends Events {
    constructor(parent){
        super()
        this.parent = parent
        this.emptyEntry = {name: global.lang.EMPTY, type: 'action', fa: 'fas fa-info-circle', class: 'entry-empty'}
        // this.listFaIcon = 'fas fa-satellite-dish'
        this.listFaIcon = 'fas fa-broadcast-tower'
        this.key = 'lists'
        this.openingList = false
        this.updatingLists = false
        this.legalIPTV = new LegalIPTV()
        global.ui.on('explorer-back', () => {
            if(this.openingList){
                global.osd.hide('list-open')
            }
        })
    }
    check(){
        if(!config.get('lists').length && !config.get('shared-mode-reach')){
            global.ui.emit('no-lists')
        }
    }
    get(){
        let r = false, lists = global.config.get(this.key) || []
        for(let i=0; i<lists.length; i++){
            if(!Array.isArray(lists[i])){
                delete lists[i]
                r = true
            }
        }
        if(r){
            lists = lists.filter(s => Array.isArray(s)).slice(0)
        }
        return lists
    }
    getURLs(){
        return new Promise((resolve, reject) => {
            resolve(this.get().map(o => { return o[1] }))
        })
    }
    getAll(){
        return new Promise((resolve, reject) => {
            this.allListsEntries().then(resolve).catch(err => {
                console.error(err)
                resolve([])
            })
        })
    }
    getAllURLs(){
        return new Promise((resolve, reject) => {
            this.getAll().then(opts => {
                resolve(opts.map(o => { return o.url }))
            }).catch(reject)
        })
    }
    add(url, name){
        return new Promise((resolve, reject) => {
            let isURL = this.validateURL(url), isFile = this.isLocal(url)
            console.log('name::add', name, url, isURL, isFile)
            if(!isFile && !isURL){
                return reject(global.lang.INVALID_URL_MSG)
            }
            let lists = this.get()
            for(let i in lists){
                if(lists[i][1] == url){
                    return reject(global.lang.LIST_ALREADY_ADDED)
                }
            }
            console.log('name::add', name, url)
            this.directListFetch(url, true).then(content => {
                let finish = name => {
                    console.log('name::final', name, url)
                    let lists = this.get()
                    lists.push([name, url])
                    global.config.set(this.key, lists)
                    resolve(true)
                }
                if(name){
                    finish(name)
                } else {
                    this.name(url, content).then(finish).catch(global.displayErr)
                }
            }).catch(reject)
        })
    }
    remove(url){
        let lists = global.config.get(this.key)
        if(typeof(lists)!='object'){
            lists = []
        }
        for(let i in lists){
            if(!Array.isArray(lists[i]) || lists[i][1] == url){
                delete lists[i]
            }
        }
        lists = lists.filter(item => {
            return item !== undefined
        })
        global.config.set(this.key, lists) 
        return lists
    }
    urls(){
        let urls = [], lists = this.get()
        for(let i=0; i<lists.length; i++){
            urls.push(lists[i][1])
        }
        return urls
    }
    has(url){
        return this.get().some(l => {
            return url == l[1]
        })
    }
    nameFromContent(content){
        if(content){
            let match = content.match(new RegExp('(iptv|pltv)\\-name *= *[\'"]([^\'"]+)'));
            if(match){
                return match[2]
            }
        }
    }
    nameFromSourceURL(url){
        let name
        if(url.indexOf('?') != -1){
            let qs = {}
            url.split('?')[1].split('&').forEach(s => {
                s = s.split('=')
                if(s.length > 1){
                    if(['name', 'dn', 'title'].includes(s[0])){
                        if(!name || name.length < s[1].length){
                            name = s[1]
                        }
                    }
                }
            })
        }
        if(name){
            name = decodeURIComponent(name)
            if(name.indexOf(' ') == -1 && name.indexOf('+') != -1){
                name = name.replaceAll('+', ' ')
            }
            return name
        }
        url = url.replace(new RegExp('^[a-z]*://'), '').split('/').filter(s => s.length)
        return (url[0].split('.')[0] + ' ' + url[url.length - 1]).replace(new RegExp('\\?.*$'), '')
    }
    name(url, content=''){
        return new Promise((resolve, reject) => {
            let name = this.getMeta(url, 'name')
            //console.log('name::get', name, url, content.length)
            if(name){
                resolve(name)
            } else {
                if(content){
                    name = this.nameFromContent(content)
                    //console.log('name::get', name)
                }
                if(typeof(name) != 'string' || !name){
                    name = this.nameFromSourceURL(url)
                    //console.log('name::get', name)
                }
                resolve(name)
            }
        })
    }
	isLocal(file){
		if(typeof(file) != 'string'){
			return
		}
		let m = file.match(new RegExp('^([a-z]{1,6}):', 'i'))
		if(m.length && (m[1].length == 1 || m[1].toLowerCase() == 'file')){ // drive letter or file protocol
			return true
		} else {
			if(file.length >= 2 && file.charAt(0) == '/' && file.charAt(1) != '/'){ // unix path
				return true
			}
		}
	}
    validateURL(value) {
        return typeof(value) == 'string' && value.length >= 13 && /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(value)
    }
	validate(content){
		return typeof(content) == 'string' && content.length >= 2048 && content.toLowerCase().indexOf('#ext') != -1
	}
    rename(url, name){
        this.setMeta(url, 'name', name)
    }
    merge(entries, ns){
        let es = entries.slice(0)
        ns.forEach(n => {
            let ok = false
            es.forEach(e => {
                if(!ok && e.url == n.url){
                    ok = true
                }
            })
            if(!ok){
                es.push(n)
            }
        })
        return es
    }
    setMeta(url, key, val){
        let lists = this.get()
        for(let i in lists){
            if(lists[i][1] == url){
                if(key == 'name'){
                    lists[i][0] = val
                } else {
                    let obj = lists[i][2] || {};
                    obj[key] = val
                    lists[i][2] = obj
                }
                global.config.set('lists', lists)
            }
        }
    }
    getMeta(url, key){
        let lists = this.get()
        for(let i in lists){
            if(lists[i][1] == url){
                let obj = lists[i][2] || {};
                return key ? (obj[key] ? obj[key] : null) : obj
            }
        }
    }
    addList(value){
        return new Promise((resolve, reject) => {
            global.osd.show(global.lang.PROCESSING, 'fa-mega spin-x-alt', 'add-list', 'persistent')
            this.add(value).then(() => {
                global.osd.show(global.lang.LIST_ADDED, 'fas fa-check-circle', 'add-list', 'normal')
                resolve(true)
            }).catch(err => {
                if(typeof(err) != 'string'){
                    err = String(err)
                }
                global.osd.show(err, 'fas fa-exclamation-circle', 'add-list', 'normal')
                reject(err)
            })
        })
    }
    updatedLists(name, fa){
        this.watchListsUpdating(false)
        this.updatingLists = false
        if(global.explorer && global.explorer.currentEntries && global.explorer.currentEntries.some(e => e.name == global.lang.UPDATING_LISTS)){
            global.explorer.refresh()
        }
        if(typeof(global.osd) != 'undefined'){
            global.osd.show(name, fa, 'update', 'normal')
        }
    }
    watchListsUpdating(enable){
        if(enable){
            let done, lp = -1
            if(!this.watchListsUpdatingTimer){
                this.watchListsUpdatingTimer = setInterval(() => {
                    this.parent.listsUpdateProgress().then(p => {
                        if(!done && this.watchListsUpdatingTimer){
                            if(p.done){
                                done = true
                                global.osd.hide('update')
                                clearInterval(this.watchListsUpdatingTimer)
                            } else if(typeof(global.osd) != 'undefined' && p.progress > lp){
                                lp = p.progress
                                global.osd.show(global.lang[p.firstRun? 'STARTING_LISTS' : 'UPDATING_LISTS'] +' '+ p.progress +'%', 'fa-mega spin-x-alt', 'update', 'persistent')
                            } 
                        }
                    }).catch(console.error)
                }, 1000)
            }
        } else {
            if(this.watchListsUpdatingTimer){
                clearInterval(this.watchListsUpdatingTimer)
                this.watchListsUpdatingTimer = false
            }
        }
    }
    updateLists(force, onErr){
        const n = global.config.get('shared-mode-reach')
        if(force === true || !global.activeLists.length || global.activeLists.length < n){
            this.updatingLists = true
            global.osd.show(global.lang.UPDATING_LISTS, 'fa-mega spin-x-alt', 'update', 'persistent')
            const cb = () => {
                this.watchListsUpdating(false)
                if(global.activeLists.length){ // one list available on index beyound meta watching list
                    this.updatedLists(global.lang.LISTS_UPDATED, 'fas fa-check-circle')
                    this.emit('lists-updated')
                } else {
                    if(n){
                        console.warn('data-fetch-fail', n, global.activeLists)
                        this.updatedLists(global.lang.DATA_FETCHING_FAILURE, 'fas fa-exclamation-circle')
                        if(typeof(onErr) == 'function'){
                            onErr()
                        }
                    } else {
                        this.updatedLists(global.lang.NO_LIST_PROVIDED, 'fas fa-exclamation-circle') // warn user if there's no lists
                    }
                }
            }
            this.getURLs().then(myUrls => {
                this.getAllURLs().then(urls => {
                    console.log('getAllURLs', urls.length)
                    urls = urls.filter(u => myUrls.indexOf(u) == -1)
                    this.parent.sync(myUrls, urls, n, global.channels.keywords()).then(ret => {
                        global.activeLists = ret
                    }).catch(err => {
                        global.displayErr(err)
                    }).finally(cb)
                    this.watchListsUpdating(true)
                }).catch(e => {
                    console.error('getAllURLs err', e)
                    cb()
                })
            }).catch(err => {
                global.displayErr(err)
                cb()
            })
        } else {
            if(global.activeLists.length){
                this.emit('lists-updated')
            }
        }
    }
    UIUpdateLists(force){
        if(global.Download.isNetworkConnected) {
            if(this.updatingLists) return
            this.updateLists(force === true, err => {
                console.error('lists-manager', err, isUILoaded)
                if(isUILoaded){ // if error and lists hasn't loaded
                    ui.emit('dialog', [
                        {template: 'question', text: lang.NO_COMMUNITY_LISTS_FOUND, fa: 'fas fa-users'},
                        {template: 'option', id: 'retry', fa: 'fas fa-redo', text: lang.RETRY},
                        {template: 'option', id: 'add-list', fa: 'fas fa-plus-square', text: lang.ADD_LIST}
                    ], 'lists-manager', 'retry') 
                }
            })
        } else {
            global.ui.emit('info', global.lang.NO_INTERNET_CONNECTION, global.lang.NO_INTERNET_CONNECTION)
        }
    }
    noListsRetryDialog(){
        if(global.Download.isNetworkConnected) {
            global.ui.emit('dialog', [
                {template: 'question', text: global.lang.NO_COMMUNITY_LISTS_FOUND, fa: 'fas fa-users'},
                {template: 'option', id: 'retry', fa: 'fas fa-redo', text: global.lang.RETRY},
                {template: 'option', id: 'add-list', fa: 'fas fa-plus-square', text: global.lang.ADD_LIST}
            ], 'lists-manager', 'retry') 
        } else {
            global.ui.emit('info', global.lang.NO_INTERNET_CONNECTION, global.lang.NO_INTERNET_CONNECTION)
        }
    }
    noListsEntry(){        
        if(global.config.get('shared-mode-reach') > 0){
            return this.noListsRetryEntry()
        } else {
            return {
                name: global.lang.NO_LISTS_ADDED,
                fa: 'fas fa-plus-square',
                type: 'action',
                action: () => {
                    global.explorer.open(global.lang.IPTV_LISTS).catch(console.error)
                }
            }
        }
    }
    noListsRetryEntry(){
        return {
            name: global.lang.LOAD_COMMUNITY_LISTS,
            fa: 'fas fa-plus-square',
            type: 'action',
            action: () => this.UIUpdateLists(true)
        }
    }
    addListEntry(){
        return {name: global.lang.ADD_LIST, fa: 'fas fa-plus-square', type: 'input', action: (data, value) => {                
            if(value){
                this.addList(value).catch(console.error)
            }
        }, question: global.lang.ASK_IPTV_LIST, placeholder: 'http://'}
    }
    myListsEntry(){
        return {name: global.lang.MY_LISTS, details: global.lang.IPTV_LISTS, type: 'group', renderer: () => {
            return new Promise((resolve, reject) => {
                let lists = this.get(), opts = []
                async.eachOfLimit(lists, 8, (data, i, done) => {
                    let name = data[0], url = data[1]
                    this.parent.getListMetaValue(url, 'name', _name => {
                        if(_name){
                            name = _name
                        }
                        opts.push({
                            name, 
                            url,
                            fa: 'fas fa-satellite-dish', 
                            type: 'group', 
                            renderer: data => {
                                return new Promise((resolve, reject) => {
                                    let es
                                    this.parent.getList(url, true).then(ret => {
                                        es = ret
                                    }).catch(err => {
                                        global.displayErr(err)
                                    }).finally(() => {
                                        if(es.length){
                                            es = this.parent.parentalControl.filter(es)
                                            es = this.parent.tools.deepify(es, url)  
                                        } else {
                                            es = [this.emptyEntry]
                                        }
                                        es.unshift({name: global.lang.REMOVE_LIST, fa: 'fas fa-minus-square', type: 'action', url, action: this.removeList.bind(this)})
                                        resolve(es)
                                    })
                                })
                            }
                        })
                        done()
                    })
                }, () => {
                    opts.push(this.addListEntry())
                    if(!lists.length){
                        opts.push({
                            name: global.lang.NO_LIST,
                            fa: 'fas fa-info-circle',
                            type: 'action',
                            action: () => {}
                        })
                    }
                    resolve(opts)
                })
            })
        }}
    }
    epgOptionsEntries(){
        return new Promise((resolve, reject) => {
            let options = [], epgs = []
            this.parent.foundEPGs().then(urls => {
                epgs = epgs.concat(urls)
            }).catch(console.error).finally(() => {
                let activeEPG = global.config.get('epg')
                if(activeEPG && !epgs.includes(activeEPG)){
                    epgs.push(activeEPG)
                }
                options = epgs.sort().map(url => {
                    let name = this.parent.manager.nameFromSourceURL(url)
                    return {
                        name,
                        type: 'action',
                        fa: 'fas fa-th-large',
                        prepend: (url == activeEPG) ? '<i class="fas fa-check-circle faclr-green"></i> ' : '',
                        action: () => {
                            if(url == global.config.get('epg')){
                                global.config.set('epg', '')
                                global.channels.load()
                                global.explorer.refresh()
                            } else {
                                this.setEPG(url)
                            }
                        }
                    }
                })
                options.push({name: global.lang.ADD, fa: 'fas fa-plus-square', type: 'action', action: () => {
                    global.ui.emit('prompt', global.lang.EPG, 'http://.../epg.xml', global.config.get('epg'), 'set-epg', false, global.channels.epgIcon)
                }})
                options.push({
                    name: global.lang.IMPORT_EPG_CHANNELS,
                    type: 'check',
                    action: (e, checked) => {
                        global.config.set('epg-channels-list', checked)
                        global.channels.load()
                    }, 
                    checked: () => {
                        return global.config.get('epg-channels-list')
                    }
                })
                resolve(options)
            })
        })
    }
    setEPG(url, ui){
        console.log('SETEPG', url)
        if(typeof(url) == 'string'){
            if(!url || this.validateURL(url)){
                if(url != global.config.get('epg')){
                    global.config.set('epg', url)
                    global.explorer.refresh()
                }
                this.loadEPG(url, true).then(() => {
                    let doImportChannelsList = () => { // user changed his mind in the meantime
                        return url == global.config.get('epg') && global.config.get('epg-channels-list')
                    }
                    let refresh = () => {
                        if(global.explorer.path.indexOf(global.lang.EPG) != -1 || global.explorer.path.indexOf(global.lang.CHANNELS) != -1){
                            global.explorer.refresh()
                        }
                    }
                    if(!url){
                        global.channels.updateCategoriesCacheKey()
                        global.channels.load()
                        refresh()
                    } else if(doImportChannelsList()){
                        global.lists.epgChannelsList().then(list => {
                            if(doImportChannelsList()){
                                console.log('CHANNELS LIST IMPORT', list)
                                global.channels.updateCategoriesCacheKey()
                                global.channels.setCategories(list, true)
                                refresh()
                            }
                        }).catch(err => {
                            console.error(err)
                            global.osd.show(global.lang.IMPORT_EPG_CHANNELS_FAILED, 'fas fa-exclamation-circle faclr-red', 'epg', 'normal')
                            global.config.set('epg-channels-list', false)
                            refresh()
                        })
                    }
                }).catch(err => console.error(err))
            } else {
                if(ui){
                    global.osd.show(global.lang.INVALID_URL, 'fas fa-exclamation-circle faclr-red', 'epg', 'normal')
                }
            }
        }
    }
    loadEPG(url, ui){
        return new Promise((resolve, reject) => {
            if(!url){
                url = global.config.get('epg')
            }
            if(url){
                let refresh = () => {
                    if(global.explorer.path.indexOf(global.lang.EPG) != -1 || global.explorer.path.indexOf(global.lang.CHANNELS) != -1){
                        global.explorer.refresh()
                    }
                }
                if(ui){
                    global.osd.show(global.lang.EPG_AVAILABLE_SOON, 'fas fa-check-circle', 'epg', 'normal')
                }
                console.log('loadEPG', url)
                this.parent.loadEPG(url).then(() => {
                    if(ui){
                        global.osd.show(global.lang.EPG_LOAD_SUCCESS, 'fas fa-check-circle', 'epg', 'normal')
                    }
                    resolve(true)
                }).catch(err => {
                    global.osd.show(global.lang.EPG_LOAD_FAILURE + ': ' + String(err), 'fas fa-check-circle', 'epg', 'normal')
                    reject(err)
                }).finally(refresh)
            }
        })
    }
    listsEntries(){
        return new Promise((resolve, reject) => {
            let options = [], lists = this.get()
            options.push(this[lists.length ? 'myListsEntry' : 'addListEntry']())
            options.push(this.listSharingEntry())
            options.push({name: global.lang.EPG, fa: global.channels.epgIcon, type: 'group', renderer: this.epgOptionsEntries.bind(this)})
            resolve(options)
        })
    }
    listSharingEntry(){
        return {
            name: global.lang.SHARED_MODE, type: 'group', fa: 'fas fa-users', 
            renderer: () => {
                return new Promise((resolve, reject) => {
                    let options = [
                        {name: global.lang.ENABLE, type: 'check', action: (data, checked) => {
                            if(checked){
                                global.ui.emit('dialog', [
                                    {template: 'question', text: global.lang.SHARED_MODE, fa: 'fas fa-users'},
                                    {template: 'message', text: global.lang.ASK_COMMUNITY_LIST},
                                    {template: 'option', id: 'back', fa: 'fas fa-times-circle', text: global.lang.BACK},
                                    {template: 'option', id: 'agree', fa: 'fas fa-check-circle', text: global.lang.I_AGREE}
                                ], 'lists-manager', 'back')                
                            } else {
                                global.config.set('shared-mode-reach', 0)
                                global.explorer.refresh()
                            }
                        }, checked: () => {
                            return global.config.get('shared-mode-reach') > 0
                        }}
                    ]
                    if(global.config.get('shared-mode-reach') > 0){
                        options.push({name: global.lang.COMMUNITY_LISTS, fa: 'fas fa-users', type: 'group', renderer: this.communityListsEntries.bind(this)})
                        options.push({name: global.lang.ALL_LISTS, fa: 'fas fa-users', type: 'group', renderer: this.allListsEntries.bind(this)})
                    }
                    resolve(options)
                })
            }
        }
    }
    listsEntriesForRemoval(){
        return new Promise((resolve, reject) => {
            let lists = this.get(), entries = []
            if(lists.length){
                lists.forEach((source, i) => {
                    entries.push({
                        name: global.lang.REMOVE.toUpperCase() +': '+ path.basename(lists[i][0]), 
                        fa: 'fas fa-minus-square', 
                        type: 'action', 
                        url: lists[i][1], 
                        action: this.removeList.bind(this)
                    })
                })
            } else {
                entries.push(this.emptyEntry)
            }
            resolve(entries)
        })
    }
    removeList(data){
        global.explorer.suspendRendering()
        this.remove(data.url)
        global.osd.show(global.lang.LIST_REMOVED, 'fas fa-info-circle', 'options', 'normal')    
        global.explorer.resumeRendering()
        global.explorer.back(2, true)    
    }
    directListRenderer(data){
        console.warn('DIRECT', data, traceback())
        return new Promise((resolve, reject) => {
            let v = Object.assign({}, data), isMine = global.activeLists.my.includes(v.url), isCommunity = global.activeLists.community.includes(v.url)
            delete v.renderer
            let onerr = err => {
                console.error(err)
                reject(global.lang.LIST_OPENING_FAILURE)
            }
            let cb = list => {
                if(list.length){
                    if(this.has(v.url)){
                        list.unshift({
                            type: 'action',
                            name: global.lang.LIST_ALREADY_ADDED,
                            details: global.lang.REMOVE_LIST, 
                            fa: 'fas fa-minus-square',
                            action: () => {             
                                this.remove(v.url)
                                global.osd.show(global.lang.LIST_REMOVED, 'fas fa-info-circle', 'options', 'normal')
                                global.explorer.refresh()
                            }
                        })
                    } else {
                        list.unshift({
                            type: 'action',
                            fa: 'fas fa-plus-square',
                            name: global.lang.ADD_TO.format(global.lang.MY_LISTS),
                            action: () => {
                                this.addList(v.url).catch(console.error).finally(() => global.explorer.refresh())
                            }
                        })
                    }
                } else {
                    list = [this.emptyEntry]
                }
                console.warn('DIRECT', list, JSON.stringify(list[0]))
                resolve(list)
            }
            console.warn('DIRECT', isMine, isCommunity)
            if(isMine || isCommunity){
                this.parent.directListRenderer(v).then(cb).catch(onerr)
            } else {   
                const tmpFile = path.join(global.paths.temp, sanitize(v.url) +'.tmp')
                fs.stat(tmpFile, (err, stat) => {
                    if(err || !stat.size){
                        const stream = fs.createWriteStream(tmpFile, {flags:'w'})           
                        const download = new global.Download({
                            url: v.url,
                            keepalive: false,
                            retries: 5,
                            headers: {
                                'accept-charset': 'utf-8, *;q=0.1'
                            },
                            followRedirect: true
                        })
                        download.on('progress', progress => {
                            global.osd.show(global.lang.OPENING_LIST +' '+ progress +'%', 'fa-mega spin-x-alt', 'list-open', 'persistent')
                        })
                        download.on('response', console.warn)
                        download.on('error', console.warn)
                        download.on('data', chunk => stream.write(chunk))
                        download.on('end', () => {
                            stream.on('finish', () => {
                                this.parent.directListFileRenderer(tmpFile, v.url).then(cb).catch(onerr)
                            })
                            stream.end()
                        })
                    } else {
                        this.parent.directListFileRenderer(tmpFile, v.url).then(cb).catch(onerr)
                    }
                })
            }
        })
    }
    directListFetch(url, saveCache){
        console.warn('DIRECTFETCH', url)
        return new Promise((resolve, reject) => {
            if(!url){
                return reject(global.lang.INVALID_URL_MSG)
            }
            const onErr = err => {
                console.error('error', err, global.traceback())
                reject(global.lang.LIST_OPENING_FAILURE)
                global.osd.hide('add-list')
            }
            const onContent = content => {
                //console.log('content', content)
                content = String(content)
                if(this.validate(content)){
                    if(saveCache){
                        const cacheKey = 'data-' + url, cacheTimeKey = 'time-' + url
                        global.rstorage.set(cacheKey, content, 30 * (24 * 3600))
                        global.rstorage.set(cacheTimeKey, global.time(), 30 * (24 * 3600))
                    } 
                    resolve(content)
                    global.osd.hide('add-list')
                } else {
                    onErr(this.parent.INVALID_URL_MSG)
                }
            }
            const download = new global.Download({
                url,
                keepalive: false,
                retries: 3,
                headers: {
                    'accept-charset': 'utf-8, *;q=0.1'
                },
                followRedirect: true
            })
            download.on('progress', progress => {
                global.osd.show(global.lang.OPENING_LIST +' '+ progress +'%', 'fa-mega spin-x-alt', 'add-list', 'persistent')
            })
            download.on('error', err => {
                console.warn('Download error', err)
            })
            download.on('end', onContent)
        })
    }
    communityLists(){
        return new Promise((resolve, reject) => {
            let limit = global.config.get('shared-mode-reach')
            if(limit){
                this.allLists().then(lists => {
                    lists = lists.slice(0, limit)
                    resolve(lists)
                }).catch(e => {
                    console.error(e)
                    resolve([])
                })
            } else {
                resolve([])
            }
        })
    }
    communityListsEntries(){
        return new Promise((resolve, reject) => {
            if(this.updatingLists){
                return resolve([{
                    name: global.lang.UPDATING_LISTS, 
                    fa: 'fa-mega spin-x-alt',
                    type: 'action',
                    action: () => {
                        global.explorer.refresh()
                    }
                }])
            }
            this.parent.getLists().then(active => {
                global.activeLists = active
                if(active.community.length){
                    let opts = []
                    async.eachOfLimit(active.community, 8, (url, i, done) => {
                        this.parent.getListMetaValue(url, 'name', name => {
                            if(!name) {
                                name = this.nameFromSourceURL(url)
                            }
                            opts.push({
                                name,
                                fa: 'fas fa-satellite-dish',
                                type: 'group',
                                url,
                                renderer: this.directListRenderer.bind(this)
                            })
                            done()
                        })
                    }, () => {
                        resolve(opts)
                    })
                } else {
                    resolve([this.noListsRetryEntry()])
                }
            }).catch(reject)
        })
    }
    allLists(){
        return new Promise((resolve, reject) => {
            let limit = global.config.get('shared-mode-reach')
            if(limit){
                global.cloud.get('sources').then(s => {
                    resolve(s.map(e => e.url))
                }).catch(e => {
                    console.error(e)
                    reject(e)
                })
            } else {
                resolve([])
            }
        })
    }
    allListsEntries(){
        return new Promise((resolve, reject) => {
            let limit = global.config.get('shared-mode-reach')
            if(limit){
                global.cloud.get('sources', false, 30000).then(lists => {
                    if(Array.isArray(lists) && lists.length){
                        async.eachOfLimit(lists, 8, (v, i, cb) => {
                            this.name(v.url, false).then(name => {
                                if(typeof(v.label) == 'string'){
                                    v.details = v.label
                                    delete v.label
                                }
                                v.name = name
                                v.fa = 'fas fa-satellite-dish'
                                if(v.details && v.details.indexOf('{') != -1){
                                    v.details = v.details.format(global.lang.USER, global.lang.USERS)
                                }
                                v.renderer = data => {
                                    return new Promise((resolve, reject) => {
                                        this.openingList = true
                                        global.osd.show(global.lang.OPENING_LIST, 'fa-mega spin-x-alt', 'list-open', 'persistent')
                                        this.directListRenderer(data).then(ret => {
                                            resolve(ret)
                                        }).catch(err => {
                                            reject(err)
                                        }).finally(() => {
                                            this.openingList = false
                                            global.osd.hide('list-open')
                                        })
                                    })
                                }
                                lists[i] = v
                            }).catch(err => {
                                global.displayErr(err)
                            }).finally(cb)
                        }, () => {
                            //console.log('sources', lists)
                            if(lists.length){
                                if(global.config.get('parental-control-policy') == 'block'){
                                    lists = this.parent.parentalControl.filter(lists)
                                }
                            } else {
                                lists = [this.noListsRetryEntry()]
                            }
                            resolve(lists)
                        })
                    } else {
                        console.error('no community lists found', lists)
                        reject('no community lists found')
                    }
                }).catch(e => {
                    console.error('no sources found', e)
                    reject(e)
                })
            } else {
                resolve([])
            }
        })
    }
    relevantKeywords(){
        return new Promise(resolve => {
            let keywords = []
            if(global.histo){
                ['histo', 'bookmarks'].forEach(k => {
                    global[k].get().forEach(e => {
                        keywords = keywords.concat(global.channels.entryTerms(e))
                    })
                })
            }
        })
    }
    hook(entries, path){
        return new Promise((resolve, reject) => {
            if(path == '' && !entries.some(e => e.name == global.lang.IPTV_LISTS)){
                entries.push({name: global.lang.IPTV_LISTS, fa: 'fas fa-list', type: 'group', renderer: this.listsEntries.bind(this)})
            }
            this.legalIPTV.hook(entries, path).then(resolve).catch(reject)
        })
    }
}

module.exports = Manager

