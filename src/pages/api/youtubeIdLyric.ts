export default async function handler(req: any, res: any) {
    try {
        /**
         * More than one:
         * Request URL: https://content-youtube.googleapis.com/youtube/v3/videos?id=poCqEpwVfhg&id=qcIhUoBZaHg&key=AIzaSyAa8yy0GdcGPHdtD083HiGGx_S0vMPScDM
         */
        const result = await fetch("https://www.googleapis.com/youtube/v3/videos?id=poCqEpwVfhg&part=statistics&key=AIzaSyAJD8XmCzkY1qEkO15U5GlOWpanJymT5FM")
        const data = await result.json()
        res.status(200).json({videos: data.items})

    } catch (err) {
        res.status(500).json({ error: 'failed to load data' })
    }
}