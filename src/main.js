const env = require('./.env.js');

Parse.Cloud.define('nicolog', (request, response) => {
    Parse.Cloud.httpRequest({
        method: 'POST',
        url: 'https://secure.nicovideo.jp/secure/login?site=niconico',
        body: `mail=${env.email}&password=${env.password}`,
    }).fail((httpResponse) => {
        Parse.Cloud.httpRequest({
            method: 'GET',
            url: 'http://www.nicovideo.jp/api/videoviewhistory/list',
            headers: {
                'Cookie': `user_session=${httpResponse.cookies.user_session.value}`,
            },
        }).done((httpResponse) => {
            const NiconicoWatchLog = Parse.Object.extend("NiconicoWatchLog");
            const logs = JSON.parse(httpResponse.text).history;

            logs.forEach((log, index) => {
                const watched_at = new Date(log.watch_date * 1000);

                new Parse.Query(NiconicoWatchLog).equalTo('watched_at', watched_at).find().done((results) => {
                    if (results.length == 0) {
                        const niconicoWatchLog = new NiconicoWatchLog();
                        niconicoWatchLog.set('title', log.title);
                        niconicoWatchLog.set('video_id', log.video_id);
                        niconicoWatchLog.set('watched_at', watched_at);
                        niconicoWatchLog.save().done(() => {
                            if (index + 1 == logs.length) {
                                response.success();
                            }
                        });
                    } else {
                        if (index + 1 == logs.length) {
                            response.success();
                        }
                    }
                });
            });
        });
    });
});

Parse.Cloud.job('nicolog', (request, status) => {
    Parse.Cloud.run('nicolog').done(() => {
        status.success();
    });
});
