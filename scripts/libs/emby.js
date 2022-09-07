const { Request } = require("./easy-jsbox")

class Emby extends Request {
    isLogRequest = false

    constructor(kernel, host, userId, apiKey) {
        super(kernel)
        this.baseUrl = host.trim("/")
        this.userId = userId
        this.apiKey = apiKey
    }

    async isReady() {
        try {
            await this.request(`/emby/Users/${this.userId}/Items?api_key=${this.apiKey}`, Request.Method.get)
            return true
        } catch (error) {
            return false
        }
    }

    async getItems(parentId = "") {
        let url
        if (parentId !== "") {
            url = `/emby/Users/${this.userId}/Items?ParentId=${parentId}&api_key=${this.apiKey}`
        } else {
            url = `/emby/Users/${this.userId}/Items?api_key=${this.apiKey}`
        }
        return await this.request(url, Request.Method.get)
    }

    async getItemInfo(itemId) {
        let url = `/emby/Users/${this.userId}/Items/${itemId}?Fields=ChannelMappingInfo&api_key=${this.apiKey}`
        return await this.request(url, Request.Method.get)
    }

    async setItemInfo(info) {
        const url = `/emby/Items/${info.Id}?api_key=${this.apiKey}`
        await this.request(url, Request.Method.post, info)
    }
}

module.exports = Emby
