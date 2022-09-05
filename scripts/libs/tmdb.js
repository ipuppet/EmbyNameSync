const Request = require("./request")

class Tmdb extends Request {
    languageList = ["zh-CN", "zh-SG", "zh-TW", "zh-HK"]
    baseUrl = "https://api.themoviedb.org/3"
    err = new Error("cannot get data from tmdb.")

    constructor(kernel, apiKey) {
        super(kernel)
        this.apiKey = apiKey
        this.useCache()
    }

    async getTvInfo(tvId) {
        for (let language of this.languageList) {
            try {
                const url = `/tv/${tvId}?api_key=${this.apiKey}&language=${language}&append_to_response=alternative_titles`
                return await this.request(url, Request.Method.get)
            } catch (error) {
                this.kernel.error(error)
                continue
            }
        }
        throw this.err
    }

    async getTvSeasonInfo(tvId, seasonId) {
        for (let language of this.languageList) {
            try {
                const url = `/tv/${tvId}/season/${seasonId}?api_key=${this.apiKey}&language=${language}&append_to_response=alternative_titles`
                return await this.request(url, Request.Method.get)
            } catch (error) {
                this.kernel.error(error)
                continue
            }
        }
        throw this.err
    }

    async getMovieInfo(movieId) {
        for (let language of this.languageList) {
            try {
                const url = `/tv/${movieId}?api_key=${this.apiKey}&language=${language}&append_to_response=alternative_titles`
                return await this.request(url, Request.Method.get)
            } catch (error) {
                this.kernel.error(error)
                continue
            }
        }
        throw this.err
    }
}

module.exports = Tmdb
