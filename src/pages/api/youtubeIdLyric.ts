export default async function handler(req: any, res: any) {
    try {
        /**
         * More than one:
         * Request URL: https://content-youtube.googleapis.com/youtube/v3/videos?id=poCqEpwVfhg&id=xx&key=xx
         */
        const result = await fetch("https://www.googleapis.com/youtube/v3/videos?id=xx&part=statistics&key=xx")
        const data = await result.json()
        res.status(200).json({videos: data.items})

    } catch (err) {
        res.status(500).json({ error: 'failed to load data' })
    }
}