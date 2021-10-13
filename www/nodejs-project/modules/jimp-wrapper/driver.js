const fs = require('fs')

class JimpDriver {
	constructor(){}	
    load(){
        if(typeof(this.jimp) == 'undefined'){
            this.jimp = require('jimp')
            this.jimpCustomAutocrop = require(APPDIR +'/modules/jimp-autocrop-custom')
        }
    }
    isAlpha(image){
        let alphas = [], corners = [
            [0, 0],
            [0, image.bitmap.width - 1],
            [image.bitmap.height - 1, 0],
            [image.bitmap.height - 1, image.bitmap.width - 1]
        ], valid = corners.some(coords => {
            let px = this.jimp.intToRGBA(image.getPixelColor(coords[0], coords[1]))
            if(px){
                alphas.push(px.a)
                return px.a < 255
            }
        })
        // if(!valid) console.log('not transparent image, corners: ' + JSON.stringify(corners) + ', alphas: ' + JSON.stringify(alphas))
        return valid
    }
    transform(file, opts){
        const maxWidth = 500, maxHeight = 500
        let changed
        opts = Object.assign({autocrop: true, shouldBeAlpha: 0, resize: false}, opts)
        return new Promise((resolve, reject) => {
            this.load()
            this.jimp.read(file).then(image => {
                if(image.bitmap.width > 0 && image.bitmap.height > 0) {
                    let alpha = this.isAlpha(image)
                    if(opts.shouldBeAlpha == 2 && !alpha){
                        return reject('not an alpha image')
                    }
                    if(opts.autocrop){
                        image.autocrop = this.jimpCustomAutocrop
                        image = image.autocrop({tolerance: 0.002})
                        if(image.autoCropped) changed = true
                    }
                    if(opts.resize){
                        if(image.bitmap.width > maxWidth){
                            const start = (new Date()).getTime()
                            image = image.resize(maxWidth, this.jimp.AUTO)
                            console.log('JIMP resizeX', (new Date()).getTime() - start)
                            changed = true
                        }
                        if(image.bitmap.height > maxHeight) {
                            const start = (new Date()).getTime()
                            image = image.resize(this.jimp.AUTO, maxHeight)
                            console.log('JIMP resizeX', (new Date()).getTime() - start)
                            changed = true
                        }
                    }
                    if(changed){
                        image.write(file, () => resolve({file, alpha, changed}))
                    } else {
                        resolve({file, alpha, changed})
                    }
                } else {
                    reject('invalid image** ' + image.bitmap.width +'x'+ image.bitmap.height)
                }
                image = null
            }).catch(err => {
                console.error('Jimp failed to open', err, file)
                reject('invalid image*')
            })
        })
    }
    colors(file){
        return new Promise((resolve, reject) => {
            this.load()
            this.jimp.read(file).then(image => {
                image = image.resize(36, 36)
                const ColorThief = require('color-thief-jimp'), palette = ColorThief.getPalette(image, 24)
                const colors = Array.isArray(palette) ? palette.map(px => {
                    return {r: px[0], g: px[1], b: px[2]}
                }) : []
                resolve(colors)
            }).catch(err => {
                reject(err)
            })
        })
    }
}

module.exports = JimpDriver
