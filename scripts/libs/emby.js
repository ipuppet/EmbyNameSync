const Request = require("./request")

class Emby extends Request {
    constructor(kernel, host, userId, apiKey) {
        super(kernel)
        this.baseUrl = host.trim("/")
        this.userId = userId
        this.apiKey = apiKey
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

    async setItemInfo(itemId, info) {
        const url = `/emby/Items/${itemId}?api_key=${this.apiKey}`
        await this.request(url, Request.Method.post, info)
    }
}

module.exports = Emby
