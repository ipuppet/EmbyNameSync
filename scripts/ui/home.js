const { Tasks, UIKit, NavigationView } = require("../libs/easy-jsbox")

/**
 * @typedef {import("../app").AppKernel} AppKernel
 */

class HomeUI {
    static CollectionTypeBlackList = ["boxsets", "music", "livetv"]

    tasks = new Tasks()
    taskCount = 0

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
        this.taskCountId = "task-count"

        this.exclude = this.kernel.setting.get("general.exclude")
        this.exclude = this.exclude.split(",").map(item => {
            item = item.trim()
            const lastIndex = item.lastIndexOf("/")
            if (item.startsWith("/") && lastIndex !== 0) {
                const flags = item.substring(lastIndex + 1)
                return new RegExp(item.substring(1, lastIndex), flags)
            }
            return item
        })

        $app.tips("点击右上角按钮开始任务")
    }

    newTask(task, msg = "empty") {
        return async () => {
            try {
                ++this.taskCount
                this.updateTaskCount()
                this.updateUI(msg, 1)
                await task()
            } catch (error) {
                $ui.error(error)
                this.kernel.error(error)
                this.updateUI(String(error), 1)
            } finally {
                --this.taskCount
                this.updateTaskCount()
            }
        }
    }

    async init() {
        await this.newTask(async () => {
            const isReady = this.kernel.tmdbClient.isReady() && (await this.kernel.embyClient.isReady())
            if (!isReady) {
                throw new Error("unable to connect to emby server or config invalid")
            }
            const items = await this.kernel.embyClient.getItems()
            await this.checkMedia(items)
        }, "task start")()
    }

    hasChinese(str) {
        return /.*[\u4e00-\u9fa5]+.*/.test(str)
    }

    isExclude(name) {
        const isRegExp = v => {
            return typeof v === "object"
        }

        let res = false

        for (let p of this.exclude) {
            if (isRegExp(p)) {
                res = p.test(name)
                if (res) return res
            } else {
                res = name === p
                if (res) return res
            }
        }

        return res
    }

    alternativeName(alternativeTitles) {
        for (let title of alternativeTitles?.alternative_titles?.titles ?? []) {
            if (title.iso_3166_1 || title.iso_3166_1 !== "CN" || !this.hasChinese(title.title)) {
                continue
            }
            return title.title
        }
    }

    async checkMedia(items) {
        for (let item of items.Items) {
            if (HomeUI.CollectionTypeBlackList.includes(item?.CollectionType)) {
                continue
            }

            if (this.isExclude(item.Name)) {
                continue
            }

            if (item.Type.includes("Folder")) {
                this.tasks.addTask(
                    this.newTask(async () => {
                        const items = await this.kernel.embyClient.getItems(item.Id)
                        await this.checkMedia(items)
                    }, "scanning " + item.Name),
                    this.checkMediaDelay
                )
                this.checkMediaDelay += this.checkMediaDelaySpan
            } else if (item.Type === "Series" || item.Type === "Movie") {
                this.tasks.addTask(
                    this.newTask(async () => {
                        const itemInfo = await this.kernel.embyClient.getItemInfo(item.Id)
                        await this.updateEmbyItem(itemInfo, async () => await this.getTmdbMediaInfo(itemInfo))

                        if (itemInfo.Type === "Series") {
                            await this.checkSeries(itemInfo)
                        }
                    }, "checking " + item.Name)
                )
            }
        }
    }

    async checkSeries(seriesInfo) {
        if (!this.kernel.setting.get("general.checkSeries")) {
            return
        }
        const seasons = await this.kernel.embyClient.getItems(seriesInfo.Id)
        for (const season of seasons.Items) {
            // 获取 season 包含的 episode
            const episodes = await this.kernel.embyClient.getItems(season.Id)
            for (const episode of episodes.Items) {
                this.tasks.addTask(
                    this.newTask(async () => {
                        await this.updateEmbyItem(
                            await this.kernel.embyClient.getItemInfo(episode.Id),
                            async () =>
                                await this.getTmdbEpisodeInfo(seriesInfo, season.IndexNumber, episode.IndexNumber)
                        )
                    })
                )
            }
        }
    }

    getTmdbId(itemInfo) {
        if (!itemInfo.ProviderIds?.Tmdb && !itemInfo.ProviderIds?.tmdb) {
            throw new Error(`cannot find [${itemInfo.Name}] Tmdb ID`)
        }

        return itemInfo.ProviderIds?.Tmdb ?? itemInfo.ProviderIds?.tmdb
    }

    async getTmdbMediaInfo(itemInfo) {
        const tmdbId = this.getTmdbId(itemInfo)

        if (itemInfo.Type === "Series") {
            return await this.kernel.tmdbClient.getTvInfo(tmdbId)
        } else if (itemInfo.Type === "Movie") {
            return await this.kernel.tmdbClient.getMovieInfo(tmdbId)
        } else {
            throw new Error("unsupported type: " + itemInfo.Type)
        }
    }

    async getTmdbEpisodeInfo(itemInfo, seasonIndexNumber, episodeIndexNumber) {
        const tmdbId = this.getTmdbId(itemInfo)
        const tmdbSeasonInfo = await await this.kernel.tmdbClient.getTvSeasonInfo(tmdbId, seasonIndexNumber)
        // 遍历寻找对应的 episode
        let tmdbEpisodeInfo
        for (tmdbEpisodeInfo of tmdbSeasonInfo.episodes) {
            if (tmdbEpisodeInfo.episode_number > episodeIndexNumber) {
                throw new Error(
                    `cannot find episode from tmdb: ${itemInfo.Name} S${seasonIndexNumber}E${episodeIndexNumber}`
                )
            }
            if (tmdbEpisodeInfo.episode_number === episodeIndexNumber) {
                break
            }
        }
        return tmdbEpisodeInfo
    }

    async updateEmbyItem(itemInfo, tmdbInfoGetter) {
        if (this.hasChinese(itemInfo.Name) && this.hasChinese(itemInfo.Overview)) {
            return
        }

        const tmdbMediaInfo = await tmdbInfoGetter()

        const changes = []
        // name
        if (!itemInfo.LockedFields.includes("Name") && !this.hasChinese(itemInfo.Name)) {
            changes.push(`name changed: ${itemInfo.Name} -> ${tmdbMediaInfo.name}`)
            itemInfo.Name = tmdbMediaInfo.name
            itemInfo.LockedFields.push("Name")
        }
        // overview
        if (!itemInfo.LockedFields.includes("Overview") && !this.hasChinese(itemInfo.Overview)) {
            changes.push(`overview changed:\n${itemInfo.Overview}\n->\n${tmdbMediaInfo.overview}`)
            itemInfo.Overview = tmdbMediaInfo.overview
            itemInfo.LockedFields.push("Overview")
        }

        await this.kernel.embyClient.setItemInfo(itemInfo)
        this.updateUI(changes.join("\n"), 0)
    }

    updateUI(content, section) {
        $(this.listId).insert({
            indexPath: $indexPath(section, 0),
            value: content
        })
    }

    updateTaskCount() {
        $(this.taskCountId).text = "Task count: " + this.taskCount
    }

    getListView() {
        return {
            type: "list",
            props: {
                id: this.listId,
                header: {
                    type: "view",
                    props: { height: 20 },
                    views: [
                        {
                            type: "label",
                            props: {
                                id: this.taskCountId,
                                text: "Task count: " + this.taskCount
                            },
                            layout: (make, view) => {
                                make.left.inset(15)
                                make.centerY.equalTo(view.super)
                            }
                        }
                    ],
                    layout: $layout.fill
                },
                data: [
                    {
                        title: "Changes",
                        rows: []
                    },
                    {
                        title: "Logs",
                        rows: []
                    }
                ]
            },
            layout: $layout.fill,
            events: {
                //ready: () => this.init(),
                didSelect: (sender, indexPath, data) => {
                    $ui.alert(data)
                }
            }
        }
    }

    getNavigationView() {
        const navigationView = new NavigationView()

        navigationView.navigationBarItems.setRightButtons([
            {
                symbol: "arrow.clockwise",
                tapped: () => this.init()
            }
        ])
        navigationView.navigationBarTitle($l10n("HOME"))
        navigationView.navigationBar.setBackgroundColor(UIKit.primaryViewBackgroundColor)
        navigationView.setView(this.getListView())

        return navigationView
    }
}

module.exports = HomeUI
