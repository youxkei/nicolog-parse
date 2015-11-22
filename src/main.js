const env = require('./.env.js');

Parse.Cloud.define('nicolog', (request, response) => {
    const NiconicoSession = Parse.Object.extend("NiconicoSession");
    const NiconicoWatchLog = Parse.Object.extend("NiconicoWatchLog");

    new Parse.Query(NiconicoSession).find()
    .done(niconicoSessionObjects => {
        if (niconicoSessionObjects.length > 0) {
            return Parse.Promise.as(niconicoSessionObjects[0].get('session'));
        } else {
            return Parse.Promise.error();
        }
    })
    .fail(() => {
        return Parse.Cloud.httpRequest({
            method: 'POST',
            url: 'https://secure.nicovideo.jp/secure/login?site=niconico',
            body: `mail=${env.email}&password=${env.password}`,
        }).fail(httpResponse => {
            const niconicoSessionObject = new NiconicoSession();
            niconicoSessionObject.set('session', httpResponse.cookies.user_session.value);
            return niconicoSessionObject.save();
        }).done(niconicoSessionObject => {
            return Parse.Promise.as(niconicoSessionObject.get('session'));
        });
    })
    .done(niconicoSession => {
        return Parse.Cloud.httpRequest({
            method: 'GET',
            url: 'http://www.nicovideo.jp/api/videoviewhistory/list',
            headers: {
                'Cookie': `user_session=${niconicoSession}`,
            },
        })
    })
    .done(httpResponse => {
        const json = JSON.parse(httpResponse.text);
        if (json.status === 'ok') {
            return Parse.Promise.as(json.history);
        } else {
            return Parse.Promise.error();
        }
    })
    .fail(() => {
        return Parse.Promise.when(
            Parse.Cloud.httpRequest({
                method: 'POST',
                url: 'https://secure.nicovideo.jp/secure/login?site=niconico',
                body: `mail=${env.email}&password=${env.password}`,
            }).fail(httpResponse => Parse.Promise.as(httpResponse.cookies.user_session.value)),
            new Parse.Query(NiconicoSession).find()
        )
        .done((niconicoSession, niconicoSessionObjects) => {
            if (niconicoSessionObjects.length > 0) {
                niconicoSessionObjects[0].set('session', niconicoSession);
                return niconicoSessionObjects[0].save();
            } else {
                return Parse.Promise.error('なぜかデータベースにセッションが入っていません');
            }
        })
        .done(niconicoSessionObject => {
            return Parse.Promise.as(niconicoSessionObject.get('session'));
        })
        .done(niconicoSession => {
            return Parse.Cloud.httpRequest({
                method: 'GET',
                url: 'http://www.nicovideo.jp/api/videoviewhistory/list',
                headers: {
                    'Cookie': `user_session=${niconicoSession}`,
                },
            })
        })
        .done(httpResponse => {
            const json = JSON.parse(httpResponse.text);
            if (json.status === 'ok') {
                return Parse.Promise.as(json.history);
            } else {
                return Parse.Promise.error('なぜか新しいセッションで視聴履歴を取得できません');
            }
        })
    })
    .done(logs => {
        const promises = logs.map(log => {
            const watched_at = new Date(log.watch_date * 1000);

            return new Parse.Query(NiconicoWatchLog).equalTo('watched_at', watched_at).find()
            .done(niconicoWatchLogObjects => {
                if (niconicoWatchLogObjects.length === 0) {
                    return Parse.Promise.as();
                } else {
                    return Parse.Promise.error(`already stored:${log.title}`);
                }
            })
            .done(() => {
                const niconicoWatchLogObject = new NiconicoWatchLog();
                niconicoWatchLogObject.set('title', log.title);
                niconicoWatchLogObject.set('video_id', log.video_id);
                niconicoWatchLogObject.set('watched_at', watched_at);
                return niconicoWatchLogObject.save();
            })
            .done(() => {
                return Parse.Promise.as(`stored:${log.title}`);
            })
            .always((msg) => Parse.Promise.as(msg));
        });
        return Parse.Promise.when(promises);
    })
    .done((...msgs) => response.success(msgs))
    .fail(msg => response.error(msg));
});

Parse.Cloud.job('nicolog', (request, status) => {
    Parse.Cloud.run('nicolog').done(() => {
        status.success();
    });
});
