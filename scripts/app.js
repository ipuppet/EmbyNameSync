const { Sheet, Kernel, TabBarController, Setting } = require("./libs/easy-jsbox")
const Emby = require("./libs/emby")
const Tmdb = require("./libs/tmdb")
const HomeUI = require("./ui/home")

/**
 * @typedef {AppKernel} AppKernel
 */
class AppKernel extends Kernel {
    constructor() {
        super()
        this.setting = new Setting()
        this.setting.loadConfig()
        this.initSettingMethods()
        this.initComponents()
    }

    deleteConfirm(message, conformAction) {
        $ui.alert({
            title: message,
            actions: [
                {
                    title: $l10n("DELETE"),
                    style: $alertActionType.destructive,
                    handler: () => {
                        conformAction()
                    }
                },
                { title: $l10n("CANCEL") }
            ]
        })
    }

    initComponents() {
        this.embyClient = new Emby(
            this,
            this.setting.get("emby.host"),
            this.setting.get("emby.userId"),
            this.setting.get("emby.apiKey")
        )
        this.tmdbClient = new Tmdb(this, this.setting.get("tmdb.apiKey"))
        this.tabBarController = new TabBarController()
        this.homeUI = new HomeUI(this)
    }

    /**
     * 注入设置中的脚本类型方法
     */
    initSettingMethods() {
        this.setting.method.readme = animate => {
            const content = $file.read("/README.md").string
            const sheet = new Sheet()
            sheet
                .setView({
                    type: "markdown",
                    props: { content: content },
                    layout: (make, view) => {
                        make.size.equalTo(view.super)
                    }
                })
                .init()
                .present()
        }
    }
}

class AppUI {
    static renderMainUI() {
        const kernel = new AppKernel()
        const buttons = {
            home: {
                icon: "link",
                title: $l10n("HOME")
            },
            setting: {
                icon: "gear",
                title: $l10n("SETTING")
            }
        }

        kernel.tabBarController
            .setPages({
                home: kernel.homeUI.getNavigationView().getPage(),
                setting: kernel.setting.getPageView()
            })
            .setCells({
                home: buttons.home,
                setting: buttons.setting
            })

        kernel.UIRender(kernel.tabBarController.generateView().definition)
    }

    static renderUnsupported() {
        $intents.finish("不支持在此环境中运行")
        $ui.render({
            views: [
                {
                    type: "label",
                    props: {
                        text: "不支持在此环境中运行",
                        align: $align.center
                    },
                    layout: $layout.fill
                }
            ]
        })
    }
}

module.exports = {
    run: () => {
        if ($app.env === $env.app) {
            AppUI.renderMainUI()
        } else {
            AppUI.renderUnsupported()
        }
    }
}
