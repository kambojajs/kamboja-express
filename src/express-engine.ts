import { RequestAdapter } from "./request-adapter"
import { ResponseAdapter } from "./response-adapter"
import { ExpressEngineOption } from "./express-engine-options"
import { ExpressMetaData } from "./express-metadata"
import { Kamboja, Core, Resolver, Engine } from "kamboja"
import * as Express from "express"
import * as Logger from "morgan"
import * as CookieParser from "cookie-parser"
import * as BodyParser from "body-parser"
import * as Http from "http";
import * as Lodash from "lodash"
import * as Fs from "fs"
import * as Chalk from "chalk"

export class ExpressEngine implements Core.Engine {

    constructor(public application?: Express.Application) { }

    private initExpress(options: Core.KambojaOption) {
        let pathResolver = options.pathResolver
        let app = Express();
        app.set("views", pathResolver.resolve(options.viewPath))
        app.set("view engine", options.viewEngine)
        if (options.showConsoleLog) app.use(Logger("dev"))
        app.use(BodyParser.json())
        app.use(BodyParser.urlencoded({ extended: false }));
        app.use(CookieParser());
        app.use(Express.static(pathResolver.resolve(options.staticFilePath)))
        this.application = app;
    }

    private initErrorHandler(options: Core.KambojaOption) {
        let env = this.application.get('env')
        this.application.use((err, req, res, next) => {
            let status = err.status;
            if (options.errorHandler) {
                options.errorHandler(new Core.HttpError(status, err,
                    new RequestAdapter(req), new ResponseAdapter(res, next)))
            }
            else {
                res.status(status);
                res.render('error', {
                    message: err.message,
                    error: env == "development" ? err : {}
                });
            }
        })
    }

    private initController(routes: Core.RouteInfo[], option: ExpressEngineOption) {
        if (option.middlewares && option.middlewares.length > 0)
            this.application.use(option.middlewares)
        let routeByClass = Lodash.groupBy(routes, "classMetaData.name")

        let route = routes.filter(x => option.defaultPage &&
            x.route.toLowerCase() == option.defaultPage.toLowerCase())[0]
        if (route) {
            this.application.get("/", async (req, resp, next) => {
                let container = new Engine.ControllerFactory(option, route)
                let handler = new Engine.RequestHandler(container, new RequestAdapter(req), new ResponseAdapter(resp, next), option)
                await handler.execute();
            })
        }

        Lodash.forOwn(routeByClass, (routes, key) => {
            let classRoute = Express.Router()
            routes.forEach(route => {
                let container = new Engine.ControllerFactory(option, route)
                let requestHandler = async (req, resp, next) => {
                    let handler = new Engine.RequestHandler(container, new RequestAdapter(req), new ResponseAdapter(resp, next), option)
                    await handler.execute();
                }
                let methodRoute = Express.Router()
                let method = route.httpMethod.toLowerCase();
                let controller = container.createController();
                let methodMiddlewares = ExpressMetaData.getMiddlewares(controller, route.methodMetaData.name)
                if (methodMiddlewares && methodMiddlewares.length > 0)
                    methodRoute[method](route.methodPath, methodMiddlewares, requestHandler)
                else
                    methodRoute[method](route.methodPath, requestHandler)
                let classMiddlewares = ExpressMetaData.getMiddlewares(controller)
                if (classMiddlewares && classMiddlewares.length > 0)
                    classRoute.use(routes[0].classPath, classMiddlewares, methodRoute)
                else
                    classRoute.use(routes[0].classPath, methodRoute)
            })
            this.application.use(classRoute)
        })
        this.application.use(async (req, resp, next) => {
            let container = new Engine.ControllerFactory(option)
            let handler = new Engine.RequestHandler(container, new RequestAdapter(req), new ResponseAdapter(resp, next), option)
            await handler.execute();
        })
    }

    init(routes: Core.RouteInfo[], options: ExpressEngineOption) {
        if (!this.application) this.initExpress(options)
        this.initController(routes, options)
        this.initErrorHandler(options)
        return this.application;
    }
}



