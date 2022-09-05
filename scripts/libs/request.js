/**
 * @typedef {import("../app").AppKernel} AppKernel
 */

class Request {
    static Method = {
        get: "GET",
        post: "POST"
    }
    #useCache = false
    /**
     * @type {AppKernel}
     */
    kernel

    /**
     *
     * @param {AppKernel} kernel
     */
    constructor(kernel) {
        this.kernel = kernel
    }

    useCache() {
        this.#useCache = true
    }

    async request(url, method, body = {}) {
        url = this.baseUrl + url
        let cacheKey
        const useCache = this.#useCache && method === Request.Method.get
        if (useCache) {
            cacheKey = $text.MD5(url)
            const cache = $cache.get(cacheKey)
            if (cache) {
                this.kernel.print("get data from cache: " + url)
                return cache
            }
        }
        try {
            if (useCache) {
                this.kernel.print("sending request: " + url)
            }
            const resp = await $http.request({
                url,
                method,
                body
            })
            if (resp?.response?.statusCode >= 400) {
                throw new Error("http error: [" + resp.response.statusCode + "] " + resp.data.message)
            }
            if (useCache) {
                $cache.set(cacheKey, resp.data)
            }
            return resp.data
        } catch (error) {
            if (error.code) {
                error = new Error("network error: [" + error.code + "] " + error.localizedDescription)
            }
            throw error
        }
    }
}

module.exports = Request
