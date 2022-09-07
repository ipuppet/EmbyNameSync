const { Tasks, UIKit, NavigationView } = require("../libs/easy-jsbox")

/**
 * @typedef {import("../app").AppKernel} AppKernel
 */

class HomeUI {
    static CollectionTypeBlackList = ["boxsets", "music", "livetv"]

    tasks = new Tasks()

    /**
     * @param {AppKernel} kernel
     */
    constructor(kernel) {
        this.kernel = kernel
        this.checkMediaDelay = 0
        this.checkMediaDelaySpan = 0.1
        this.updateEmbyItemDelay = 0
        this.updateEmbyItemDelaySpan = 0.2

        this.listId = "item-list"
        this.rowHeight = 90
        this.rowEdge = 10
    }

    async init() {
        try {
            const items = await this.kernel.embyClient.getItems()
            this.checkMedia(items)
        } catch (error) {
            $ui.alert(error)
            this.kernel.error(error)
        }
    }

    hasChinese(str) {
        return /.*[\u4e00-\u9fa5]+.*/.test(str)
    }

    async checkMedia(items) {
        try {
            for (let item of items.Items) {
                if (HomeUI.CollectionTypeBlackList.includes(item?.CollectionType)) {
                    continue
                }
                if (item.Type.includes("Folder")) {
                    this.tasks.addTask(async () => {
                        const items = await this.kernel.embyClient.getItems(item.Id)
                        this.checkMedia(items)
                    }, this.checkMediaDelay)
                    this.checkMediaDelay += this.checkMediaDelaySpan
                } else {
                    if (item.Type === "Series" || item.Type === "Movie") {
                        // TODO dev
                        this.tasks.clearTasks()
                        this.tasks.addTask(async () => {
                            const itemInfo = await this.kernel.embyClient.getItemInfo(item.Id)
                            const tmdbMediaInfo = await this.getTmdbMediaInfo(itemInfo)
                            this.updateEmbyItem(itemInfo, tmdbMediaInfo)
                        }, this.updateEmbyItemDelay)
                        this.updateEmbyItemDelay += this.updateEmbyItemDelaySpan
                        return
                    }
                }
            }
        } catch (error) {
            this.kernel.error(error)
        }
    }

    async getTmdbMediaInfo(itemInfo) {
        try {
            if (!itemInfo.ProviderIds?.Tmdb && !itemInfo.ProviderIds?.tmdb) {
                throw new Error(`cannot find [${itemInfo.Name}] Tmdb ID`)
            }

            const tmdbId = itemInfo.ProviderIds?.Tmdb ?? itemInfo.ProviderIds?.tmdb

            if (itemInfo.Type === "Series") {
                return await this.kernel.tmdbClient.getTvInfo(tmdbId)
            } else if (itemInfo.Type === "Movie") {
                return await this.kernel.tmdbClient.getMovieInfo(tmdbId)
            } else {
                throw new Error("unsupported type: " + itemInfo.Type)
            }
        } catch (error) {
            $ui.alert(error)
            this.kernel.error(error)
            throw error
        }
    }

    async getTmdbSeasonInfo(itemInfo, season) {
        try {
            if (!itemInfo.ProviderIds?.Tmdb && !itemInfo.ProviderIds?.tmdb) {
                throw new Error(`cannot find [${itemInfo.Name}] Tmdb ID`)
            }

            const tmdbId = itemInfo.ProviderIds?.Tmdb ?? itemInfo.ProviderIds?.tmdb

            return await this.kernel.tmdbClient.getTvSeasonInfo(tmdbId, season)
        } catch (error) {
            $ui.alert(error)
            this.kernel.error(error)
            throw error
        }
    }

    async updateEmbyItem(itemInfo, tmdbMediaInfo, checkSeries = true) {
        if (this.hasChinese(itemInfo.Name) && this.hasChinese(itemInfo.Overview)) {
            // TODO dev
            //return
        }

        // name
        let originalName
        if (!itemInfo.LockedFields.includes("Name") && !this.hasChinese(itemInfo.Name)) {
            originalName = itemInfo.Name
            itemInfo.Name = tmdbMediaInfo.name
            itemInfo.LockedFields.push("Name")
        }
        // overview
        if (!itemInfo.LockedFields.includes("Overview") && !this.hasChinese(itemInfo.Overview)) {
            itemInfo.Overview = tmdbMediaInfo.overview
            itemInfo.LockedFields.push("Overview")
        }

        // checkSeries 防止无限递归
        if (checkSeries && itemInfo.Type === "Series") {
            this.checkSeries(itemInfo)
        }
    }

    async checkSeries(itemInfo) {
        const seasons = await this.kernel.embyClient.getItems(itemInfo.Id)
        for (const season of seasons.Items) {
            let delay = 0

            // 获取 season 信息
            const tmdbSeasonInfo = await this.getTmdbSeasonInfo(itemInfo, season.IndexNumber)
            // 获取 season 包含的 episode
            const episodes = await this.kernel.embyClient.getItems(season.Id)
            // 遍历寻找对应的 episode
            for (const episode of episodes.Items) {
                let tmdbEpisodeInfo
                for (tmdbEpisodeInfo of tmdbSeasonInfo.episodes) {
                    if (tmdbEpisodeInfo.episode_number > episode.IndexNumber) {
                        throw new Error(
                            `cannot find episode from tmdb: ${itemInfo.Name} S${season.IndexNumber}E${episode.IndexNumber}`
                        )
                    }
                    if (tmdbEpisodeInfo.episode_number === episode.IndexNumber) {
                        break
                    }
                }

                this.tasks.addTask(async () => {
                    this.updateEmbyItem(episode, tmdbEpisodeInfo, false)
                }, delay)
                delay += this.updateEmbyItemDelaySpan

                // TODO dev
                return
            }
        }
    }

    alternativeName(alternativeTitles) {
        for (let title of alternativeTitles?.alternative_titles?.titles ?? []) {
            if (title.iso_3166_1 || title.iso_3166_1 !== "CN" || !this.hasChinese(title.title)) {
                continue
            }
            return title.title
        }
    }

    getListView() {
        return {
            type: "list",
            props: {
                id: this.listId,
                rowHeight: this.rowHeight,
                data: []
            },
            layout: $layout.fill,
            events: {
                ready: () => this.init()
            }
        }
    }

    getNavigationView() {
        const navigationView = new NavigationView()

        navigationView.navigationBarItems.setRightButtons([
            {
                symbol: "arrow.clockwise",
                tapped: async () => {
                    try {
                        await this.init()
                        $ui.success($l10n("SUCCESS"))
                    } catch (error) {
                        $ui.alert(error)
                    }
                }
            }
        ])
        navigationView.navigationBarTitle($l10n("HOME"))
        navigationView.navigationBar.setBackgroundColor(UIKit.primaryViewBackgroundColor)
        navigationView.setView(this.getListView())

        return navigationView
    }
}

module.exports = HomeUI
