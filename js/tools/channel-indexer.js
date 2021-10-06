const { printLine } = require('../../js/logSystem');
const { sqlPromiseSafe, sqlPromiseSimple } = require("../../js/sqlClient");
const md5 = require('md5');
const cron = require('node-cron');

async function generateArtistIndex () {
    if (!activeIndex) {
        const channels = await sqlPromiseSimple(`SELECT *
                                                 FROM kanmi_channels
                                                 WHERE classification NOT LIKE '%system%'
                                                   AND classification NOT LIKE '%timeline%'
                                                   AND parent != 'isparent'`, true);
        const customArtists = await sqlPromiseSimple(`SELECT *
                                                      FROM sequenzia_index_custom`, true);
        if (channels && channels.rows.length > 0) {
            let requests = channels.rows.reduce((promiseChain, ch) => {
                return promiseChain.then(() => new Promise(async (resolve) => {
                    let artistsNames = [];
                    let artists = [];
                    let proccssedEids = [];
                    let messages = await sqlPromiseSafe(`SELECT content_full, attachment_name, real_filename, eid
                                                         FROM kanmi_records
                                                         WHERE channel = ?
                                                         ORDER BY DATE DESC`, [ch.channelid], true)
                    if (messages && messages.rows.length > 0) {
                        const unique = (value, index, self) => {
                            return self.indexOf(value) === index
                        }

                        // Twitter Author Search
                        await messages.rows.filter(e => proccssedEids.indexOf(e.eid) === -1 && e.content_full.includes('Twitter Image** - ***') && e.content_full.includes(' (@')).forEach(m => {
                            const a = m.content_full.split(' (@')[1].split(')')[0].toLowerCase().trim()
                            const af = m.content_full.split(' (@')[0].split('***')[1].trim()

                            if (artistsNames.indexOf(a.toLowerCase()) === -1) {
                                artists.push({artist: a, name: af, type: 1, source: 1})
                                artistsNames.push(a.toLowerCase());
                                if (af) {
                                    artistsNames.push(af.toLowerCase());
                                }
                                proccssedEids.push(m.eid);
                            }
                        })
                        await messages.rows.filter(e => proccssedEids.indexOf(e.eid) === -1 && e.content_full.includes('Twitter Image** - ***') && e.content_full.includes(' (') && !e.content_full.includes(' (@')).forEach(m => {
                            const a = m.content_full.split(' (')[1].split(')')[0].toLowerCase().trim()
                            const af = m.content_full.split(' (')[0].split('***')[1]

                            if (artistsNames.indexOf(a.toLowerCase()) === -1) {
                                artists.push({artist: a, name: af, type: 1, source: 1})
                                artistsNames.push(a.toLowerCase());
                                if (af) {
                                    artistsNames.push(af.toLowerCase());
                                }
                                proccssedEids.push(m.eid);
                            }
                        })
                        await messages.rows.filter(e => proccssedEids.indexOf(e.eid) === -1 && e.content_full.includes('Twitter Image** - ***') && e.content_full.includes('***') && !e.content_full.includes(' (') && !e.content_full.includes(' (@')).forEach(m => {
                            const a = m.content_full.split('***')[1].toLowerCase().trim()
                            if (artistsNames.indexOf(a.toLowerCase()) === -1) {
                                artists.push({artist: a, type: 3, source: 1})
                                artistsNames.push(a.toLowerCase());
                                proccssedEids.push(m.eid);
                            }
                        })
                        // Pixiv User Search
                        await messages.rows.filter(e => proccssedEids.indexOf(e.eid) === -1 && e.content_full.includes('**🎆 ') && e.content_full.includes(') - ') && !e.content_full.includes('Twitter Image**')).forEach(m => {
                            try {
                                let content = m.content_full
                                if (m.content_full.includes('🧩 File : ')) {
                                    content = m.content_full.split("\n").filter((e, i) => {
                                        if (i > 1) {
                                            return e
                                        }
                                    }).join("\n")
                                }
                                if (content.includes('**✳️ Related to post')) {
                                    const a = content.split('**🎆')[1].split(') - ')[0].split(' (')[1].toLowerCase().trim()
                                    const ai = content.split('**🎆')[1].split(') - ')[1].split('**')[0].toLowerCase().trim()
                                    const af = content.split('**🎆')[1].split(' (')[0].trim()

                                    if (artistsNames.indexOf(a.toLowerCase()) === -1) {
                                        artists.push({artist: a, name: af, id: ai, type: 1, source: 2})
                                        artistsNames.push(a.toLowerCase());
                                        if (af) {
                                            artistsNames.push(af.toLowerCase());
                                        }
                                        proccssedEids.push(m.eid);
                                    }
                                } else {
                                    const a = content.split(') - ')[0].split(' (')[1].toLowerCase().trim()
                                    const ai = content.split(') - ')[1].split('**')[0].toLowerCase().trim()
                                    const af = content.split('**🎆 ')[1].split(' (')[0].trim()

                                    if (artistsNames.indexOf(a.toLowerCase()) === -1) {
                                        artists.push({artist: a, name: af, id: ai, type: 1, source: 2})
                                        artistsNames.push(a.toLowerCase());
                                        if (af) {
                                            artistsNames.push(af.toLowerCase());
                                        }
                                        proccssedEids.push(m.eid);
                                    }
                                }
                            } catch (e) {
                                console.error(e)
                                console.log(m.content_full)
                            }
                        })
                        await messages.rows.filter(e => proccssedEids.indexOf(e.eid) === -1 && e.content_full.includes('**🎆 ') && e.content_full.includes(')** :') && !e.content_full.includes('Twitter Image**')).forEach(m => {
                            try {
                                let content = m.content_full
                                if (m.content_full.includes('🧩 File : ')) {
                                    content = m.content_full.split("\n").filter((e, i) => {
                                        if (i > 1) {
                                            return e
                                        }
                                    }).join("\n")
                                }
                                const ai = content.split(' (')[1].split(')** ')[0].toLowerCase().trim()
                                const af = content.split('**🎆 ')[1].split(' (')[0].trim()

                                if (artistsNames.indexOf(ai.toLowerCase()) === -1) {
                                    artists.push({artist: ai, name: af, id: ai, type: 2, source: 2})
                                    artistsNames.push(ai.toLowerCase());
                                    if (af) {
                                        artistsNames.push(af.toLowerCase());
                                    }
                                    proccssedEids.push(m.eid);
                                }
                            } catch (e) {
                                console.error(e)
                                console.log(m.content_full)
                            }
                        })
                        // Flickr Search
                        await messages.rows.filter(e => proccssedEids.indexOf(e.eid) === -1 && e.content_full.includes('https://www.flickr.com') && !e.content_full.includes('Twitter Image')).forEach(m => {
                            try {
                                let content = m.content_full
                                if (m.content_full.includes('🧩 File : ')) {
                                    content = m.content_full.split("\n").filter((e, i) => {
                                        if (i > 1) {
                                            return e
                                        }
                                    }).join("\n")
                                }
                                if (m.content_full.includes('(')) {
                                    const a = content.split(')\n`')[0].split('(').pop().toLowerCase().trim()

                                    if (artistsNames.indexOf(a.toLowerCase()) === -1) {
                                        artists.push({artist: a, type: 1, source: 3})
                                        artistsNames.push(a.toLowerCase());
                                        proccssedEids.push(m.eid);
                                    }
                                }
                            } catch (e) {
                                console.error(e)
                                console.log(m.content_full)
                                console.log(m.content_full.split('('))
                            }
                        })
                        // Generic Downloads Search
                        await messages.rows.filter(e => proccssedEids.indexOf(e.eid) === -1 && e.content_full.includes('**🖼 Image** - ***') && e.content_full.includes("' by ") && !e.content_full.includes('Twitter Image**')).forEach(m => {
                            try {
                                let content = m.content_full
                                if (m.content_full.includes('🧩 File : ')) {
                                    content = m.content_full.split("\n").filter((e, i) => {
                                        if (i > 1) {
                                            return e
                                        }
                                    }).join("\n")
                                }
                                const a = content.split(' by ')[1].split('***')[0].toLowerCase().trim()

                                if (artistsNames.indexOf(a.toLowerCase()) === -1) {
                                    artists.push({artist: a, type: 3, source: 4})
                                    artistsNames.push(a.toLowerCase());
                                    proccssedEids.push(m.eid);
                                }
                            } catch (e) {
                                console.error(e)
                                console.log(m.content_full)
                            }
                        })

                        const at1 = artists.filter(a => a.type === 1)
                        const at2 = artists.filter(a => a.type === 2 && at1.filter(b => b.name === a.artist).length === 0 && at1.filter(b => b.artist === a.artist).length === 0)
                        const at3 = artists.filter(a => a.type === 3 && at1.filter(b => b.name === a.artist).length === 0 && at1.filter(b => b.artist === a.artist).length === 0)
                        artists = [...at1, ...at2, ...at3]

                        console.log(`Total Artists Found in ${ch.name}: ${artists.length}`)

                        let requests = artists.filter(unique).reduce((promiseChain, at) => {
                            return promiseChain.then(() => new Promise(async (resolveArtist) => {
                                const _cat = customArtists.rows.filter(a => a.artist === at.artist)
                                const _atl = messages.rows.filter(e => (e.content_full.toLowerCase().includes(at.artist.toLowerCase()) || (e.attachment_name && (e.attachment_name.toLowerCase().includes(`${at.artist.toLowerCase()}-`) || e.attachment_name.toLowerCase().includes(`${at.artist.toLowerCase()}_`))) || (e.real_filename && (e.real_filename.toLowerCase().includes(`${at.artist.toLowerCase()}-`) || e.real_filename.toLowerCase().includes(`${at.artist.toLowerCase()}_`)))) || (_cat.length > 0 && (e.content_full.toLowerCase().includes(_cat[0].search.toLowerCase()) || (e.attachment_name && (e.attachment_name.toLowerCase().includes(`${_cat[0].search.toLowerCase()}-`) || e.attachment_name.toLowerCase().includes(`${_cat[0].search.toLowerCase()}_`))) || (e.real_filename && (e.real_filename.toLowerCase().includes(`${_cat[0].search.toLowerCase()}-`) || e.real_filename.toLowerCase().includes(`${_cat[0].search.toLowerCase()}_`))))));
                                const _atc = _atl.length;
                                const _ati = _atl[0].eid;
                                const _ats = at.source;
                                const _atcn = at.type;
                                const _key = `${ch.channelid}-${md5(at.artist)}`;
                                let _search = `artist:${at.artist}`
                                let _url = null;
                                let _name = null;
                                let _artist = null;
                                if (at.source === 1) {
                                    if (at.type === 1) {
                                        _artist = at.artist;
                                        _name = at.name;
                                        _url = `https://twitter.com/${at.artist}/media`;
                                    } else if (at.type === 2) {
                                        _url = `https://twitter.com/${at.artist}/media`;
                                        _artist = at.artist;
                                    } else {
                                        _name = at.artist;
                                    }
                                } else if (at.source === 2) {
                                    if (at.type === 1) {
                                        _artist = at.artist;
                                        _name = at.name;
                                        _url = `https://www.pixiv.net/en/users/${at.id}`;
                                        _search = `artist:${at.id}`;
                                    } else if (at.type === 2) {
                                        _artist = at.id;
                                        _name = at.name;
                                        _url = `https://www.pixiv.net/en/users/${at.id}`;
                                        _search = `artist:${at.id}`;
                                    } else {
                                        _artist = at.artist;
                                        _name = at.name;
                                        _search = `artist:${at.id}`;
                                    }
                                } else if (at.source === 3) {
                                    _name = at.artist;
                                    _url = `https://www.flickr.com/photos/${at.artist}`;
                                } else if (at.source === 4) {
                                    _name = at.artist;
                                }
                                if (_cat.length > 0) {
                                    _search += ` OR artist:${_cat[0].search}`
                                }

                                const addedArtists = await sqlPromiseSafe(`INSERT INTO sequenzia_index_artists
                                                                           SET id         = ?,
                                                                               channelid  = ?,
                                                                               artist     = ?,
                                                                               name       = ?,
                                                                               count      = ?,
                                                                               search     = ?,
                                                                               url        = ?,
                                                                               last       = ?,
                                                                               source     = ?,
                                                                               confidence = ?
                                                                           ON DUPLICATE KEY UPDATE count      = ?,
                                                                                                   artist     = ?,
                                                                                                   name       = ?,
                                                                                                   last       = ?,
                                                                                                   source     = ?,
                                                                                                   confidence = ?`, [_key, ch.channelid, _artist, _name, _atc, _search, _url, _ati, _ats, _atcn, _atc, _artist, _name, _ati, _ats, _atcn], true);
                                if (!addedArtists) {
                                    console.error(`Failed to write artist data for ${_artist} // ${_name}!`);
                                }
                                resolveArtist();
                            }))
                        }, Promise.resolve());
                        requests.then(() => {
                            console.log(`Pared all artists for ${ch.name}!`);
                            resolve();
                        })
                    } else {
                        console.log(`No Messages Found for ${ch.name}`);
                        resolve();
                    }
                }))
            }, Promise.resolve());
            requests.then(() => {
                console.log('Index Generated!')
                activeIndex = false;
            })

        } else {
            console.log('Failed to get any photo channels')
        }
    }
}
let activeIndex = false;
async function initalize() {
    const clearTable = await sqlPromiseSimple(`TRUNCATE TABLE sequenzia_index_artists`, true)
    generateArtistIndex();
    activeIndex = true;
}
initalize();
cron.schedule('30 * * * *', generateArtistIndex)